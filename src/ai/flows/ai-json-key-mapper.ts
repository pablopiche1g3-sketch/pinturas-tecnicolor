'use server';
/**
 * @fileOverview An AI agent that intelligently identifies and maps varying financial keys from different JSON invoice and purchase data formats
 * to a standardized internal schema, enabling seamless data import from diverse suppliers and customers.
 *
 * - aiJsonKeyMapper - A function that handles the key mapping process.
 * - AiJsonKeyMapperInput - The input type for the aiJsonKeyMapper function.
 * - AiJsonKeyMapperOutput - The return type for the aiJsonKeyMapper function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AiJsonKeyMapperInputSchema = z.object({
  invoiceJsonString: z.string().describe('The raw JSON string of the invoice or purchase data with varying keys from different sources. This JSON needs to be mapped to a standardized schema.'),
});
export type AiJsonKeyMapperInput = z.infer<typeof AiJsonKeyMapperInputSchema>;

const AiJsonKeyMapperOutputSchema = z.object({
  invoiceNumber: z.string().optional().describe('The unique identifier for the invoice (e.g., invoiceId, billNumber, ref).'),
  issueDate: z.string().optional().describe('The date the invoice was issued (YYYY-MM-DD format preferred) (e.g., date, billingDate, transactionDate).'),
  supplierName: z.string().optional().describe('The name of the supplier or vendor (e.g., vendor, seller, company).'),
  customerName: z.string().optional().describe('The name of the customer or client (e.g., buyer, client, recipient).'),
  items: z.array(z.object({
    description: z.string().optional().describe('Description of the item (e.g., name, itemDescription).'),
    quantity: z.number().optional().describe('Quantity of the item (e.g., qty, count).'),
    unitPrice: z.number().optional().describe('Unit price of the item (e.g., price, costPerUnit).'),
    lineTotal: z.number().optional().describe('Total for this specific line item (quantity * unitPrice) (e.g., itemTotal, amount).'),
  })).optional().describe('A list of items on the invoice (e.g., products, lineItems).'),
  subtotal: z.number().optional().describe('The subtotal amount before tax (e.g., subTotal, netAmount).'),
  taxAmount: z.number().optional().describe('The total tax amount (e.g., tax, vat).'),
  totalAmount: z.number().optional().describe('The grand total amount due for the invoice (e.g., grandTotal, amountDue, total).'),
}).describe('The standardized invoice data after key mapping.');
export type AiJsonKeyMapperOutput = z.infer<typeof AiJsonKeyMapperOutputSchema>;

export async function aiJsonKeyMapper(input: AiJsonKeyMapperInput): Promise<AiJsonKeyMapperOutput> {
  return aiJsonKeyMapperFlow(input);
}

const aiJsonKeyMapperPrompt = ai.definePrompt({
  name: 'aiJsonKeyMapperPrompt',
  input: { schema: AiJsonKeyMapperInputSchema },
  output: { schema: AiJsonKeyMapperOutputSchema },
  prompt: `You are an expert financial data mapper. Your task is to take raw JSON data representing an invoice or purchase and map its keys to a standardized schema.
  
  The standardized schema is described by the output JSON schema below. Your goal is to identify corresponding values in the input JSON and map them to the standardized keys. Pay close attention to common variations for key names (e.g., 'totalAmount', 'grandTotal', 'amountDue' all map to 'totalAmount'). If a field is not present or cannot be confidently mapped, omit it from the output.
  
  Ensure the output is a valid JSON object strictly adhering to the standardized schema. Do not include any additional text or formatting outside of the JSON object.
  
  Input JSON to map:
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
      throw new Error('AI failed to generate a valid output for JSON key mapping.');
    }
    return output;
  }
);
