/**
 * Choix de la vignette d'aperçu d'un lien (`app/partage/[jeton]/opengraph-image.tsx`).
 * Module PUR : couleur, taille du titre, ligne d'en-tête.
 */

export interface PaletteVignette {
  fond: string;
  fond2: string;
  encre: string;
  accent: string;
  doux: string;
}

export const PALETTES_VIGNETTE: readonly PaletteVignette[] = [
  { fond: "#ff5a7a", fond2: "#ffb347", encre: "#2a1238", accent: "#ff5a7a", doux: "#ffe3e8" },
  { fond: "#5b5bff", fond2: "#00d4c8", encre: "#14143c", accent: "#5b5bff", doux: "#e4e4ff" },
  { fond: "#00b37e", fond2: "#c6f432", encre: "#0f2a20", accent: "#00a372", doux: "#dcf7ea" },
  { fond: "#ff7a1a", fond2: "#ffd23f", encre: "#3a1a05", accent: "#ff6a00", doux: "#fff0dc" },
];

/** Même titre, même couleur ; deux titres différents changent souvent de couleur. */
export function paletteDuTitre(titre: string): PaletteVignette {
  let h = 0;
  for (const c of titre) h = (h * 31 + c.codePointAt(0)!) >>> 0;
  return PALETTES_VIGNETTE[h % PALETTES_VIGNETTE.length];
}

/** Le titre doit tenir dans la carte (860 × 470) : plus il est long, plus il est petit. */
export function tailleTitre(titre: string): number {
  const n = titre.length;
  if (n <= 24) return 88;
  if (n <= 40) return 76;
  if (n <= 60) return 62;
  return 50;
}

/** « UNE PAGE POUR MARIE » — en capitales, raccourcie pour tenir sur une ligne. */
export function enteteVignette(pour: string | null, expire: boolean, langue: "fr" | "en" = "fr"): string {
  const en = langue === "en";
  if (expire) return en ? "A GETGENTS PAGE" : "UNE PAGE GETGENTS";
  if (!pour) return en ? "A PAGE JUST FOR YOU" : "UNE PAGE RIEN QUE POUR VOUS";
  const p = pour.length > 26 ? `${pour.slice(0, 25).trimEnd()}…` : pour;
  return en ? `A PAGE FOR ${p.toLocaleUpperCase("en-GB")}` : `UNE PAGE POUR ${p.toLocaleUpperCase("fr-FR")}`;
}

/** L'étiquette inclinée de la vignette. */
export function etiquetteVignette(etat: "prive" | "protege" | "expire", langue: "fr" | "en" = "fr"): string {
  if (langue === "en") return etat === "expire" ? "link expired" : etat === "protege" ? "psst, code-protected!" : "psst, it's private!";
  return etat === "expire" ? "lien expiré" : etat === "protege" ? "psst, protégé par code !" : "psst, c'est privé !";
}
