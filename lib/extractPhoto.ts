// Lecture d'une photo côté navigateur, réduite puis décrite par un modèle de
// vision via /api/video/analyze — UNE photo, c'est une vidéo d'une seule
// image : même route, même modèle, aucun chemin de plus.

export interface ExtractedPhoto {
  kind: "photo";
  name: string;
  /** JPEG réduit, en data URL (data:image/jpeg;base64,…). */
  dataUrl: string;
  largeur: number;
  hauteur: number;
}

/** Plus grand côté envoyé au modèle. Au-delà, l'appel s'alourdit pour rien. */
export const MAX_PHOTO_COTE_PX = 1600;
export const QUALITE_PHOTO = 0.85;
/** Taille max du fichier choisi. Une photo d'iPhone en HEIC fait 2 à 6 Mo. */
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

const PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

export function isPhotoFile(file: Pick<File, "name" | "type">): boolean {
  const lower = file.name.toLowerCase();
  if (PHOTO_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
  return file.type.startsWith("image/") && file.type !== "image/svg+xml";
}

/**
 * Dimensions après réduction : le plus grand côté ramené à `max`, proportions
 * gardées. Une image déjà petite n'est jamais agrandie. Pure.
 */
export function dimensionsReduites(largeur: number, hauteur: number, max = MAX_PHOTO_COTE_PX): { largeur: number; hauteur: number } {
  const cote = Math.max(largeur, hauteur);
  if (!cote || cote <= max) return { largeur: Math.round(largeur), hauteur: Math.round(hauteur) };
  const r = max / cote;
  return { largeur: Math.max(1, Math.round(largeur * r)), hauteur: Math.max(1, Math.round(hauteur * r)) };
}

/**
 * Décode la photo, la réduit et la réencode en JPEG. `createImageBitmap`
 * applique l'orientation EXIF : une photo prise en portrait n'arrive pas
 * couchée au modèle.
 */
export async function extrairePhoto(file: File): Promise<ExtractedPhoto> {
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("Cette photo est trop lourde (plus de 25 Mo).");
  }
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Le cas le plus probable : un HEIC sur un navigateur qui ne le lit pas.
    throw new Error(
      "Ce navigateur ne sait pas lire cette photo. Sur iPhone, choisissez-la depuis la photothèque, ou réglez l'appareil photo sur « Le plus compatible » (JPEG)."
    );
  }
  const { largeur, hauteur } = dimensionsReduites(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    image.close();
    throw new Error("Impossible de préparer la photo.");
  }
  ctx.drawImage(image, 0, 0, largeur, hauteur);
  image.close();
  const dataUrl = canvas.toDataURL("image/jpeg", QUALITE_PHOTO);
  return { kind: "photo", name: file.name || "photo.jpg", dataUrl, largeur, hauteur };
}

/**
 * Consigne du modèle de vision pour UNE photo. La vision DÉCRIT, le gent
 * CONCLUT : on veut une description d'expert-témoin — matériaux, état,
 * défauts, ce qui donne l'échelle — et la liste honnête de ce que l'image ne
 * permet pas d'affirmer. Une pente, une profondeur ou ce qui est caché ne se
 * lisent pas sur une photo ; les présenter comme mesurés égarerait le gent.
 * Pure.
 */
export function consigneVisionPhoto(nom?: string): string {
  const titre = nom?.trim() ? ` (« ${nom.trim()} »)` : "";
  return (
    `Tu examines une photo${titre} envoyée par un utilisateur qui pose une question à son assistant. ` +
    "Décris précisément ce qui est VISIBLE : les objets et les matériaux, leur assemblage, leur état (usure, fissure, humidité, " +
    "défaut apparent), les inscriptions et étiquettes lisibles, les mesures lisibles, et ce qui donne une échelle. " +
    "Termine par une rubrique « Ce que la photo ne permet pas d'affirmer » : ce qui est caché, hors champ, ou qui ne se mesure " +
    "pas sur une image (une pente, une profondeur, un aplomb, une conformité). Ne donne ni verdict ni conseil : un expert s'en charge " +
    "à partir de ta description. Réponds en français, de façon factuelle et structurée."
  );
}
