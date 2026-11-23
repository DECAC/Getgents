// Fichiers JOINTS à une page (musique, photo, vidéo, PDF) — module PUR.
//
// Un connecteur ne reçoit que du TEXTE recopié par le modèle : un mp3 de 5 Mo
// n'y passe pas. Les médias s'ajoutent donc depuis la fiche, et la page les
// référence par leur NOM (« musique.mp3 », ou un chemin qui finit par ce nom,
// comme ceux des artefacts Claude). Au moment de servir le document, chaque
// référence est réécrite vers une adresse signée (`avecFichiers`).

export const FICHIER_MAX = 50 * 1024 * 1024;
export const FICHIERS_TOTAL_MAX = 100 * 1024 * 1024;
export const FICHIERS_MAX = 20;
export const NOM_FICHIER_MAX = 120;

/** Types acceptés : ce qu'une page affiche ou joue. Jamais de HTML ni de script. */
export function typeAccepte(type: string): boolean {
  return /^(image\/(png|jpeg|gif|webp|avif|svg\+xml)|audio\/(mpeg|mp3|mp4|x-m4a|aac|wav|x-wav|wave|ogg|webm|flac)|video\/(mp4|webm|quicktime)|application\/pdf)$/i.test(
    type
  );
}

const EXTENSIONS = "mp3|wav|ogg|oga|m4a|aac|flac|png|jpe?g|gif|webp|avif|svg|mp4|webm|mov|pdf";

export type RefusFichier = "nom" | "type" | "taille" | "nombre" | "total";

export const MESSAGE_FICHIER: Record<RefusFichier, string> = {
  nom: `Nom de fichier invalide (${NOM_FICHIER_MAX} caractères au plus, avec son extension, sans « / »).`,
  type: "Type de fichier non accepté : images, sons, vidéos et PDF seulement.",
  taille: `Fichier trop lourd (${FICHIER_MAX / 1024 / 1024} Mo au plus).`,
  nombre: `Trop de fichiers sur cette page (${FICHIERS_MAX} au plus).`,
  total: `Les fichiers de cette page dépasseraient ${FICHIERS_TOTAL_MAX / 1024 / 1024} Mo.`,
};

export function nomFichierValide(nom: string): boolean {
  if (!nom || nom.length > NOM_FICHIER_MAX) return false;
  if (/[\/\\\u0000-\u001f"'`<>]/.test(nom)) return false;
  if (nom.startsWith(".")) return false;
  return new RegExp(`\\.(${EXTENSIONS})$`, "i").test(nom);
}

/**
 * Un envoi tient-il dans les plafonds ? `existants` : fichiers déjà joints ;
 * un fichier du même nom est REMPLACÉ (sa taille ne compte plus).
 */
export function validerFichier(
  f: { nom: string; type: string; taille: number },
  existants: ReadonlyArray<{ nom: string; taille: number }>
): RefusFichier | null {
  if (!nomFichierValide(f.nom)) return "nom";
  if (!typeAccepte(f.type)) return "type";
  if (!Number.isFinite(f.taille) || f.taille <= 0 || f.taille > FICHIER_MAX) return "taille";
  const autres = existants.filter((e) => e.nom !== f.nom);
  if (autres.length >= FICHIERS_MAX) return "nombre";
  const total = autres.reduce((s, e) => s + e.taille, 0) + f.taille;
  return total > FICHIERS_TOTAL_MAX ? "total" : null;
}

// Un chemin vers un média : pas d'espace, de guillemet, de parenthèse ni de
// chevron ; se termine par une extension connue, suivie d'une fin de chaîne,
// d'un guillemet, d'une parenthèse, d'un espace, de `?` ou de `#`.
const REFERENCE = new RegExp(`[^\\s"'\`()<>=,;]+\\.(?:${EXTENSIONS})(?=[\\s"'\`)<>?#,;]|$)`, "gi");

function estExterne(ref: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(ref);
}

function nomDe(ref: string): string {
  const base = ref.slice(ref.lastIndexOf("/") + 1);
  try {
    return decodeURIComponent(base);
  } catch {
    return base;
  }
}

// Chaîne entre guillemets qui FINIT par un nom de média : espaces, parenthèses et
// virgules permis (« Justice - Flower (ft X, Y) [from Z].mp3 »). La regex
// `REFERENCE` coupait à chacun et ne voyait qu'un bout du nom.
const CHAINE_MEDIA = new RegExp(`(["'\`])((?:(?!\\1)[^\\n<>]){1,200}?\\.(?:${EXTENSIONS}))\\1`, "gi");

const ECHAPPE = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Les écritures possibles d'un nom dans une page : tel quel, encodé, `&amp;` (attribut HTML). */
function variantes(nom: string): string[] {
  return Array.from(new Set([nom, encodeURI(nom), encodeURIComponent(nom), nom.replace(/&/g, "&amp;")]));
}

/**
 * Noms des fichiers LOCAUX que la page référence (src, href, url(), chaînes
 * JS) — ni adresse web, ni `data:`, ni `blob:`. Sert à dire « fichiers
 * attendus » : ce que l'auteur doit joindre pour que la page soit complète.
 */
export function fichiersReferences(contenu: string): string[] {
  const vus = new Set<string>();
  const ajouter = (ref: string) => {
    if (estExterne(ref)) return;
    const nom = nomDe(ref).replace(/&amp;/g, "&");
    if (nomFichierValide(nom)) vus.add(nom);
  };
  // 1. Chaînes entre guillemets (noms longs) ; leur place est ensuite effacée pour que la regex simple n'en ramasse pas un bout.
  const reste = contenu.replace(CHAINE_MEDIA, (m, _q: string, ref: string) => {
    ajouter(ref);
    return " ".repeat(m.length);
  });
  // 2. Références simples : url(fond.png), src sans guillemets, noms sans espace.
  for (const m of Array.from(reste.matchAll(REFERENCE))) ajouter(m[0]);
  return Array.from(vus);
}

/** Regex qui reconnaît, dans une page, UN des noms donnés (toutes variantes), avec son chemin éventuel. */
function regexDesNoms(noms: readonly string[]): { re: RegExp; parVariante: Map<string, string> } {
  const parVariante = new Map<string, string>();
  for (const nom of noms) for (const v of variantes(nom)) if (!parVariante.has(v)) parVariante.set(v, nom);
  const alternatives = Array.from(parVariante.keys())
    .sort((a, b) => b.length - a.length)
    .map(ECHAPPE)
    .join("|");
  // Préfixe de chemin facultatif (`/mnt/user-data/uploads/`) ; un début de mot devant le nom l'exclut.
  const re = new RegExp(`(?<![\\w%.\\-])([^\\s"'\`<>()=,;]*/)?(${alternatives})(?![A-Za-z0-9_%])`, "g");
  return { re, parVariante };
}

/**
 * Réécrit chaque référence à un fichier JOINT vers son adresse (signée).
 * La recherche est LITTÉRALE sur le nom du fichier : espaces, parenthèses,
 * virgules, accents, `%20` et `&amp;` sont reconnus. Une adresse externe
 * (`https://…/nom.mp3`) n'est jamais touchée, même si elle finit par le même nom.
 */
export function avecFichiers(contenu: string, fichiers: ReadonlyArray<{ nom: string; url: string }>): string {
  if (fichiers.length === 0) return contenu;
  const urls = new Map(fichiers.map((f) => [f.nom, f.url]));
  const { re, parVariante } = regexDesNoms(fichiers.map((f) => f.nom));
  return contenu.replace(re, (tout, prefixe: string | undefined, variante: string) => {
    if (prefixe && estExterne(prefixe)) return tout;
    return urls.get(parVariante.get(variante) ?? "") ?? tout;
  });
}

/** Parmi `noms`, ceux que la page appelle réellement (même reconnaissance que la réécriture). */
export function fichiersUtilises(contenu: string, noms: readonly string[]): string[] {
  if (noms.length === 0) return [];
  const { re, parVariante } = regexDesNoms(noms);
  const trouves = new Set<string>();
  for (const m of Array.from(contenu.matchAll(re))) {
    if (m[1] && estExterne(m[1])) continue;
    const nom = parVariante.get(m[2]);
    if (nom) trouves.add(nom);
  }
  return Array.from(trouves);
}

export function tailleLisible(octets: number): string {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

const TYPES_PAR_EXTENSION: Record<string, string> = {
  mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif", svg: "image/svg+xml",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", pdf: "application/pdf",
};

/** Type d'un fichier d'après son nom, quand le navigateur n'en donne pas (fréquent pour .m4a, .flac). */
export function typeDepuisNom(nom: string): string {
  return TYPES_PAR_EXTENSION[nom.slice(nom.lastIndexOf(".") + 1).toLowerCase()] ?? "";
}
