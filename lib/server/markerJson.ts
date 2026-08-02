/**
 * Répare un JSON coupé en cours de route (réponse du modèle tronquée par la
 * limite de tokens) : on retire le dernier élément incomplet, on referme les
 * structures ouvertes, et on recommence tant que ça ne parse pas.
 *
 * Renvoie le texte réparé, ou null si rien d'exploitable n'en sort. Mieux vaut
 * un tableau de bord amputé de sa dernière tuile qu'un échec total.
 */
export function repairTruncatedJson(fragment: string): string | null {
  const closersFor = (s: string): string | null => {
    const stack: string[] = [];
    let inStr = false;
    let esc = false;
    for (const c of s) {
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{") stack.push("}");
      else if (c === "[") stack.push("]");
      else if (c === "}" || c === "]") {
        if (stack.pop() !== c) return null; // structure incohérente
      }
    }
    if (inStr) return null; // chaîne non terminée : on coupera avant
    return stack.reverse().join("");
  };

  /** Position et profondeur de chaque virgule hors chaîne, plus la profondeur finale. */
  const scan = (s: string): { commas: { at: number; depth: number }[]; endDepth: number } => {
    const commas: { at: number; depth: number }[] = [];
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") depth--;
      else if (c === ",") commas.push({ at: i, depth });
    }
    return { commas, endDepth: depth };
  };

  const tryClose = (s: string): string | null => {
    const trimmed = s.replace(/[\s,]+$/, "");
    const closers = closersFor(trimmed);
    if (closers === null) return null;
    try {
      JSON.parse(trimmed + closers);
      return trimmed + closers;
    } catch {
      return null;
    }
  };

  const asIs = tryClose(fragment);
  if (asIs) return asIs;

  const { commas, endDepth } = scan(fragment);
  // L'élément tronqué se trouve au niveau `endDepth` ; la virgule qui l'en
  // sépare est donc au niveau juste au-dessus. Couper à une virgule plus
  // profonde laisserait un objet à moitié écrit dans le résultat.
  for (let depth = endDepth - 1; depth >= 0; depth--) {
    for (let k = commas.length - 1; k >= 0; k--) {
      if (commas[k].depth !== depth) continue;
      const repaired = tryClose(fragment.slice(0, commas[k].at));
      if (repaired) return repaired;
    }
  }
  return null;
}

/** Extrait le JSON équilibré après un marqueur HTML `<!--NAME:`. */
export function extractJsonFromHtmlMarker(raw: string, marker: string): string | null {
  const open = `<!--${marker}:`;
  const start = raw.indexOf(open);
  if (start === -1) return null;

  let i = start + open.length;
  while (i < raw.length && /\s/.test(raw[i])) i++;
  if (raw[i] !== "{") return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = i; j < raw.length; j++) {
    const c = raw[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return raw.slice(i, j + 1);
    }
  }
  // Accolade fermante jamais atteinte : la réponse a été coupée. On tente de
  // récupérer ce qui a été produit plutôt que de tout perdre.
  return repairTruncatedJson(raw.slice(i));
}
