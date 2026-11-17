'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import mammoth from 'mammoth';

const TenderProductSchema = z.object({
  code: z.string().describe('Código, número de renglón o ítem (ej. "Renglón 1", "01", "PINT-01").'),
  description: z.string().describe('Descripción detallada y especificación del producto o pintura solicitada en la orden de compra / licitación.'),
  unit: z.string().optional().describe('Unidad de medida (ej. Cubeta 5 Gal, Galón, Caneca, Litro, Kit, Unidad).'),
  quantity: z.number().describe('Cantidad requerida o adjudicada en la orden de compra.'),
  unitPrice: z.number().optional().describe('Precio unitario contratado o adjudicado según la orden de compra.'),
  lineTotal: z.number().optional().describe('Monto total de este renglón.'),
});

const AiTenderParserInputSchema = z.object({
  pdfDataUri: z.string().describe('Data URI del archivo Word (.docx/.doc) o PDF de la orden de compra / licitación.'),
  documentName: z.string().optional().describe('Nombre del archivo subido.'),
});
export type AiTenderParserInput = z.infer<typeof AiTenderParserInputSchema>;

const AiTenderParserOutputSchema = z.object({
  projectName: z.string().optional().describe('Nombre del proyecto, objeto contractual, licitación o suministro según la orden de compra.'),
  purchaseOrder: z.string().optional().describe('Número de Orden de Compra (OC), contrato o código de proceso (ej. OC-01/2026, LP-01/2026).'),
  customerName: z.string().optional().describe('Nombre de la institución gubernamental, alcaldía, ministerio o empresa compradora.'),
  totalBudget: z.number().optional().describe('Monto total de la Orden de Compra o presupuesto adjudicado.'),
  deliveryDeadline: z.string().optional().describe('Plazo o fecha límite de entrega requerido en la Orden de Compra (ej. "15 días hábiles", "30 de noviembre 2026").'),
  deliveryAddress: z.string().optional().describe('Lugar, bodega o dirección exacta de entrega estipulada en la Orden de Compra.'),
  paymentTerms: z.string().optional().describe('Forma o condición de pago (ej. "Crédito 30 días", "Quedan", "Contra entrega").'),
  warrantyMonths: z.number().optional().describe('Meses de garantía de cumplimiento o buena calidad solicitados (si se indica, ej. 12).'),
  orderRequirements: z.string().optional().describe('Requisitos especiales de la Orden de Compra: documentos para facturación, horarios de recepción, contacto de bodega, administrador de contrato o condiciones técnicas.'),
  items: z.array(TenderProductSchema).describe('Lista clasificada de todos los renglones/productos requeridos en la Orden de Compra.'),
  summary: z.string().optional().describe('Breve resumen explicativo de los requisitos de la orden de compra extraídos del documento.'),
});
export type AiTenderParserOutput = z.infer<typeof AiTenderParserOutputSchema>;

export type AiTenderResponse = {
  success: boolean;
  data?: AiTenderParserOutput;
  error?: string;
};

/**
 * Server Action que analiza un documento de Orden de Compra / Licitación en formato Word (.docx/.doc) [Prioridad] o PDF utilizando Gemini.
 */
export async function aiTenderParser(input: AiTenderParserInput): Promise<AiTenderResponse> {
  try {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: 'Falta la API Key de Google (GEMINI_API_KEY). Por favor configure las variables de entorno.',
      };
    }

    if (!input.pdfDataUri || !input.pdfDataUri.includes('base64,')) {
      return {
        success: false,
        error: 'El archivo no tiene un formato Base64 válido.',
      };
    }

    const fileNameLower = (input.documentName || '').toLowerCase();
    const isWordDoc =
      fileNameLower.endsWith('.docx') ||
      fileNameLower.endsWith('.doc') ||
      input.pdfDataUri.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
      input.pdfDataUri.includes('application/msword');

    const systemPrompt = `Eres un experto en compras públicas, órdenes de compra (OC), licitaciones institucionales y contratos de suministros de pinturas en El Salvador y Centroamérica.

Tu objetivo es leer minuciosamente la Orden de Compra, Bases de Licitación o Contrato adjunto y extraer de forma estructurada todos los requisitos para crear el proyecto automáticamente:
1. "projectName": Nombre o título del proyecto / suministro según la Orden de Compra (si no tiene nombre explícito, constrúyelo con el suministro principal y la institución).
2. "purchaseOrder": Número exacto de la Orden de Compra (OC), Contrato o Licitación.
3. "customerName": Nombre oficial de la institución, alcaldía, ministerio o empresa cliente que emite la Orden de Compra.
4. "totalBudget": Monto total de la Orden de Compra ($).
5. Requisitos operativos de la Orden de Compra:
   - "deliveryDeadline": Plazo o tiempo de entrega requerido (ej. "15 días hábiles después de recibir la OC").
   - "deliveryAddress": Lugar o bodega de recepción donde se debe entregar el producto.
   - "paymentTerms": Condiciones de pago o trámite de Quedan.
   - "warrantyMonths": Meses de garantía requeridos (en número, ej. 12).
   - "orderRequirements": Cualquier otro requisito clave de la Orden de Compra (administrador de la orden de compra, teléfono/correo de contacto, requisitos de facturación, muestras, certificados de calidad, etc.).
6. "items": Lista completa de TODOS los renglones / productos solicitados en la Orden de Compra:
   - "code": Código oficial, número de renglón o ítem (ej. "Renglón 1", "001", "Ítem 3"). Si no trae código específico, usa "Renglón 1", "Renglón 2", etc.
   - "description": Nombre y especificación técnica clara (incluye color, acabado, tipo de pintura como látex, esmalte, anticorrosivo, tráfico, marca o norma si se especifica).
   - "unit": Unidad de medida (ej. "Cubeta 5 Gal", "Galón", "Kit", "Litro", "Unidad").
   - "quantity": Cantidad exacta solicitada en la OC (número).
   - "unitPrice": Precio unitario adjudicado en la OC.
   - "lineTotal": Monto total del renglón.
7. "summary": Breve resumen ejecutivo de la Orden de Compra y sus requisitos principales.

Revisa todas las tablas y cláusulas del documento para no omitir ningún renglón ni requisito de la Orden de Compra.`;

    let promptPayload: any[];

    if (isWordDoc) {
      const base64Data = input.pdfDataUri.split('base64,')[1];
      const buffer = Buffer.from(base64Data, 'base64');

      let extractedContent = '';
      try {
        // Extraemos tanto HTML (para conservar estructura de tablas de los renglones) como texto plano
        const htmlResult = await mammoth.convertToHtml({ buffer });
        const rawTextResult = await mammoth.extractRawText({ buffer });
        extractedContent = `--- CONTENIDO ESTRUCTURADO (TABLAS Y TEXTO DEL WORD) ---\n${htmlResult.value}\n\n--- TEXTO PLANO DEL DOCUMENTO WORD ---\n${rawTextResult.value}`;
      } catch (wordErr: any) {
        // Fallback para archivos .doc antiguos: extraer cadenas legibles del buffer
        const fallbackText = buffer
          .toString('utf8')
          .replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ')
          .replace(/\s+/g, ' ');
        extractedContent = `--- TEXTO EXTRAÍDO DEL DOCUMENTO WORD (${input.documentName || 'OC.doc'}) ---\n${fallbackText}`;
      }

      promptPayload = [
        {
          text: `${systemPrompt}\n\nA continuación se presenta el contenido íntegro extraído del archivo Word (${input.documentName || 'Orden_de_Compra.docx'}):\n\n${extractedContent}`,
        },
      ];
    } else {
      // Documento PDF o Imagen
      let cleanDataUri = input.pdfDataUri;
      if (cleanDataUri.startsWith('data:application/pdf;filename=')) {
        cleanDataUri = cleanDataUri.replace(
          /^data:application\/pdf;filename=[^;]+;base64,/,
          'data:application/pdf;base64,'
        );
      }

      const mimeMatch = cleanDataUri.match(/^data:([^;]+);base64,/);
      const contentType = mimeMatch ? mimeMatch[1] : 'application/pdf';

      promptPayload = [
        { text: systemPrompt },
        { media: { url: cleanDataUri, contentType } },
      ];
    }

    const result = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      prompt: promptPayload,
      output: { schema: AiTenderParserOutputSchema },
    });

    if (!result.output) {
      return {
        success: false,
        error: 'La IA no pudo estructurar los datos del documento. Verifique que el archivo Word o PDF contenga la Orden de Compra o Licitación legible.',
      };
    }

    return {
      success: true,
      data: result.output,
    };
  } catch (error: any) {
    console.error('Error al procesar documento de OC/licitación con IA:', error);
    return {
      success: false,
      error: error.message || 'Error inesperado al conectar con el motor de IA para leer la Orden de Compra.',
    };
  }
}

const TenderAuditorInputSchema = z.object({
  projectName: z.string(),
  purchaseOrder: z.string(),
  customerName: z.string(),
  expectedProducts: z.array(z.object({
    code: z.string(),
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number().optional(),
    unit: z.string().optional(),
  })),
  summaryProgress: z.array(z.object({
    code: z.string(),
    description: z.string(),
    contractQty: z.number(),
    purchasedQty: z.number(),
    deliveredQty: z.number(),
    invoicedQty: z.number(),
    pendingDeliverQty: z.number(),
  })),
});
export type TenderAuditorInput = z.infer<typeof TenderAuditorInputSchema>;

const TenderAuditorOutputSchema = z.object({
  overallStatus: z.string().describe('Estado general: ej. "En Proceso Normal", "Alerta: Faltan Suministros", "Suministro Completo", etc.'),
  completionPercentage: z.number().describe('Porcentaje estimado de avance o cumplimiento general (0 a 100).'),
  executiveSummary: z.string().describe('Resumen ejecutivo claro de cómo marcha la licitación o proyecto.'),
  itemAlerts: z.array(z.object({
    code: z.string(),
    status: z.string().describe('OK, PENDIENTE, EXCESO, CRITICO'),
    observation: z.string(),
  })).describe('Alertas específicas por renglón o producto.'),
  actionRecommendations: z.array(z.string()).describe('Lista de recomendaciones inmediatas para el equipo administrativo.'),
});
export type TenderAuditorOutput = z.infer<typeof TenderAuditorOutputSchema>;

export type TenderAuditorResponse = {
  success: boolean;
  data?: TenderAuditorOutput;
  error?: string;
};

export async function aiTenderAuditor(input: TenderAuditorInput): Promise<TenderAuditorResponse> {
  try {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'Falta configurar GEMINI_API_KEY.' };
    }

    const systemPrompt = `Eres un auditor financiero y de operaciones especializado en contratos de suministros y licitaciones institucionales de pinturas en El Salvador.

Analiza el estado de ejecución de la licitación:
Proyecto: ${input.projectName} (OC/Contrato: ${input.purchaseOrder})
Cliente/Institución: ${input.customerName}

Datos de avance por renglón:
${JSON.stringify(input.summaryProgress, null, 2)}

Tu objetivo:
1. Evaluar si las cantidades compradas a proveedores cubren lo requerido por el contrato.
2. Evaluar si las cantidades remitidas/entregadas al cliente cumplen con los renglones licitados.
3. Detectar si hay renglones con déficit crítico (falta comprar o entregar) o si hay sobreabastecimiento innecesario.
4. Entregar recomendaciones precisas y accionables para el seguimiento correspondiente.

Responde de manera ejecutiva, concisa y profesional.`;

    const result = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      prompt: systemPrompt,
      output: { schema: TenderAuditorOutputSchema },
    });

    if (!result.output) {
      return { success: false, error: 'No se pudo generar la auditoría con IA.' };
    }

    return { success: true, data: result.output };
  } catch (error: any) {
    console.error('Error en aiTenderAuditor:', error);
    return { success: false, error: error.message || 'Error al conectar con la IA de auditoría.' };
  }
}
