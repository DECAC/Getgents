/**
 * Adresse publique d'un gent : `getgents.ai/<slug>`.
 *
 * Le gent public vit à la RACINE du domaine, pas sous un préfixe. C'est ce
 * qui donne une adresse courte et partageable — et ce qui oblige à réserver
 * les noms de l'application elle-même : un gent nommé « builder » rendrait le
 * studio inatteignable, ou plus exactement serait lui-même inatteignable,
 * Next donnant la priorité aux routes statiques sur les dynamiques. Le
 * silence serait pire que le refus : le créateur croirait avoir publié.
 *
 * Module PUR — testable.
 */

/**
 * Noms que l'application s'attribue. Toute route de premier niveau doit
 * figurer ici, y compris celles qui n'existent pas encore mais qu'on se
 * réserve : les ajouter plus tard casserait l'adresse d'un gent déjà publié
 * et déjà indexé.
 */
export const SLUGS_RESERVES = new Set([
  // Routes existantes
  "api", "auth", "builder", "espace", "accueil", "compte", "annuaire", "l",
  "prototype", "connexion", "inscription", "confirmation",
  "mot-de-passe-oublie", "nouveau-mot-de-passe",
  // Fichiers servis à la racine
  "favicon.ico", "robots.txt", "sitemap.xml", "manifest.json", "_next", "pdfjs",
  // Réservations : pages qu'une plateforme finit toujours par avoir
  "a-propos", "aide", "blog", "cgu", "cgv", "confidentialite", "contact",
  "docs", "documentation", "tarifs", "prix", "legal", "mentions-legales",
  "admin", "administration", "dashboard", "settings", "parametres",
  "profil", "profile", "login", "logout", "signup", "signin", "register",
  "new", "nouveau", "search", "recherche", "explore", "explorer",
  "app", "www", "static", "assets", "public", "cdn", "status", "health",
]);

/** Longueurs : assez court pour être dicté, assez long pour être parlant. */
export const SLUG_MIN = 3;
export const SLUG_MAX = 48;

/**
 * Transforme un nom en candidat d'adresse : minuscules, accents dépliés,
 * tout le reste en tirets.
 */
export function toSlug(nom: string): string {
  return nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

export type SlugProbleme = "vide" | "trop-court" | "trop-long" | "reserve" | "format";

/** Ce qui empêche ce slug d'être une adresse publique — ou null s'il convient. */
export function slugProbleme(slug: string): SlugProbleme | null {
  if (!slug) return "vide";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "format";
  if (slug.length < SLUG_MIN) return "trop-court";
  if (slug.length > SLUG_MAX) return "trop-long";
  if (SLUGS_RESERVES.has(slug)) return "reserve";
  return null;
}

export function slugMessage(probleme: SlugProbleme): string {
  switch (probleme) {
    case "vide":
      return "Choisissez une adresse pour votre gent.";
    case "trop-court":
      return `Adresse trop courte : ${SLUG_MIN} caractères au minimum.`;
    case "trop-long":
      return `Adresse trop longue : ${SLUG_MAX} caractères au maximum.`;
    case "reserve":
      return "Cette adresse est réservée par la plateforme. Choisissez-en une autre.";
    case "format":
      return "Lettres non accentuées, chiffres et tirets uniquement, sans tiret au début ni à la fin.";
  }
}

/**
 * Variante libre à partir d'un slug déjà pris. Le suffixe est numéroté et non
 * aléatoire : une adresse doit rester dictable au téléphone.
 */
export function slugSuivant(base: string, pris: Iterable<string>): string {
  const occupes = new Set(pris);
  const racine = base.slice(0, SLUG_MAX - 3);
  if (!occupes.has(base) && !SLUGS_RESERVES.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidat = `${racine}-${i}`;
    if (!occupes.has(candidat) && !SLUGS_RESERVES.has(candidat)) return candidat;
  }
  return `${racine}-${Date.now().toString(36)}`;
}
