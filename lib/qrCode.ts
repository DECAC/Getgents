import qrcode from "qrcode-generator";

/**
 * QR code d'un lien (lot « Partager », 23/11). Module PUR : la matrice, le
 * tracé SVG et les pixels. Calculé dans le NAVIGATEUR de l'auteur — aucun
 * service extérieur, le lien n'est envoyé nulle part.
 *
 * Volontairement simple : noir sur blanc, zone de silence de 4 modules (la
 * norme), correction d'erreur « M ». Un logo ou une couleur au centre se
 * jolifient mais fragilisent la lecture ; on garde ce qui se scanne partout.
 */

export type MatriceQr = boolean[][];
export type NiveauQr = "L" | "M" | "Q" | "H";

/** Zone de silence autour du code, en modules (norme : 4). */
export const MARGE_MODULES = 4;

export function matriceQr(texte: string, niveau: NiveauQr = "M"): MatriceQr {
  const qr = qrcode(0, niveau);
  qr.addData(texte, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => qr.isDark(y, x)));
}

/**
 * Tracé SVG : une ligne `M x y h n v 1 h -n z` par série de modules noirs
 * d'une même ligne. Coordonnées entières, marge comprise.
 */
export function cheminQr(m: MatriceQr, marge: number = MARGE_MODULES): string {
  const parts: string[] = [];
  m.forEach((ligne, y) => {
    let x = 0;
    while (x < ligne.length) {
      if (!ligne[x]) {
        x++;
        continue;
      }
      let fin = x;
      while (fin < ligne.length && ligne[fin]) fin++;
      parts.push(`M${x + marge} ${y + marge}h${fin - x}v1h-${fin - x}z`);
      x = fin;
    }
  });
  return parts.join("");
}

/** Côté du dessin, marge comprise, en modules. */
export const tailleModules = (m: MatriceQr, marge: number = MARGE_MODULES): number => m.length + 2 * marge;

/** Le SVG complet à télécharger : fond blanc, modules noirs, bords nets. */
export function svgDuQr(m: MatriceQr, marge: number = MARGE_MODULES): string {
  const t = tailleModules(m, marge);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" width="${t * 8}" height="${t * 8}" shape-rendering="crispEdges">` +
    `<rect width="${t}" height="${t}" fill="#fff"/><path d="${cheminQr(m, marge)}" fill="#000"/></svg>`
  );
}

/** Échelle ENTIÈRE (pixels par module) qui s'approche d'un côté cible : jamais de module flou. */
export function echelleEntiere(m: MatriceQr, cote: number, marge: number = MARGE_MODULES): number {
  return Math.max(1, Math.round(cote / tailleModules(m, marge)));
}

/** Pixels RGBA du QR à l'échelle donnée : pour le canevas du navigateur, et pour relire le code dans les tests. */
export function pixelsDuQr(m: MatriceQr, echelle: number, marge: number = MARGE_MODULES): { largeur: number; data: Uint8ClampedArray<ArrayBuffer> } {
  const largeur = tailleModules(m, marge) * echelle;
  const data = new Uint8ClampedArray(new ArrayBuffer(largeur * largeur * 4)).fill(255);
  for (let y = 0; y < m.length; y++)
    for (let x = 0; x < m.length; x++) {
      if (!m[y][x]) continue;
      for (let dy = 0; dy < echelle; dy++)
        for (let dx = 0; dx < echelle; dx++) {
          const i = (((y + marge) * echelle + dy) * largeur + (x + marge) * echelle + dx) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
    }
  return { largeur, data };
}

/** Nom de fichier ASCII : « qr-marie-dupont.png ». */
export function nomFichierQr(destinataire: string, extension: "png" | "svg"): string {
  const base = destinataire
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `qr-${base || "page"}.${extension}`;
}
