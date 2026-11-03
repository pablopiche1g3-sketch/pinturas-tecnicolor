'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const TenderProductSchema = z.object({
  code: z.string().describe('Código, número de renglón o ítem (ej. "Renglón 1", "01", "PINT-01").'),
  description: z.string().describe('Descripción detallada y especificación del producto o pintura licitada.'),
  unit: z.string().optional().describe('Unidad de medida (ej. Cubeta 5 Gal, Galón, Caneca, Litro, Kit, Unidad).'),
  quantity: z.number().describe('Cantidad requerida o adjudicada.'),
  unitPrice: z.number().optional().describe('Precio unitario contratado o presupuestado con o sin IVA según el documento.'),
  lineTotal: z.number().optional().describe('Monto total de este renglón.'),
});

const AiTenderParserInputSchema = z.object({
  pdfDataUri: z.string().describe('Data URI del archivo PDF o documento de licitación (data:application/pdf;base64,...).'),
  documentName: z.string().optional().describe('Nombre del archivo subido.'),
});
export type AiTenderParserInput = z.infer<typeof AiTenderParserInputSchema>;

const AiTenderParserOutputSchema = z.object({
  projectName: z.string().optional().describe('Nombre del proyecto, licitación pública, concurso o libre gestión.'),
  purchaseOrder: z.string().optional().describe('Número de orden de compra, contrato, código de licitación (ej. LP-01/2026).'),
  customerName: z.string().optional().describe('Nombre de la institución gubernamental, alcaldía, ministerio o cliente convocante.'),
  totalBudget: z.number().optional().describe('Monto total presupuestado o adjudicado del proyecto.'),
  items: z.array(TenderProductSchema).describe('Lista clasificada de productos, pinturas, solventes y suministros de la licitación.'),
  summary: z.string().optional().describe('Breve resumen explicativo de lo que se extrajo del documento.'),
});
export type AiTenderParserOutput = z.infer<typeof AiTenderParserOutputSchema>;

export type AiTenderResponse = {
  success: boolean;
  data?: AiTenderParserOutput;
  error?: string;
};

/**
 * Server Action que analiza un documento de licitación en PDF utilizando Gemini multimodal.
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
        error: 'El archivo PDF no tiene un formato Data URI Base64 válido.',
      };
    }

    // Normalizar data URI para asegurar formato de PDF o imagen
    let cleanDataUri = input.pdfDataUri;
    if (cleanDataUri.startsWith('data:application/pdf;filename=')) {
      cleanDataUri = cleanDataUri.replace(/^data:application\/pdf;filename=[^;]+;base64,/, 'data:application/pdf;base64,');
    }

    const mimeMatch = cleanDataUri.match(/^data:([^;]+);base64,/);
    const contentType = mimeMatch ? mimeMatch[1] : 'application/pdf';

    const systemPrompt = `Eres un experto en compras públicas, licitaciones institucionales y contratos de suministros de pinturas en El Salvador y Centroamérica.

Tu objetivo es leer minuciosamente el documento adjunto (Bases de Licitación, Orden de Compra, Contrato de Adjudicación o Lista de Requerimientos) y extraer de forma estructurada y clasificada toda la información del proyecto:
1. Nombre o Título de la Licitación / Proyecto.
2. Número de Licitación / Orden de Compra / Contrato.
3. Institución, Ministerio, Alcaldía o Cliente contratante.
4. Lista completa de TODOS los renglones / productos adjudicados:
   - "code": Código oficial, número de renglón o ítem (ej. "Renglón 1", "001", "Ítem 3"). Si no trae código específico, usa "Renglón 1", "Renglón 2", etc.
   - "description": Nombre y especificación técnica clara (incluye color, tipo de pintura como látex, esmalte, anticorrosivo, tráfico, etc.).
   - "unit": Unidad de medida identificada (ej. "Cubeta 5 Gal", "Galón", "Kit", "Litro", etc.).
   - "quantity": Cantidad exacta solicitada o contratada (número).
   - "unitPrice": Precio unitario presupuestado o adjudicado si está disponible.
   - "lineTotal": Total del renglón si está disponible.
5. Monto total adjudicado o presupuestado si está indicado.
6. Un breve resumen explicativo del resultado del análisis.

Si el documento contiene tablas con múltiples páginas, revisa todas las páginas para no omitir ningún renglón.
Devuelve los datos estrictamente estructurados conforme al esquema.`;

    const result = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      prompt: [
        { text: systemPrompt },
        { media: { url: cleanDataUri, contentType } },
      ],
      output: { schema: AiTenderParserOutputSchema },
    });

    if (!result.output) {
      return {
        success: false,
        error: 'La IA no pudo estructurar los datos del documento de licitación. Verifique que sea un documento legible.',
      };
    }

    return {
      success: true,
      data: result.output,
    };
  } catch (error: any) {
    console.error('Error al procesar licitación con IA:', error);
    return {
      success: false,
      error: error.message || 'Error inesperado al conectar con el motor de IA de lectura de licitaciones.',
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
