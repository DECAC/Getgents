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
  return null;
}
