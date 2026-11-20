'use server';
/**
 * @fileOverview Agente de IA especializado en DTE (Documentos Tributarios Electrónicos) de El Salvador Versión 3.
 *
 * - aiJsonKeyMapper - Función para el mapeo de llaves de JSON fiscales salvadoreños.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AiJsonKeyMapperInputSchema = z.object({
  invoiceJsonString: z.string().describe('El JSON crudo del DTE o factura comercial. Sigue el formato oficial de Hacienda El Salvador V3.'),
});
export type AiJsonKeyMapperInput = z.infer<typeof AiJsonKeyMapperInputSchema>;

const AiJsonKeyMapperOutputSchema = z.object({
  invoiceNumber: z.string().optional().describe('Código de generación (codigoGeneracion) o número de control (numeroControl) del DTE.'),
  issueDate: z.string().optional().describe('Fecha de emisión extraída de identificacion.fecEmi (YYYY-MM-DD).'),
  documentType: z.string().optional().describe('Tipo de DTE (identificacion.tipoDte). 01: Factura, 03: Crédito Fiscal, 05: Nota de Crédito, 06: Nota de Débito, 07: Retención, 14: Sujeto Excluido.'),
  supplierName: z.string().optional().describe('Nombre del emisor (emisor.nombre).'),
  customerName: z.string().optional().describe('Nombre del receptor (receptor.nombre).'),
  items: z.array(z.object({
    code: z.string().optional().describe('Código del producto (cuerpoDocumento[].codigo).'),
    description: z.string().optional().describe('Descripción (cuerpoDocumento[].descripcion).'),
    quantity: z.number().optional().describe('Cantidad (cuerpoDocumento[].cantidad).'),
    unitPrice: z.number().optional().describe('Precio unitario (cuerpoDocumento[].precioUni).'),
    lineTotal: z.number().optional().describe('Venta gravada de la línea (cuerpoDocumento[].ventaGravada).'),
  })).optional().describe('Lista de ítems del cuerpo del documento.'),
  subtotal: z.number().optional().describe('Subtotal gravado (resumen.totalGravada o resumen.subTotal).'),
  taxAmount: z.number().optional().describe('Monto de IVA (resumen.tributos donde codigo sea 20).'),
  retentionAmount: z.number().optional().describe('IVA Retenido (resumen.ivaRete1).'),
  perceptionAmount: z.number().optional().describe('IVA Percibido (resumen.ivaPerci1).'),
  totalAmount: z.number().optional().describe('Monto total a pagar (resumen.totalPagar).'),
  relatedDocumentNumber: z.string().optional().describe('Si es Nota de Crédito (05) o Débito (06), extrae el códigoGeneracion o numeroDocumento del documento que modifica (documentoRelacionado[].codigoGeneracion o numeroDocumento).'),
  relatedDocumentType: z.string().optional().describe('Tipo del documento relacionado que se modifica (ej. "03" si modifica un Crédito Fiscal, "01" si modifica una Factura).'),
  isCreditNote: z.boolean().optional().describe('true si este documento es una Nota de Crédito (tipoDte "05").'),
  creditNoteReason: z.string().optional().describe('Motivo o razón de la Nota de Crédito (descuento, devolución, resciliación, anulación).'),
}).describe('Estructura estandarizada compatible con DTE V3 El Salvador.');
export type AiJsonKeyMapperOutput = z.infer<typeof AiJsonKeyMapperOutputSchema>;

// Tipo para la respuesta segura desde el servidor
export type AiActionResponse = {
  success: boolean;
  data?: AiJsonKeyMapperOutput;
  error?: string;
};

const aiJsonKeyMapperPrompt = ai.definePrompt({
  name: 'aiJsonKeyMapperPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: AiJsonKeyMapperInputSchema },
  output: { schema: AiJsonKeyMapperOutputSchema },
  prompt: `Eres un experto en la normativa de Facturación Electrónica (DTE) de El Salvador, específicamente en la Versión 3 del Ministerio de Hacienda.
  
  Analiza el siguiente JSON y extrae los datos financieros exactos siguiendo estas reglas estrictas de Hacienda:
  - "invoiceNumber": Usa "identificacion.codigoGeneracion". Si no existe, usa "identificacion.numeroControl".
  - "issueDate": Usa "identificacion.fecEmi".
  - "documentType": Extrae el valor exacto de "identificacion.tipoDte":
    * "01": Factura Consumidor Final
    * "03": Comprobante de Crédito Fiscal (CCF)
    * "05": NOTA DE CRÉDITO
    * "06": Nota de Débito
    * "07": Comprobante de Retención
    * "14": Factura Sujeto Excluido
    REGLA INQUEBRANTABLE PARA NOTAS DE CRÉDITO:
    Si "identificacion.tipoDte" es "05" (o si el documento se titula Nota de Crédito o modifica a otro DTE):
    1. "documentType" TIENE QUE SER OBLIGATORIAMENTE "05".
    2. ESTÁ ESTRICTAMENTE PROHIBIDO clasificarlo como "03" (Crédito Fiscal), aunque en "documentoRelacionado" aparezca que el documento modificado es un Crédito Fiscal ("tipoDocumento": "03").
    3. "isCreditNote" DEBE SER true.
    4. "relatedDocumentNumber": extrae "codigoGeneracion" o "numeroDocumento" de "documentoRelacionado".
    5. "relatedDocumentType": extrae "tipoDocumento" de "documentoRelacionado" (por ejemplo "03").
  - "supplierName": Usa "emisor.nombre".
  - "customerName": Usa "receptor.nombre".
  - "items": Mapea el array "cuerpoDocumento".
    - "code": "cuerpoDocumento[].codigo".
    - "description": "cuerpoDocumento[].descripcion".
    - "quantity": "cuerpoDocumento[].cantidad".
    - "unitPrice": "cuerpoDocumento[].precioUni".
    - "lineTotal": "cuerpoDocumento[].ventaGravada".
  - "subtotal": Usa "resumen.subTotal" o "resumen.totalGravada".
  - "taxAmount": Busca en "resumen.tributos" el objeto donde "codigo" sea "20" y extrae su "valor".
  - "retentionAmount": Usa "resumen.ivaRete1" (si existe y es mayor a 0).
  - "perceptionAmount": Usa "resumen.ivaPerci1" (si existe y es mayor a 0).
  - "totalAmount": Usa "resumen.totalPagar".
  - "creditNoteReason": Si es nota de crédito o ajuste, busca el motivo o descripción en "motivo", "apendice" o similar.
  
  Asegúrate de manejar todos los números como valores flotantes. Ignora la firma electrónica y concéntrate en los datos de negocio.
  
  Documento JSON a procesar:
  {{{invoiceJsonString}}}`,
});

/**
 * Función que envuelve la llamada a la IA con manejo de errores seguro para el cliente.
 */
export async function aiJsonKeyMapper(input: AiJsonKeyMapperInput): Promise<AiActionResponse> {
  try {
    // Verificación explícita de la API Key en el servidor
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { 
        success: false, 
        error: 'Falta la API Key de Google (GOOGLE_GENAI_API_KEY). Por favor configure las variables de entorno.' 
      };
    }

    if (!input.invoiceJsonString || input.invoiceJsonString.trim() === '') {
      return { success: false, error: 'El contenido del archivo JSON está vacío.' };
    }

    // Pre-análisis determinístico del JSON oficial de Hacienda El Salvador
    let parsedDirectly: any = null;
    try {
      parsedDirectly = JSON.parse(input.invoiceJsonString);
    } catch {}

    const directTipoDte = parsedDirectly?.identificacion?.tipoDte ? String(parsedDirectly.identificacion.tipoDte).trim() : null;
    const directDocRel = parsedDirectly?.documentoRelacionado?.[0];
    const directRelatedDocNum = directDocRel?.codigoGeneracion || directDocRel?.numeroDocumento;
    const directRelatedDocType = directDocRel?.tipoDocumento;

    let output = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const result = await aiJsonKeyMapperPrompt(input);
        output = result.output;
        break; // Exito
      } catch (promptError: any) {
        attempts++;
        console.warn(`Intento ${attempts} fallido:`, promptError.message);
        if (attempts >= maxAttempts) {
          throw promptError;
        }
        // Esperar antes del siguiente intento (e.g. 1000ms, 2000ms)
        await new Promise(resolve => setTimeout(resolve, attempts * 1000));
      }
    }
    
    if (!output) {
      return { success: false, error: 'La IA no pudo procesar este archivo. Asegúrese de que sea un DTE V3 válido.' };
    }

    // Salvaguarda Determinística: Si en el JSON dice tipoDte "05", JAMÁS permitir que se marque como "03"
    if (directTipoDte === '05' || output.documentType === '05' || output.isCreditNote) {
      output.documentType = '05';
      output.isCreditNote = true;
      if (!output.relatedDocumentNumber && directRelatedDocNum) {
        output.relatedDocumentNumber = String(directRelatedDocNum).trim();
      }
      if (!output.relatedDocumentType && directRelatedDocType) {
        output.relatedDocumentType = String(directRelatedDocType).trim();
      }
    }

    return { success: true, data: output };
  } catch (error: any) {
    console.error('Error crítico en aiJsonKeyMapper:', error);
    return { 
      success: false, 
      error: error.message || 'Error inesperado al conectar con el servicio de IA. Verifique su conexión.' 
    };
  }
}
