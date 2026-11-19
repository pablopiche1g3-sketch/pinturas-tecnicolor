'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as mammothModule from 'mammoth';
import JSZip from 'jszip';

const mammoth: typeof mammothModule = (mammothModule as any).default || mammothModule;

const TenderProductSchema = z.object({
  code: z.string().nullable().optional().describe('Código, número de renglón o ítem tal como aparece en la tabla (ej. "1", "Renglón 1", "01", "PINT-01").'),
  description: z.string().describe('Descripción completa y especificación técnica del producto o pintura solicitada en ese renglón.'),
  unit: z.string().nullable().optional().describe('Unidad de medida o presentación (ej. Cubeta 5 Gal, Galón, Caneca, Cuarto, Litro, Kit, Unidad).'),
  quantity: z.number().nullable().optional().describe('Cantidad numérica exacta solicitada en ese renglón.'),
  unitPrice: z.number().nullable().optional().describe('Precio unitario ($) de 1 unidad de ese renglón. No confundir con el total de la línea.'),
  lineTotal: z.number().nullable().optional().describe('Monto total ($) de este renglón (cantidad * precio unitario).'),
  parentCode: z.string().nullable().optional().describe('Código del renglón principal al que pertenece si este ítem es un insumo, accesorio o subcomponente desglosado.'),
  isKit: z.boolean().nullable().optional().describe('true si este renglón es un kit o combo que incluye accesorios/insumos desglosados.'),
});

const AiTenderParserInputSchema = z.object({
  pdfDataUri: z.string().optional().describe('Data URI del archivo Word (.docx/.doc) o PDF de la orden de compra / licitación.'),
  documentName: z.string().optional().describe('Nombre del archivo subido.'),
  extractedText: z.string().optional().describe('Texto o HTML ya extraído del documento Word en el cliente.'),
});
export type AiTenderParserInput = z.infer<typeof AiTenderParserInputSchema>;

const AiTenderParserRawOutputSchema = z.object({
  projectName: z.string().nullable().optional().describe('Nombre del proyecto, proceso de compra, licitación o suministro según la orden de compra.'),
  purchaseOrder: z.string().nullable().optional().describe('Número de Orden de Compra (OC), contrato o código de proceso (ej. OC-01/2026, LG-12/2026, LP-01/2026).'),
  customerName: z.string().nullable().optional().describe('Nombre de la institución gubernamental, alcaldía, ministerio, hospital o empresa compradora.'),
  subtotalAmount: z.number().nullable().optional().describe('Subtotal de los productos antes de IVA si está desglosado en el documento.'),
  taxAmount: z.number().nullable().optional().describe('Monto de IVA (13%) si está desglosado por separado al final de la orden de compra.'),
  totalBudget: z.number().nullable().optional().describe('Monto TOTAL FINAL de la Orden de Compra ($). Debe coincidir con el total general de la orden de compra.'),
  pricesIncludeTax: z.boolean().nullable().optional().describe('true si los precios unitarios de la tabla ya incluyen IVA (o si el total de la orden es igual a la suma directa de los renglones); false si al final se suma el 13% de IVA aparte.'),
  deliveryDeadline: z.string().nullable().optional().describe('Plazo o fecha límite de entrega requerido en la Orden de Compra (ej. "15 días hábiles", "30 de noviembre 2026").'),
  deliveryAddress: z.string().nullable().optional().describe('Lugar, bodega o dirección exacta de entrega estipulada en la Orden de Compra.'),
  paymentTerms: z.string().nullable().optional().describe('Forma o condición de pago (ej. "Crédito 30 días", "Quedan", "Contra entrega").'),
  warrantyMonths: z.number().nullable().optional().describe('Meses de garantía de cumplimiento o buena calidad solicitados (si se indica, ej. 12).'),
  orderRequirements: z.string().nullable().optional().describe('Requisitos especiales de la Orden de Compra: documentos para facturación, horarios de recepción, contacto de bodega, administrador de contrato o condiciones técnicas.'),
  items: z.array(TenderProductSchema).nullable().optional().describe('Lista completa y exhaustiva de TODOS los renglones/productos requeridos en la Orden de Compra, sin omitir ninguno.'),
  summary: z.string().nullable().optional().describe('Breve resumen explicativo de los requisitos y total de renglones extraídos de la orden de compra.'),
});

export type TenderProductItem = {
  code: string;
  description: string;
  unit?: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
  parentCode?: string;
  isKit?: boolean;
};

export type AiTenderParserOutput = {
  projectName?: string;
  purchaseOrder?: string;
  customerName?: string;
  subtotalAmount?: number;
  taxAmount?: number;
  totalBudget?: number;
  pricesIncludeTax?: boolean;
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
 * Decodifica entidades XML básicas en texto de Word OpenXML.
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

/**
 * Extrae las líneas de texto (párrafos <w:p>) dentro de un bloque XML de Word.
 */
function extractParagraphsFromXml(xmlFragment: string): string[] {
  // Eliminar texto borrado por control de cambios (<w:del>...</w:del>)
  const cleaned = xmlFragment.replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/g, '');
  const paragraphs: string[] = [];
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let pMatch: RegExpExecArray | null;

  while ((pMatch = pRegex.exec(cleaned)) !== null) {
    const pContent = pMatch[1]
      .replace(/<w:tab\b[^>]*\/>/g, '\t')
      .replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n');

    const textParts: string[] = [];
    const tRegex = /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      textParts.push(decodeXmlEntities(tMatch[1]));
    }

    const line = textParts.join('').replace(/\s+/g, ' ').trim();
    if (line) {
      paragraphs.push(line);
    }
  }
  return paragraphs;
}

/**
 * Convierte un archivo XML de Word (document.xml, header*.xml, footer*.xml)
 * en una representación estructurada que conserva TODAS las tablas fila por fila
 * y celda por celda, además de todo el texto y cuadros de texto (<w:txbxContent>).
 */
function parseWordOpenXmlPart(xml: string, partTitle: string): string {
  const output: string[] = [];
  const cleanedXml = xml.replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/g, '');

  // 1. Extraer todas las tablas (<w:tbl>) con sus filas (<w:tr>) y celdas (<w:tc>)
  const tblRegex = /<w:tbl\b[^>]*>([\s\S]*?)<\/w:tbl>/g;
  let tblMatch: RegExpExecArray | null;
  let tableIndex = 0;

  while ((tblMatch = tblRegex.exec(cleanedXml)) !== null) {
    tableIndex++;
    const tblXml = tblMatch[1];
    const trRegex = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
    let trMatch: RegExpExecArray | null;
    let rowIndex = 0;
    const tableLines: string[] = [];

    while ((trMatch = trRegex.exec(tblXml)) !== null) {
      const trXml = trMatch[1];
      const tcRegex = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
      let tcMatch: RegExpExecArray | null;
      const cellParagraphLists: string[][] = [];

      while ((tcMatch = tcRegex.exec(trXml)) !== null) {
        const paras = extractParagraphsFromXml(tcMatch[1]);
        cellParagraphLists.push(paras);
      }

      if (cellParagraphLists.every((c) => c.length === 0)) continue;

      // Verificar si esta fila contiene múltiples ítems apilados con saltos de párrafo dentro de una sola fila
      const nonEmptyCells = cellParagraphLists.filter((c) => c.length > 0);
      const maxParas = Math.max(...cellParagraphLists.map((c) => c.length), 0);
      const multiLineCellsCount = nonEmptyCells.filter((c) => c.length > 1).length;

      if (maxParas > 1 && multiLineCellsCount >= 3) {
        // Si todas las celdas con múltiples líneas tienen la misma cantidad de párrafos, expandirlas como sub-filas alineadas
        const counts = nonEmptyCells.filter((c) => c.length > 1).map((c) => c.length);
        const allSameCount = counts.every((c) => c === counts[0]);

        if (allSameCount && counts[0] > 1) {
          const numSubRows = counts[0];
          for (let s = 0; s < numSubRows; s++) {
            rowIndex++;
            const subRowCells = cellParagraphLists.map((c) => {
              if (c.length === numSubRows) return c[s];
              if (c.length === 1 && s === 0) return c[0];
              return c[s] || '';
            });
            tableLines.push(`[Fila ${rowIndex}] | ${subRowCells.join(' | ')} |`);
          }
          continue;
        } else {
          // Numerar cada línea interna (L1, L2...) dentro de cada celda para que la IA no pierda ningún sub-ítem
          rowIndex++;
          const formattedCells = cellParagraphLists.map((paras) => {
            if (paras.length <= 1) return paras[0] || '';
            return paras.map((p, idx) => `(L${idx + 1}: ${p})`).join(' ; ');
          });
          tableLines.push(`[Fila ${rowIndex}] | ${formattedCells.join(' | ')} |`);
          continue;
        }
      }

      rowIndex++;
      const joinedCells = cellParagraphLists.map((paras) => paras.join(' / '));
      tableLines.push(`[Fila ${rowIndex}] | ${joinedCells.join(' | ')} |`);
    }

    if (tableLines.length > 0) {
      output.push(`=== ${partTitle} - TABLA #${tableIndex} (${tableLines.length} filas) ===\n${tableLines.join('\n')}`);
    }
  }

  // 2. Extraer todos los párrafos generales del documento (incluyendo cuadros de texto y encabezados)
  const allParagraphs = extractParagraphsFromXml(cleanedXml);
  if (allParagraphs.length > 0) {
    output.push(`=== ${partTitle} - TEXTO COMPLETO EN ORDEN ===\n${allParagraphs.join('\n')}`);
  }

  return output.join('\n\n');
}

/**
 * Extrae el contenido completo de un archivo .docx leyendo directamente el ZIP OpenXML:
 * - word/header*.xml (encabezados con nombre de institución, número de OC, fechas)
 * - word/document.xml (todas las tablas fila por fila, cuadros de texto y cláusulas)
 * - word/footer*.xml (pies de página con totales, firmas o notas)
 */
async function extractCompleteDocxContent(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const sections: string[] = [];

  const fileNames = Object.keys(zip.files).sort();
  const headerFiles = fileNames.filter((f) => /^word\/header\d*\.xml$/i.test(f));
  const footerFiles = fileNames.filter((f) => /^word\/footer\d*\.xml$/i.test(f));

  for (const hf of headerFiles) {
    const xml = await zip.files[hf].async('string');
    const parsed = parseWordOpenXmlPart(xml, `ENCABEZADO (${hf})`);
    if (parsed.trim()) sections.push(parsed);
  }

  if (zip.files['word/document.xml']) {
    const docXml = await zip.files['word/document.xml'].async('string');
    const parsedDoc = parseWordOpenXmlPart(docXml, 'DOCUMENTO PRINCIPAL');
    if (parsedDoc.trim()) sections.push(parsedDoc);
  }

  for (const ff of footerFiles) {
    const xml = await zip.files[ff].async('string');
    const parsed = parseWordOpenXmlPart(xml, `PIE DE PÁGINA (${ff})`);
    if (parsed.trim()) sections.push(parsed);
  }

  return sections.join('\n\n');
}

/**
 * Extrae texto legible de un archivo binario .doc antiguo (Word 97-2003)
 * combinando secuencias ASCII/Latin1 y UTF-16LE.
 */
function extractLegacyDocText(buffer: Buffer): string {
  const chunks: string[] = [];

  const utf16 = buffer.toString('utf16le');
  const utf16Matches = utf16.match(/[\x20-\x7E\xA0-\xFF\n\r\t]{6,}/g) || [];
  const validUtf16 = utf16Matches
    .map((s) => s.trim())
    .filter((s) => /[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9]{2,}/.test(s));
  if (validUtf16.length > 0) {
    chunks.push(validUtf16.join('\n'));
  }

  const latin1 = buffer.toString('latin1');
  const latinMatches = latin1.match(/[\x20-\x7E\xA0-\xFF]{6,}/g) || [];
  const validLatin = latinMatches
    .map((s) => s.trim())
    .filter((s) => /[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9]{2,}/.test(s) && !/^(Root Entry|WordDocument|SummaryInformation|CompObj|Microsoft)/.test(s));
  if (validLatin.length > 0) {
    chunks.push(validLatin.join(' '));
  }

  return chunks.join('\n\n').slice(0, 120000);
}

/**
 * Limpia y convierte valores numéricos por si vienen redondeados o necesita reconciliar
 * cantidad, precio unitario y total de línea.
 */
function roundCurrency(val: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
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

    const systemPrompt = `Eres un auditor experto en Órdenes de Compra (OC), Licitaciones y Contratos de Suministro de Pinturas en El Salvador y Centroamérica.

Tu objetivo es extraer CON PRECISIÓN MATEMÁTICA Y SIN OMITIR NINGÚN ÍTEM toda la información de la Orden de Compra o Licitación adjunta:

REGLAS ESTRICTAS E INQUEBRANTABLES PARA LOS ÍTEMS ("items"):
1. EXTRAE ABSOLUTAMENTE TODOS LOS ÍTEMS / RENGLONES:
   - Revisa cada fila ("[Fila 1]", "[Fila 2]", etc.) de todas las tablas del documento de principio a fin.
   - ESTÁ ESTRICTAMENTE PROHIBIDO resumir, agrupar o saltarse renglones. Si el documento tiene 15, 30 o 60 productos, el arreglo "items" DEBE tener exactamente esos 15, 30 o 60 productos.
   - Si dentro de una misma fila o celda hay varios productos o sub-ítems listados (por ejemplo "(L1: ...)", "(L2: ...)" o varios colores/presentaciones con sus propias cantidades y precios), extráelos como ítems individuales.
   - Si una fila es únicamente la continuación de la descripción técnica del renglón inmediatamente anterior (sin nueva cantidad ni nuevo precio), concatena esa descripción al ítem anterior.
   - NO incluyas como ítem las filas de pie de tabla que dicen "SUB-TOTAL", "SUMAS", "IVA 13%", "RETENCIÓN 1%", "TOTAL" o "SON: ... DÓLARES".
2. EXACTITUD EN CANTIDAD, PRECIO UNITARIO Y TOTAL DE LÍNEA DE CADA ÍTEM:
   - "code": El número de ítem, renglón o código exacto de la tabla (ej. "1", "2", "Renglón 1", "PT-01").
   - "description": Descripción completa del producto (tipo de pintura, color, acabado, código o marca solicitada).
   - "unit": Unidad de medida o presentación (ej. "Cubeta", "Galón", "Kit", "Cuarto", "Unidad", "Litro").
   - "quantity": Cantidad numérica exacta de ese ítem.
   - "unitPrice": Precio unitario ($) de UNA sola unidad. ¡CUIDADO! Nunca pongas el total del renglón en "unitPrice". Verifica siempre que (quantity * unitPrice) sea igual a "lineTotal". Si la tabla solo muestra Cantidad y Precio Total del renglón, calcula unitPrice = lineTotal / quantity.
   - "lineTotal": Monto total ($) de ese renglón en la tabla (quantity * unitPrice).

REGLAS ESTRICTAS PARA EL MONTO TOTAL DE LA ORDEN DE COMPRA ("totalBudget"):
1. "subtotalAmount": La suma de los renglones antes de impuestos (si aparece un subtotal antes de IVA).
2. "taxAmount": El monto del 13% de IVA (si aparece desglosado al final de la tabla).
3. "totalBudget": El MONTO TOTAL FINAL DE LA ORDEN DE COMPRA en dólares ($).
   - Busca al final de la tabla de productos la fila "TOTAL", "MONTO TOTAL", "TOTAL ORDEN DE COMPRA", "TOTAL A PAGAR" o el texto en letras ("SON: ... DÓLARES").
   - Verifica matemáticamente: "totalBudget" debe coincidir con la suma de todos los "lineTotal" de los renglones (o con subtotalAmount + taxAmount si los precios de los renglones están sin IVA).
   - ¡NUNCA pongas en "totalBudget" el porcentaje de garantía (10%), ni la retención del 1%, ni el subtotal de una sola página parcial!
4. "pricesIncludeTax": true si la suma directa de los "lineTotal" de cada renglón es igual al "totalBudget" final de la orden; false si los renglones están sin IVA y al final de la orden se les suma el 13% de IVA para llegar al "totalBudget".

DATOS GENERALES Y REQUISITOS DE LA ORDEN DE COMPRA:
- "projectName": Nombre del proyecto o proceso de compra (ej. "Suministro de Pintura para ...").
- "purchaseOrder": Número exacto de la Orden de Compra (OC), Libre Gestión o Contrato.
- "customerName": Nombre de la institución, alcaldía, ministerio, hospital o cliente.
- "deliveryDeadline": Plazo o fecha de entrega.
- "deliveryAddress": Lugar o bodega de entrega.
- "paymentTerms": Condición de pago.
- "warrantyMonths": Meses de garantía.
- "orderRequirements": Administrador de la orden de compra, contacto y requisitos especiales.`;

    let promptPayload: any[] = [];

    if (isWordDoc) {
      let extractedContent = input.extractedText || '';
      const embeddedImages: { dataUri: string; contentType: string }[] = [];

      if (!extractedContent && input.pdfDataUri) {
        const base64Data = input.pdfDataUri.split('base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');

        // 1. Extracción profunda directa del XML OpenXML (.docx) con JSZip (captura encabezados, pies, cuadros de texto y todas las filas de tablas numeradas)
        let openXmlContent = '';
        try {
          openXmlContent = await extractCompleteDocxContent(buffer);
        } catch (zipErr: any) {
          console.warn('No se pudo abrir como ZIP OpenXML (.docx):', zipErr?.message);
        }

        // 2. Extracción complementaria HTML con Mammoth (ignorando imágenes Base64 en el texto pero guardando imágenes escaneadas si las hay)
        let mammothHtml = '';
        try {
          const htmlResult = await mammoth.convertToHtml(
            { buffer },
            {
              convertImage: mammoth.images.imgElement(async (image: any) => {
                try {
                  const contentType = image.contentType || 'image/png';
                  const imgBase64 = await image.read('base64');
                  if (embeddedImages.length < 4 && imgBase64 && imgBase64.length > 2500 && imgBase64.length < 5_000_000) {
                    embeddedImages.push({
                      dataUri: `data:${contentType};base64,${imgBase64}`,
                      contentType,
                    });
                  }
                } catch {
                  // Ignorar error de imagen individual
                }
                return { src: '' };
              }),
            }
          );
          mammothHtml = (htmlResult.value || '').replace(/<img[^>]*>/gi, '').slice(0, 120000);
        } catch (mammothErr: any) {
          console.warn('Mammoth fallback para .doc clásico:', mammothErr?.message);
        }

        if (openXmlContent.trim()) {
          extractedContent = `--- EXTRACCIÓN EXACTA OPENXML DE TABLAS, ENCABEZADOS Y TEXTO DEL WORD ---\n${openXmlContent.slice(0, 180000)}\n\n--- VISTA HTML COMPLEMENTARIA ---\n${mammothHtml}`;
        } else if (mammothHtml.trim()) {
          extractedContent = `--- CONTENIDO HTML DEL DOCUMENTO WORD ---\n${mammothHtml}`;
        } else {
          // Archivo .doc antiguo (Word 97-2003 binario)
          extractedContent = `--- TEXTO EXTRAÍDO DEL DOCUMENTO WORD (.DOC) ---\n${extractLegacyDocText(buffer)}`;
        }
      }

      extractedContent = extractedContent.replace(/<img[^>]*src=["']data:[^"']*["'][^>]*>/gi, '');

      if (!extractedContent.trim() && embeddedImages.length === 0) {
        return {
          success: false,
          error: 'El archivo Word parece estar vacío o protegido. Verifique que el documento contenga la Orden de Compra.',
        };
      }

      promptPayload.push({
        text: `${systemPrompt}\n\nA continuación se presenta el contenido completo extraído del archivo Word (${input.documentName || 'Orden_de_Compra.docx'}):\n\n${extractedContent}`,
      });

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
      config: {
        temperature: 0,
      },
      output: { schema: AiTenderParserRawOutputSchema },
    });

    const raw = result.output;
    if (!raw) {
      return {
        success: false,
        error: 'La IA no pudo estructurar los datos del documento. Verifique que el archivo Word o PDF contenga la Orden de Compra legible.',
      };
    }

    const rawItems = raw.items || [];
    const docTotalRaw = Number(raw.totalBudget) > 0 ? Number(raw.totalBudget) : 0;
    const docSubtotalRaw = Number(raw.subtotalAmount) > 0 ? Number(raw.subtotalAmount) : 0;

    // 1. Primera pasada: normalizar cantidades, precios unitarios y totales de línea
    const normalizedItems: TenderProductItem[] = rawItems.map((it, idx) => {
      const qty = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
      let up = Number(it.unitPrice) >= 0 ? Number(it.unitPrice) : 0;
      let lt = Number(it.lineTotal) >= 0 ? Number(it.lineTotal) : 0;

      if (up === 0 && lt > 0) {
        up = roundCurrency(lt / qty, 4);
      } else if (lt === 0 && up > 0) {
        lt = roundCurrency(qty * up, 2);
      } else if (qty > 1 && up > 0 && lt > 0) {
        // Caso común de error: el documento o la IA colocó el Total de la Línea en "unitPrice" (up === lt con qty > 1)
        if (Math.abs(up - lt) < 0.01) {
          up = roundCurrency(lt / qty, 4);
        } else if (Math.abs(qty * up - lt) > 0.5) {
          // Si qty * up no coincide con lt, verificamos cuál tiene sentido con respecto a lt
          // En tablas de OC, lineTotal es el valor impreso en la última columna y suele ser exacto
          up = roundCurrency(lt / qty, 4);
        }
      }

      return {
        code: (it.code || `Renglón ${idx + 1}`).trim(),
        description: (it.description || `Producto Renglón ${idx + 1}`).trim(),
        unit: (it.unit || 'Unidad').trim(),
        quantity: qty,
        unitPrice: up,
        lineTotal: roundCurrency(lt || qty * up, 2),
      };
    });

    // 2. Segunda pasada: verificar consistencia entre la suma de los renglones y el Monto Total de la Orden de Compra
    const sumLineTotals = roundCurrency(
      normalizedItems.reduce((sum, item) => sum + (item.lineTotal || item.quantity * (item.unitPrice || 0)), 0),
      2
    );

    let finalTotalBudget = sumLineTotals;

    if (docTotalRaw > 0 && sumLineTotals > 0) {
      const diffDirect = Math.abs(docTotalRaw - sumLineTotals);
      const sumPlusIva = roundCurrency(sumLineTotals * 1.13, 2);
      const diffWithIva = Math.abs(docTotalRaw - sumPlusIva);

      if (diffDirect <= 2.0) {
        // El total del documento coincide exactamente con la suma de los renglones
        finalTotalBudget = docTotalRaw;
      } else if (diffWithIva <= 2.5 || (raw.pricesIncludeTax === false && Math.abs(docSubtotalRaw - sumLineTotals) <= 2.0)) {
        // Los precios unitarios en la tabla estaban SIN IVA y el total de la OC incluye el 13% de IVA:
        // Ajustamos el monto total de la orden al total con IVA del documento
        finalTotalBudget = docTotalRaw;
      } else if (docTotalRaw >= sumLineTotals * 0.85 && docTotalRaw <= sumLineTotals * 1.20) {
        // Si el total explícito del documento está en un rango razonable respecto a los ítems, respetamos el total oficial impreso en la OC
        finalTotalBudget = docTotalRaw;
      } else {
        // Si docTotalRaw era un valor erróneo (ej. garantía 10% o un número suelto), usamos la suma exacta de los renglones
        finalTotalBudget = sumLineTotals;
      }
    } else if (docTotalRaw > 0) {
      finalTotalBudget = docTotalRaw;
    }

    const cleanOutput: AiTenderParserOutput = {
      projectName: raw.projectName || undefined,
      purchaseOrder: raw.purchaseOrder || undefined,
      customerName: raw.customerName || undefined,
      subtotalAmount: docSubtotalRaw || sumLineTotals,
      taxAmount: Number(raw.taxAmount) > 0 ? Number(raw.taxAmount) : undefined,
      totalBudget: finalTotalBudget,
      pricesIncludeTax: raw.pricesIncludeTax ?? true,
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

const InvoiceMatcherInputSchema = z.object({
  projectName: z.string(),
  purchaseOrder: z.string().optional(),
  expectedProducts: z.array(z.object({
    code: z.string(),
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number().optional(),
    unit: z.string().optional(),
  })),
  invoiceItems: z.array(z.object({
    index: z.number(),
    code: z.string().optional(),
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number().optional(),
    lineTotal: z.number().optional(),
  })),
});
export type InvoiceMatcherInput = z.infer<typeof InvoiceMatcherInputSchema>;

const InvoiceMatcherOutputSchema = z.object({
  matches: z.array(z.object({
    invoiceItemIndex: z.number().describe('Índice exacto del ítem de la factura (0, 1, 2...).'),
    matchedProjectCode: z.string().describe('Código exacto del renglón/ítem de la Orden de Compra (expectedProducts[].code) al que pertenece o en el que se unifica este producto.'),
    reason: z.string().describe('Explicación breve en español de por qué este producto de proveedor se unifica en ese ítem de la Orden de Compra.'),
    confidence: z.number().nullable().optional().describe('Porcentaje de confianza (0 a 100).'),
  })),
  unificationSummary: z.string().describe('Resumen claro explicando cómo se unificaron los productos de la factura del proveedor dentro de los ítems de la Orden de Compra.'),
});
export type InvoiceMatcherOutput = z.infer<typeof InvoiceMatcherOutputSchema>;

export type InvoiceMatcherResponse = {
  success: boolean;
  data?: InvoiceMatcherOutput;
  error?: string;
};

/**
 * Server Action con IA (Gemini) que interpreta las descripciones comerciales de las facturas de proveedores
 * y las unifica/vincula con el ítem o renglones correspondientes de la Orden de Compra del proyecto,
 * especialmente cuando un solo ítem de la Orden de Compra agrupa varios productos distintos.
 */
export async function aiInvoiceProjectMatcher(input: InvoiceMatcherInput): Promise<InvoiceMatcherResponse> {
  try {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'Falta configurar GEMINI_API_KEY.' };
    }

    if (!input.expectedProducts || input.expectedProducts.length === 0) {
      return { success: false, error: 'El proyecto no tiene renglones configurados en su Orden de Compra.' };
    }

    if (!input.invoiceItems || input.invoiceItems.length === 0) {
      return { success: false, error: 'La factura no contiene ítems para analizar.' };
    }

    const validCodes = input.expectedProducts.map((ep) => ep.code);

    const systemPrompt = `Eres un experto en suministros de pinturas, licitaciones y órdenes de compra institucionales en El Salvador (Pinturas Tecnicolor).

CONTEXTO DEL PROBLEMA QUE DEBES RESOLVER:
Muchas veces la Orden de Compra (OC) del cliente/institución viene con UN SOLO ÍTEM (o pocos renglones generales/compuestos) donde van incluidos varios productos distintos (por ejemplo: un lote de pinturas de varios colores, kits de resina + catalizador + solvente, o un ítem general de suministro de pintura y accesorios).
En cambio, las facturas de los proveedores (Sherwin Williams, Sur, Protecto, ferreterías, etc.) vienen desglosadas con nombres comerciales o códigos de fábrica para cada producto individual.

TU OBJETIVO:
Interpretar semánticamente cada producto de la factura del proveedor y UNIFICARLO (vincularlo) con el renglón/ítem correspondiente de la Orden de Compra del proyecto: "${input.projectName}" (${input.purchaseOrder || 'OC'}).

RENGLONES / ÍTEMS DE LA ORDEN DE COMPRA DEL PROYECTO (Usa únicamente estos códigos exactos en "matchedProjectCode"):
${JSON.stringify(input.expectedProducts, null, 2)}

PRODUCTOS EN LA FACTURA DEL PROVEEDOR A INTERPRETAR Y UNIFICAR:
${JSON.stringify(input.invoiceItems, null, 2)}

REGLAS DE INTERPRETACIÓN Y UNIFICACIÓN:
1. Si la Orden de Compra tiene UN SOLO ÍTEM (${validCodes.length === 1 ? `código "${validCodes[0]}"` : 'o un ítem global/compuesto'}), TODOS los productos de pintura, solventes, catalizadores, bases o accesorios de la factura que formen parte del suministro deben unificarse en ese ítem ("matchedProjectCode": "${validCodes[0]}").
2. Si la Orden de Compra tiene varios renglones, analiza la descripción comercial del proveedor:
   - Vincula cada producto (látex, acrílica, esmalte, aceite, anticorrosivo, epóxico, catalizador, thinner/reductor, tráfico, impermeabilizante, brochas/rodillos) con el renglón de la Orden de Compra al que corresponde técnicamente o del cual es componente/accesorio.
   - Si varios productos de la factura del proveedor pertenecen a un mismo renglón de la Orden de Compra (ej. distintos tonos, o resina + catalizador + reductor para un mismo ítem, o varios productos dentro de un ítem compuesto), asígnales el MISMO "matchedProjectCode" para que queden UNIFICADOS bajo ese renglón de la OC.
3. En "matchedProjectCode" DEBES usar estrictamente uno de estos códigos exactos de la OC: ${JSON.stringify(validCodes)}. (Solo usa "__UNMATCHED__" si un ítem no tiene absolutamente ninguna relación con el proyecto).
4. En "reason", explica brevemente la equivalencia o unificación (ej. "Unificado en ${validCodes[0]}: Pintura látex comercial que forma parte del ítem de la OC").`;

    const result = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      prompt: systemPrompt,
      config: { temperature: 0 },
      output: { schema: InvoiceMatcherOutputSchema },
    });

    if (!result.output) {
      return { success: false, error: 'No se pudo completar la interpretación con IA.' };
    }

    // Asegurar que todos los códigos devueltos existan en expectedProducts
    const fallbackCode = validCodes[0];
    const normalizedMatches = result.output.matches.map((m) => {
      const codeExists = validCodes.some(
        (vc) => vc.trim().toLowerCase() === (m.matchedProjectCode || '').trim().toLowerCase()
      );
      const exactCode =
        validCodes.find((vc) => vc.trim().toLowerCase() === (m.matchedProjectCode || '').trim().toLowerCase()) ||
        (m.matchedProjectCode === '__UNMATCHED__' ? '__UNMATCHED__' : fallbackCode);

      return {
        invoiceItemIndex: m.invoiceItemIndex,
        matchedProjectCode: codeExists ? exactCode : exactCode,
        reason: m.reason || `Unificado al renglón ${exactCode} de la Orden de Compra`,
        confidence: m.confidence ?? 95,
      };
    });

    return {
      success: true,
      data: {
        matches: normalizedMatches,
        unificationSummary: result.output.unificationSummary,
      },
    };
  } catch (error: any) {
    console.error('Error en aiInvoiceProjectMatcher:', error);
    return {
      success: false,
      error: error.message || 'Error al interpretar y unificar los ítems de la factura con la IA.',
    };
  }
}
