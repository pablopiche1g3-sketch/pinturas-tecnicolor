'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ProjectProductContextSchema = z.object({
  code: z.string(),
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number().optional(),
  unit: z.string().optional(),
});

const ProjectChatMessageSchema = z.object({
  sender: z.enum(['user', 'assistant']),
  text: z.string(),
});

const ProjectChatInputSchema = z.object({
  projectName: z.string(),
  purchaseOrder: z.string().optional(),
  customerName: z.string().optional(),
  targetSaleAmount: z.number().optional(),
  existingInstructions: z.string().optional().describe('Reglas e indicaciones activas actualmente guardadas para este proyecto.'),
  expectedProducts: z.array(ProjectProductContextSchema).optional().describe('Renglones oficiales contratados en la Orden de Compra.'),
  trackingSummary: z.string().optional().describe('Resumen de cumplimiento renglón por renglón (comprado, entregado, saldo pendiente).'),
  chatHistory: z.array(ProjectChatMessageSchema).optional().describe('Historial reciente de mensajes de este proyecto.'),
  userMessage: z.string().describe('Nuevo mensaje o indicación que el usuario escribe.'),
});

export type ProjectChatInput = z.infer<typeof ProjectChatInputSchema>;

const ProjectChatOutputSchema = z.object({
  reply: z.string().describe('Respuesta conversacional, clara, profesional y en español para el usuario. Si dio una indicación de unificación o regla, confírmasela de forma entusiasta y explícale cómo se aplicará a las facturas.'),
  isInstruction: z.boolean().describe('true si el usuario aportó una nueva indicación, regla de unificación de productos, condición de proveedor o instrucción operativa para el proyecto.'),
  updatedInstructions: z.string().optional().describe('El texto consolidado y limpio con TODAS las reglas e indicaciones activas para este proyecto (incorporando la nueva regla dada por el usuario de forma concisa y numerada). Si no hubo nueva instrucción, devuelve las existentes.'),
  detectedRuleSummary: z.string().optional().describe('Breve frase resumen de la regla detectada (ej. "Wadfow, llaves y desagües se unifican al Renglón 70211010").'),
});

export type ProjectChatOutput = z.infer<typeof ProjectChatOutputSchema>;

export type ProjectChatResponse = {
  success: boolean;
  data?: ProjectChatOutput;
  error?: string;
};

/**
 * Server Action con IA que actúa como Copiloto inteligente dedicado a un Proyecto Institucional específico.
 * Permite al usuario dar indicaciones extras y reglas de unificación de facturas/ítems,
 * y consultar cualquier duda sobre compras, presupuesto y avance del proyecto.
 */
export async function aiProjectChat(input: ProjectChatInput): Promise<ProjectChatResponse> {
  try {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'Falta configurar GEMINI_API_KEY.' };
    }

    const systemPrompt = `Eres el Copiloto Inteligente de Inteligencia Artificial de Pinturas Tecnicolor asignado EXCLUSIVAMENTE al proyecto institucional:
"${input.projectName}" (Orden de Compra: ${input.purchaseOrder || 'No especificada'}, Cliente: ${input.customerName || 'Institución'}).

DATOS DEL PROYECTO:
- Venta Contratada: $${input.targetSaleAmount ? input.targetSaleAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
- Renglones Oficiales de la Orden de Compra:
${input.expectedProducts && input.expectedProducts.length > 0 ? JSON.stringify(input.expectedProducts, null, 2) : 'No hay renglones cargados aún.'}

ESTADO DE CUMPLIMIENTO / COMPRAS ACTUALES:
${input.trackingSummary || 'Sin resumen de cumplimiento disponible aún.'}

REGLAS E INDICACIONES ACTIVAS GUARDADAS ACTUALMENTE PARA ESTE PROYECTO:
${input.existingInstructions ? input.existingInstructions : '(Ninguna regla registrada todavía)'}

HISTORIAL DE CONVERSACIÓN RECIENTE DE ESTE PROYECTO:
${input.chatHistory && input.chatHistory.length > 0 ? JSON.stringify(input.chatHistory.slice(-8), null, 2) : '(Primera interacción en este proyecto)'}

NUEVO MENSAJE DEL USUARIO:
"${input.userMessage}"

TUS DOS FUNCIONES PRINCIPALES:
1. MEMORIZAR INDICACIONES Y REGLAS DE NEGOCIO PARA ESTE PROYECTO:
   - El usuario te dirá cómo unificar ítems o cómo interpretar las facturas. Por ejemplo:
     * "Los productos Wadfow, las llaves y los sifones son accesorios que van con el ítem de Lavamanos mediano"
     * "Las facturas de Ferretería EPA corresponden al renglón de Barra de Seguridad"
     * "Si viene resina epóxica y catalizador, unifícalos en el renglón 1"
   - Si detectas que el usuario te está dando una indicación o regla:
     * Marca "isInstruction": true.
     * En "updatedInstructions", consolida de manera ordenada, clara y numerada TODAS las reglas (conservando las que ya existían y sumando la nueva de forma impecable).
     * En "detectedRuleSummary", escribe un resumen corto de la nueva regla.
     * En "reply", confirma de manera clara y positiva que la regla ha sido aprendida y memorizada para este proyecto, y que a partir de ahora la IA la usará al procesar facturas y vincular productos.

2. ASISTIR, EXPLICAR Y RESPONDER DUDAS DEL PROYECTO:
   - Responde preguntas sobre montos contratados, renglones, qué productos faltan por comprar, margen, o cómo optimizar las compras.
   - Si la consulta es una pregunta general o duda operativa (no una nueva regla):
     * Marca "isInstruction": false.
     * Deja "updatedInstructions" con las reglas existentes (o el valor actual).
     * Responde de forma muy concisa, analítica y útil en "reply" con formato Markdown (negritas, viñetas si amerita).`;

    const result = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      prompt: systemPrompt,
      config: { temperature: 0.2 },
      output: { schema: ProjectChatOutputSchema },
    });

    if (!result.output) {
      return { success: false, error: 'No se recibió respuesta del Copiloto IA.' };
    }

    return {
      success: true,
      data: result.output,
    };
  } catch (error: any) {
    console.error('Error en aiProjectChat:', error);
    return {
      success: false,
      error: error.message || 'Error al comunicarse con el Copiloto IA del proyecto.',
    };
  }
}
