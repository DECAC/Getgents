/**
 * Assets et libellés de marque Getgents / GetSpace / GetStudio.
 * Fichiers dans /public/brand/ (fond transparent).
 */

export const BRAND_ICON_SRC = "/brand/getgents-icone.png";

export const BRAND_WORDMARK_SRC = {
  getgents: "/brand/getgents-wordmark.png",
  getspace: "/brand/getspace-wordmark.png",
  getstudio: "/brand/getstudio-wordmark.png",
} as const;

export type BrandWordmarkKey = keyof typeof BRAND_WORDMARK_SRC;

/** Libellés produits affichés dans l'UI (texte de secours / aria). */
export const BRAND_LABEL = {
  getgents: "Getgents",
  getspace: "GetSpace",
  getstudio: "GetStudio",
} as const;
