'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as mammothModule from 'mammoth';

const mammoth: typeof mammothModule = (mammothModule as any).default || mammothModule;

const TenderProductSchema = z.object({
  code: z.string().nullable().optional().describe('Código, número de renglón o ítem (ej. "Renglón 1", "01", "PINT-01").'),
  description: z.string().describe('Descripción detallada y especificación del producto o pintura solicitada en la orden de compra / licitación.'),
  unit: z.string().nullable().optional().describe('Unidad de medida (ej. Cubeta 5 Gal, Galón, Caneca, Litro, Kit, Unidad).'),
  quantity: z.number().nullable().optional().describe('Cantidad requerida o adjudicada en la orden de compra.'),
  unitPrice: z.number().nullable().optional().describe('Precio unitario contratado o adjudicado según la orden de compra.'),
  lineTotal: z.number().nullable().optional().describe('Monto total de este renglón.'),
});

const AiTenderParserInputSchema = z.object({
  pdfDataUri: z.string().optional().describe('Data URI del archivo Word (.docx/.doc) o PDF de la orden de compra / licitación.'),
  documentName: z.string().optional().describe('Nombre del archivo subido.'),
  extractedText: z.string().optional().describe('Texto o HTML ya extraído del documento Word en el cliente.'),
});
export type AiTenderParserInput = z.infer<typeof AiTenderParserInputSchema>;

const AiTenderParserRawOutputSchema = z.object({
  projectName: z.string().nullable().optional().describe('Nombre del proyecto, objeto contractual, licitación o suministro según la orden de compra.'),
  purchaseOrder: z.string().nullable().optional().describe('Número de Orden de Compra (OC), contrato o código de proceso (ej. OC-01/2026, LP-01/2026).'),
  customerName: z.string().nullable().optional().describe('Nombre de la institución gubernamental, alcaldía, ministerio o empresa compradora.'),
  totalBudget: z.number().nullable().optional().describe('Monto total de la Orden de Compra o presupuesto adjudicado.'),
  deliveryDeadline: z.string().nullable().optional().describe('Plazo o fecha límite de entrega requerido en la Orden de Compra (ej. "15 días hábiles", "30 de noviembre 2026").'),
  deliveryAddress: z.string().nullable().optional().describe('Lugar, bodega o dirección exacta de entrega estipulada en la Orden de Compra.'),
  paymentTerms: z.string().nullable().optional().describe('Forma o condición de pago (ej. "Crédito 30 días", "Quedan", "Contra entrega").'),
  warrantyMonths: z.number().nullable().optional().describe('Meses de garantía de cumplimiento o buena calidad solicitados (si se indica, ej. 12).'),
  orderRequirements: z.string().nullable().optional().describe('Requisitos especiales de la Orden de Compra: documentos para facturación, horarios de recepción, contacto de bodega, administrador de contrato o condiciones técnicas.'),
  items: z.array(TenderProductSchema).nullable().optional().describe('Lista clasificada de todos los renglones/productos requeridos en la Orden de Compra.'),
  summary: z.string().nullable().optional().describe('Breve resumen explicativo de los requisitos de la orden de compra extraídos del documento.'),
});

export type TenderProductItem = {
  code: string;
  description: string;
  unit?: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
};

export type AiTenderParserOutput = {
  projectName?: string;
  purchaseOrder?: string;
  customerName?: string;
  totalBudget?: number;
  deliveryDeadline?: string;
  deliveryAddress?: string;
  paymentTerms?: string;
  warrantyMonths?: number;
  orderRequirements?: string;
  items: TenderProductItem[];
  summary?: string;
};

export type AiTenderResponse = {
  success: boolean;
  data?: AiTenderParserOutput;
  error?: string;
};

/**
 * Extrae texto legible de un archivo binario .doc antiguo (Word 97-2003)
 * combinando secuencias ASCII/Latin1 y UTF-16LE.
 */
function extractLegacyDocText(buffer: Buffer): string {
  const chunks: string[] = [];

  // 1. Extraer secuencias UTF-16LE (muy común en archivos .doc en español)
  const utf16 = buffer.toString('utf16le');
  const utf16Matches = utf16.match(/[\x20-\x7E\xA0-\xFF\n\r\t]{6,}/g) || [];
  const validUtf16 = utf16Matches
    .map((s) => s.trim())
    .filter((s) => /[a-zA-ZáéíóúÁÉÍÓÚñÑ]{3,}/.test(s));
  if (validUtf16.length > 0) {
    chunks.push(validUtf16.join('\n'));
  }

  // 2. Extraer secuencias Latin1/UTF-8
  const latin1 = buffer.toString('latin1');
  const latinMatches = latin1.match(/[\x20-\x7E\xA0-\xFF]{6,}/g) || [];
  const validLatin = latinMatches
    .map((s) => s.trim())
    .filter((s) => /[a-zA-ZáéíóúÁÉÍÓÚñÑ]{3,}/.test(s) && !/^(Root Entry|WordDocument|SummaryInformation|CompObj|Microsoft)/.test(s));
  if (validLatin.length > 0) {
    chunks.push(validLatin.join(' '));
  }

  return chunks.join('\n\n').slice(0, 60000);
}

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

    const fileNameLower = (input.documentName || '').toLowerCase();
    const isWordDoc =
      Boolean(input.extractedText) ||
      fileNameLower.endsWith('.docx') ||
      fileNameLower.endsWith('.doc') ||
      (input.pdfDataUri || '').includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
      (input.pdfDataUri || '').includes('application/msword');

    if (!input.extractedText && (!input.pdfDataUri || !input.pdfDataUri.includes('base64,'))) {
      return {
        success: false,
        error: 'El archivo no pudo leerse correctamente. Intente subir nuevamente el archivo Word (.docx) o PDF.',
      };
    }

    const systemPrompt = `Eres un experto en compras públicas, órdenes de compra (OC), licitaciones institucionales y contratos de suministros de pinturas en El Salvador y Centroamérica.

Tu objetivo es leer minuciosamente la Orden de Compra, Bases de Licitación, Solicitud de Cotización o Contrato adjunto y extraer de forma estructurada todos los requisitos para crear el proyecto o cotización automáticamente:
1. "projectName": Nombre o título del proyecto / suministro según la Orden de Compra (si no tiene nombre explícito, constrúyelo con el suministro principal y la institución, ej. "Suministro de Pintura - Alcaldía / Ministerio").
2. "purchaseOrder": Número exacto de la Orden de Compra (OC), Contrato, Libre Gestión o Licitación (ej. "OC-2026-01", "LG-15/2026"). Si no aparece, genera uno descriptivo corto.
3. "customerName": Nombre oficial de la institución, alcaldía, ministerio, hospital o empresa cliente que emite la Orden de Compra.
4. "totalBudget": Monto total en dólares ($) de la Orden de Compra. Si no está explícito el total general, suma los totales de los renglones.
5. Requisitos operativos de la Orden de Compra (si están presentes en el texto):
   - "deliveryDeadline": Plazo o tiempo de entrega requerido (ej. "15 días hábiles después de recibir la OC").
   - "deliveryAddress": Lugar o bodega de recepción donde se debe entregar el producto.
   - "paymentTerms": Condiciones de pago o trámite de Quedan (ej. "Crédito 30 días").
   - "warrantyMonths": Meses de garantía requeridos (en número, ej. 12).
   - "orderRequirements": Requisitos clave de la Orden de Compra (administrador de la orden de compra, teléfono/correo de contacto, requisitos de facturación, muestras, certificados de calidad, etc.).
6. "items": Lista completa de TODOS los renglones / productos solicitados en la Orden de Compra:
   - "code": Código oficial, número de renglón o ítem (ej. "Renglón 1", "001", "Ítem 3"). Si no trae código específico, usa "Renglón 1", "Renglón 2", etc.
   - "description": Nombre y especificación técnica clara (incluye color, acabado, tipo de pintura como látex, esmalte, anticorrosivo, tráfico, epóxica, marca o norma si se especifica).
   - "unit": Unidad de medida (ej. "Cubeta 5 Gal", "Galón", "Kit", "Litro", "Unidad").
   - "quantity": Cantidad exacta solicitada en la OC (número mayor a 0).
   - "unitPrice": Precio unitario adjudicado en la OC (número, o 0 si es solicitud sin precio).
   - "lineTotal": Monto total del renglón (quantity * unitPrice).
7. "summary": Breve resumen ejecutivo de la Orden de Compra y sus requisitos principales.

Revisa todas las tablas, párrafos y cláusulas del documento para no omitir ningún renglón ni requisito de la Orden de Compra.`;

    let promptPayload: any[] = [];

    if (isWordDoc) {
      let extractedContent = input.extractedText || '';
      const embeddedImages: { dataUri: string; contentType: string }[] = [];

      if (!extractedContent && input.pdfDataUri) {
        const base64Data = input.pdfDataUri.split('base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');

        try {
          // IMPORTANTE: convertImage evita que mammoth incruste imágenes en Base64 gigantes dentro del HTML
          const htmlResult = await mammoth.convertToHtml(
            { buffer },
            {
              convertImage: mammoth.images.imgElement(async (image: any) => {
                try {
                  const contentType = image.contentType || 'image/png';
                  const imgBase64 = await image.read('base64');
                  // Guardamos hasta 4 imágenes relevantes por si el Word contiene una imagen escaneada de la OC
                  if (embeddedImages.length < 4 && imgBase64 && imgBase64.length > 2000 && imgBase64.length < 5_000_000) {
                    embeddedImages.push({
                      dataUri: `data:${contentType};base64,${imgBase64}`,
                      contentType,
                    });
                  }
                } catch {
                  // Ignorar imagen si no es legible
                }
                return { src: '' };
              }),
            }
          );

          const rawTextResult = await mammoth.extractRawText({ buffer });
          // Limpiar etiquetas <img src=""> vacías y limitar longitud máxima de texto
          const cleanHtml = (htmlResult.value || '')
            .replace(/<img[^>]*>/gi, '')
            .slice(0, 65000);
          const cleanRaw = (rawTextResult.value || '').trim().slice(0, 45000);

          if (cleanRaw.length > 0 || cleanHtml.length > 0) {
            extractedContent = `--- CONTENIDO ESTRUCTURADO (TABLAS Y TEXTO DEL WORD) ---\n${cleanHtml}\n\n--- TEXTO PLANO DEL DOCUMENTO WORD ---\n${cleanRaw}`;
          }
        } catch (wordErr: any) {
          console.warn('Mammoth no pudo abrir el archivo como .docx, aplicando extractor de .doc clásico:', wordErr?.message);
          extractedContent = `--- TEXTO EXTRAÍDO DEL DOCUMENTO WORD (${input.documentName || 'OC.doc'}) ---\n${extractLegacyDocText(buffer)}`;
        }
      }

      // Si el texto extraído viene del cliente pero pudiera traer <img src="data:...">, lo limpiamos por seguridad
      extractedContent = extractedContent.replace(/<img[^>]*src=["']data:[^"']*["'][^>]*>/gi, '');

      if (!extractedContent.trim() && embeddedImages.length === 0) {
        return {
          success: false,
          error: 'El archivo Word parece estar vacío o protegido. Por favor verifique que sea un documento .docx válido.',
        };
      }

      promptPayload.push({
        text: `${systemPrompt}\n\nA continuación se presenta el contenido extraído del archivo Word (${input.documentName || 'Orden_de_Compra.docx'}):\n\n${extractedContent}`,
      });

      // Si el documento Word tiene poco texto o incluye imágenes escaneadas de la orden de compra, las adjuntamos a Gemini multimodal
      for (const img of embeddedImages) {
        promptPayload.push({
          media: { url: img.dataUri, contentType: img.contentType },
        });
      }
    } else {
      // Documento PDF o Imagen
      let cleanDataUri = input.pdfDataUri!;
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
      output: { schema: AiTenderParserRawOutputSchema },
    });

    const raw = result.output;
    if (!raw) {
      return {
        success: false,
        error: 'La IA no pudo estructurar los datos del documento. Verifique que el archivo Word o PDF contenga la Orden de Compra o Licitación legible.',
      };
    }

    const normalizedItems: TenderProductItem[] = (raw.items || []).map((it, idx) => {
      const qty = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
      const up = Number(it.unitPrice) >= 0 ? Number(it.unitPrice) : 0;
      const lt = Number(it.lineTotal) > 0 ? Number(it.lineTotal) : qty * up;
      return {
        code: (it.code || `Renglón ${idx + 1}`).trim(),
        description: (it.description || `Producto Renglón ${idx + 1}`).trim(),
        unit: (it.unit || 'Unidad').trim(),
        quantity: qty,
        unitPrice: up,
        lineTotal: lt,
      };
    });

    const computedTotal =
      raw.totalBudget && Number(raw.totalBudget) > 0
        ? Number(raw.totalBudget)
        : normalizedItems.reduce((sum, item) => sum + (item.lineTotal || item.quantity * (item.unitPrice || 0)), 0);

    const cleanOutput: AiTenderParserOutput = {
      projectName: raw.projectName || undefined,
      purchaseOrder: raw.purchaseOrder || undefined,
      customerName: raw.customerName || undefined,
      totalBudget: computedTotal,
      deliveryDeadline: raw.deliveryDeadline || undefined,
      deliveryAddress: raw.deliveryAddress || undefined,
      paymentTerms: raw.paymentTerms || undefined,
      warrantyMonths: raw.warrantyMonths && Number(raw.warrantyMonths) > 0 ? Number(raw.warrantyMonths) : 12,
      orderRequirements: raw.orderRequirements || undefined,
      items: normalizedItems,
      summary: raw.summary || undefined,
    };

    return {
      success: true,
      data: cleanOutput,
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
