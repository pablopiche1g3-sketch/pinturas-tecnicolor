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
  documentType: z.string().optional().describe('Tipo de DTE (identificacion.tipoDte). 01: Factura, 03: Crédito Fiscal, 07: Nota de Crédito.'),
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
  relatedDocumentNumber: z.string().optional().describe('Si es Nota de Crédito (07), extrae el códigoGeneracion del documento que modifica (documentoRelacionado[].codigoGeneracion).'),
}).describe('Estructura estandarizada compatible con DTE V3 El Salvador.');
export type AiJsonKeyMapperOutput = z.infer<typeof AiJsonKeyMapperOutputSchema>;

const aiJsonKeyMapperPrompt = ai.definePrompt({
  name: 'aiJsonKeyMapperPrompt',
  input: { schema: AiJsonKeyMapperInputSchema },
  output: { schema: AiJsonKeyMapperOutputSchema },
  prompt: `Eres un experto en la normativa de Facturación Electrónica (DTE) de El Salvador, específicamente en la Versión 3.
  
  Analiza el siguiente JSON y extrae los datos financieros exactos siguiendo estas reglas estrictas de Hacienda:
  - "invoiceNumber": Usa "identificacion.codigoGeneracion". Si no existe, usa "identificacion.numeroControl".
  - "issueDate": Usa "identificacion.fecEmi".
  - "documentType": Usa "identificacion.tipoDte" (01=Factura, 03=CCF, 07=Nota Crédito).
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
  - "relatedDocumentNumber": Si el tipoDte es "07", busca en "documentoRelacionado" el primer "codigoGeneracion".
  
  Asegúrate de manejar todos los números como valores flotantes. Ignora la firma electrónica y concéntrate en los datos de negocio.
  
  Documento JSON a procesar:
  {{{invoiceJsonString}}}`,
});

export async function aiJsonKeyMapper(input: AiJsonKeyMapperInput): Promise<AiJsonKeyMapperOutput> {
  try {
    const { output } = await aiJsonKeyMapperPrompt(input);
    if (!output) {
      throw new Error('El modelo de IA no pudo extraer datos. Verifique el formato del JSON.');
    }
    return output;
  } catch (error: any) {
    console.error('Genkit Error:', error);
    throw new Error(error.message || 'Error interno del servidor al procesar la IA.');
  }
}
