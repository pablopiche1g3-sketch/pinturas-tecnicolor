/**
 * Funciones auxiliares para sugerir y unificar vinculaciones inteligentes entre los ítems
 * de facturas de proveedores y los renglones/ítems de la Orden de Compra (OC).
 */
export interface ProductMatchSuggestion {
  invoiceItemIndex: number;
  suggestedProjectCode: string | null;
  confidence: number; // 0 a 100
  reason?: string;
}

export function calculateProductMatches(
  invoiceItems: Array<{ code?: string; description: string; quantity: number; unitPrice?: number; lineTotal?: number }>,
  expectedProducts: Array<{ code: string; description: string; quantity: number; unitPrice?: number }>
): Record<number, string> {
  const result: Record<number, string> = {};

  if (!expectedProducts || expectedProducts.length === 0 || !invoiceItems || invoiceItems.length === 0) {
    return result;
  }

  // CASO CLAVE: Si la Orden de Compra tiene UN SOLO ÍTEM / RENGLÓN (ej. un ítem global o lote donde van varios productos),
  // todos los productos de la factura del proveedor se unifican automáticamente en ese único ítem de la OC.
  if (expectedProducts.length === 1) {
    const singleCode = expectedProducts[0].code;
    invoiceItems.forEach((_, idx) => {
      result[idx] = singleCode;
    });
    return result;
  }

  const normalize = (str: string) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Diccionario ampliado de sinónimos comerciales y técnicos en pinturas y suministros
  const synonymMap: Record<string, string[]> = {
    'cub': ['cubeta', 'cubetas', '5gal', '5 gal', '5gl', '5 gl', '5 galones', 'balde', 'cuveta', '18.9l'],
    'gal': ['galon', 'galones', '1gal', '1 gal', '1gl', '1 gl', 'gal.', '3.78l'],
    'cto': ['cuarto', 'cuartos', '1/4', '0.25gal'],
    'ltx': ['latex', 'vinilica', 'emulsion', 'acrilica', 'acrilico', 'arquitectonica', 'arquitectonico', 'excello', 'excelo', 'super', 'tropical', 'colonial', 'ultralatex', 'satinada', 'mate'],
    'esm': ['esmalte', 'oleo', 'alquidico', 'alquidica', 'aceite', 'kem', 'glo', 'kemglo', 'brillante', 'sintetico', 'metal'],
    'antic': ['anticorrosivo', 'anticorrosiva', 'primer', 'fondo', 'minio', 'cromato', 'oxido', 'aparejo', 'base'],
    'epox': ['epoxico', 'epoxica', 'epoxi', 'catalizador', 'resina', 'poliamida', 'aducto', 'parte a', 'parte b', 'kit'],
    'traf': ['trafico', 'vial', 'senalizacion', 'carretera', 'demarcacion', 'clorocaucho'],
    'solv': ['solvente', 'thinner', 'tiner', 'reductor', 'diluyente', 'aguarras', 'mineral', 'varsol', 'xileno'],
    'imp': ['impermeabilizante', 'elastomerico', 'elastomerica', 'techo', 'cubierta', 'sellador', 'tapagoteras'],
    'acc': ['brocha', 'brochas', 'rodillo', 'rodillos', 'felpa', 'bandeja', 'lija', 'lijas', 'espátula', 'espatula', 'cinta', 'tirro', 'masking'],
    'bl': ['blanco', 'blanca', 'white', 'hueso', 'marfil'],
    'ng': ['negro', 'negra', 'black'],
    'am': ['amarillo', 'amarilla', 'yellow', 'ocre', 'cromo'],
    'az': ['azul', 'blue', 'celeste', 'marino'],
    'rj': ['rojo', 'red', 'oxido', 'colonial', 'teja'],
    'gr': ['gris', 'grey', 'gray', 'perla', 'acero', 'plata'],
    'vd': ['verde', 'green', 'olivo', 'esmeralda'],
    'bg': ['beige', 'arena', 'crema', 'almendra', 'durazno', 'melocoton'],
    'cf': ['cafe', 'marron', 'tabaco', 'caoba', 'nogal', 'barniz', 'tinte'],
  };

  const expandWords = (words: string[]) => {
    const set = new Set<string>(words);
    words.forEach(w => {
      Object.entries(synonymMap).forEach(([key, syns]) => {
        if (w === key || syns.includes(w)) {
          set.add(key);
          syns.forEach(s => set.add(s));
        }
      });
    });
    return Array.from(set);
  };

  invoiceItems.forEach((invItem, idx) => {
    const invCode = normalize(invItem.code || '');
    const invDesc = normalize(invItem.description || '');
    const invWords = expandWords(invDesc.split(' ').filter(w => w.length > 1));

    // 1. Coincidencia directa por código
    if (invCode) {
      const matchByCode = expectedProducts.find(ep => normalize(ep.code) === invCode);
      if (matchByCode) {
        result[idx] = matchByCode.code;
        return;
      }
    }

    // 2. Coincidencia por descripción exacta
    const exactDesc = expectedProducts.find(ep => normalize(ep.description) === invDesc);
    if (exactDesc) {
      result[idx] = exactDesc.code;
      return;
    }

    // 3. Coincidencia semántica con puntuación de palabras y familias de producto
    let bestMatchCode: string | null = null;
    let highestScore = -1;

    expectedProducts.forEach(ep => {
      const epDesc = normalize(ep.description);
      const epWords = expandWords(epDesc.split(' ').filter(w => w.length > 1));

      let sharedCount = 0;
      invWords.forEach(w => {
        if (epWords.includes(w)) sharedCount++;
      });

      const denominator = Math.max(Math.min(invWords.length, epWords.length), 1);
      let score = (sharedCount / denominator) * 100;

      if (invDesc && epDesc && (invDesc.includes(epDesc) || epDesc.includes(invDesc))) {
        score += 40;
      }

      // Si el renglón de la OC es una descripción general (ej. "pintura", "suministro", "lote", "materiales")
      if (/\b(suministro|lote|pinturas|materiales|general|varios|kit|servicio)\b/.test(epDesc)) {
        score += 15;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatchCode = ep.code;
      }
    });

    // Asignar siempre al renglón más cercano de la OC (o al primer renglón si todos tienen score 0)
    // para que los productos de la factura se unifiquen al proyecto por defecto en lugar de irse a excedentes.
    result[idx] = bestMatchCode || expectedProducts[0].code;
  });

  return result;
}
