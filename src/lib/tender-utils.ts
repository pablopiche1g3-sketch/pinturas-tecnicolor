/**
 * Función auxiliar para sugerir vinculaciones inteligentes entre los ítems de una factura
 * y los productos esperados de la licitación.
 */
export interface ProductMatchSuggestion {
  invoiceItemIndex: number;
  suggestedProjectCode: string | null;
  confidence: number; // 0 a 100
  reason?: string;
}

export function calculateProductMatches(
  invoiceItems: Array<{ code?: string; description: string; quantity: number }>,
  expectedProducts: Array<{ code: string; description: string; quantity: number }>
): Record<number, string> {
  const result: Record<number, string> = {};

  if (!expectedProducts || expectedProducts.length === 0) return result;

  const normalize = (str: string) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Diccionario de sinónimos comunes en pinturas institucionales
  const synonymMap: Record<string, string[]> = {
    'cub': ['cubeta', 'cubetas', '5gal', '5 gal', '5 galones', 'balde', 'cuveta'],
    'gal': ['galon', 'galones', '1gal', '1 gal', 'gal.'],
    'ltx': ['latex', 'vinilica', 'emulsion', 'acrilica'],
    'esm': ['esmalte', 'oleo', 'alquidico'],
    'antic': ['anticorrosivo', 'anticorrosiva', 'primer', 'fondo'],
    'traf': ['trafico', 'vial', 'senalizacion'],
    'bl': ['blanco', 'blanca', 'white'],
    'ng': ['negro', 'negra', 'black'],
    'am': ['amarillo', 'amarilla', 'yellow'],
    'az': ['azul', 'blue'],
    'rj': ['rojo', 'red'],
    'gr': ['gris', 'grey', 'gray'],
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
    const invWords = expandWords(invDesc.split(' ').filter(w => w.length > 2));

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

    // 3. Coincidencia semántica con puntuación de palabras
    let bestMatchCode: string | null = null;
    let highestScore = 0;

    expectedProducts.forEach(ep => {
      const epDesc = normalize(ep.description);
      const epWords = expandWords(epDesc.split(' ').filter(w => w.length > 2));

      let sharedCount = 0;
      invWords.forEach(w => {
        if (epWords.includes(w)) sharedCount++;
      });

      const denominator = Math.max(invWords.length, epWords.length, 1);
      let score = (sharedCount / denominator) * 100;

      if (invDesc.includes(epDesc) || epDesc.includes(invDesc)) {
        score += 30;
      }

      if (score > highestScore && score >= 25) {
        highestScore = score;
        bestMatchCode = ep.code;
      }
    });

    if (bestMatchCode) {
      result[idx] = bestMatchCode;
    }
  });

  return result;
}
