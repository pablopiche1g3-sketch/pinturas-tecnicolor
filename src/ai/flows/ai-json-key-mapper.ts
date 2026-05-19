'use server';
/**
 * @fileOverview Agente de IA para el mapeo de JSON financieros, optimizado para DTE (Documentos Tributarios Electrónicos) de El Salvador.
 *
 * - aiJsonKeyMapper - Función para el mapeo de llaves.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AiJsonKeyMapperInputSchema = z.object({
  invoiceJsonString: z.string().describe('El JSON crudo del DTE o factura comercial. Puede seguir el formato oficial de El Salvador (emisor, receptor, cuerpoDocumento, resumen).'),
});
export type AiJsonKeyMapperInput = z.infer<typeof AiJsonKeyMapperInputSchema>;

const AiJsonKeyMapperOutputSchema = z.object({
  invoiceNumber: z.string().optional().describe('Número de control o serie del DTE.'),
  issueDate: z.string().optional().describe('Fecha de emisión (YYYY-MM-DD).'),
  supplierName: z.string().optional().describe('Nombre o razón social del emisor/proveedor.'),
  customerName: z.string().optional().describe('Nombre o razón social del receptor/cliente.'),
  items: z.array(z.object({
    description: z.string().optional().describe('Descripción del bien o servicio.'),
    quantity: z.number().optional().describe('Cantidad.'),
    unitPrice: z.number().optional().describe('Precio unitario sin impuestos.'),
    lineTotal: z.number().optional().describe('Monto total de la línea (cantidad * precio).'),
  })).optional().describe('Lista de ítems del cuerpo del documento.'),
  subtotal: z.number().optional().describe('Subtotal o total de operaciones gravadas.'),
  taxAmount: z.number().optional().describe('Monto total de impuestos (IVA, etc.).'),
  totalAmount: z.number().optional().describe('Monto total a pagar.'),
}).describe('Estructura estandarizada de la factura procesada.');
export type AiJsonKeyMapperOutput = z.infer<typeof AiJsonKeyMapperOutputSchema>;

export async function aiJsonKeyMapper(input: AiJsonKeyMapperInput): Promise<AiJsonKeyMapperOutput> {
  return aiJsonKeyMapperFlow(input);
}

const aiJsonKeyMapperPrompt = ai.definePrompt({
  name: 'aiJsonKeyMapperPrompt',
  input: { schema: AiJsonKeyMapperInputSchema },
  output: { schema: AiJsonKeyMapperOutputSchema },
  prompt: `Eres un experto en documentos fiscales de El Salvador (DTE). Tu tarea es mapear un JSON de factura (que puede venir con llaves como "cuerpoDocumento", "resumen", "identificacion") a nuestro esquema estandarizado.
  
  Especial atención a los formatos DTE:
  - "identificacion.numeroControl" o "identificacion.codigoGeneracion" mapean a "invoiceNumber".
  - "emisor.nombre" mapea a "supplierName".
  - "cuerpoDocumento" contiene los "items".
  - "resumen.totalPagar" mapea a "totalAmount".
  
  Si el JSON no es un DTE oficial, usa tu lógica para identificar los campos financieros estándar.
  
  Documento JSON:
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
      throw new Error('No se pudo procesar el formato del JSON suministrado.');
    }
    return output;
  }
);
