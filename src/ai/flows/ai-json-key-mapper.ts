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
  invoiceNumber: z.string().optional().describe('Código de generación o número de control del DTE.'),
  issueDate: z.string().optional().describe('Fecha de emisión extraída de identificacion.fecEmi (YYYY-MM-DD).'),
  supplierName: z.string().optional().describe('Nombre del emisor.'),
  customerName: z.string().optional().describe('Nombre del receptor.'),
  items: z.array(z.object({
    code: z.string().optional().describe('Código del producto (cuerpoDocumento[].codigo).'),
    description: z.string().optional().describe('Descripción (cuerpoDocumento[].descripcion).'),
    quantity: z.number().optional().describe('Cantidad (cuerpoDocumento[].cantidad).'),
    unitPrice: z.number().optional().describe('Precio unitario (cuerpoDocumento[].precioUni).'),
    lineTotal: z.number().optional().describe('Venta gravada o total de línea (cuerpoDocumento[].ventaGravada).'),
  })).optional().describe('Lista de ítems del cuerpo del documento.'),
  subtotal: z.number().optional().describe('Subtotal de operaciones gravadas (resumen.totalGravada).'),
  taxAmount: z.number().optional().describe('Monto de IVA (resumen.tributos donde codigo sea 20).'),
  retentionAmount: z.number().optional().describe('IVA Retenido (resumen.ivaRete1).'),
  totalAmount: z.number().optional().describe('Monto total a pagar (resumen.totalPagar).'),
}).describe('Estructura estandarizada compatible con DTE V3 El Salvador.');
export type AiJsonKeyMapperOutput = z.infer<typeof AiJsonKeyMapperOutputSchema>;

export async function aiJsonKeyMapper(input: AiJsonKeyMapperInput): Promise<AiJsonKeyMapperOutput> {
  return aiJsonKeyMapperFlow(input);
}

const aiJsonKeyMapperPrompt = ai.definePrompt({
  name: 'aiJsonKeyMapperPrompt',
  input: { schema: AiJsonKeyMapperInputSchema },
  output: { schema: AiJsonKeyMapperOutputSchema },
  prompt: `Eres un experto en la normativa de Facturación Electrónica (DTE) de El Salvador, específicamente en la Versión 3.
  
  Tu objetivo es extraer los datos financieros de un JSON DTE salvadoreño y mapearlos a nuestro esquema. 
  
  Reglas de mapeo para DTE V3:
  - "invoiceNumber": Prioriza "identificacion.codigoGeneracion". Si no existe, usa "identificacion.numeroControl".
  - "issueDate": Usa "identificacion.fecEmi".
  - "supplierName": Usa "emisor.nombre".
  - "customerName": Usa "receptor.nombre".
  - "items": Mapea el array "cuerpoDocumento".
    - "code": "cuerpoDocumento[].codigo".
    - "description": "cuerpoDocumento[].descripcion".
    - "quantity": "cuerpoDocumento[].cantidad".
    - "unitPrice": "cuerpoDocumento[].precioUni".
    - "lineTotal": "cuerpoDocumento[].ventaGravada" o "cuerpoDocumento[].montoItem".
  - "subtotal": Usa "resumen.totalGravada" o "resumen.subTotalVentas".
  - "taxAmount": Suma los montos en "resumen.tributos" donde el código de tributo sea 20 (IVA).
  - "retentionAmount": Usa "resumen.ivaRete1" si está presente.
  - "totalAmount": Usa "resumen.totalPagar".
  
  Si el JSON no sigue la estructura V3 perfectamente, intenta inferir los campos basándote en facturas comerciales estándar de El Salvador.
  
  Documento JSON a procesar:
  {{{invoiceJsonString}}}`,
});

const aiJsonKeyMapperFlow = ai.defineFlow(
  {
    name: 'aiJsonKeyMapperFlow',
    inputSchema: AiJsonKeyMapperInputSchema,
    outputSchema: AiJsonKeyMapperOutputSchema,
  },
  async (input) => {
    const { output } = await aiJsonKeyMapperPrompt(input);
    if (!output) {
      throw new Error('No se pudo procesar el DTE. El formato no es válido o está incompleto.');
    }
    return output;
  }
);
