/**
 * OFFRE d'un compte (13/11) — « Getgents Pages » sur invitation.
 *
 * Deux offres : « complète » (gents + pages, sans plafond) et « pages »
 * (la rubrique Pages seule, avec des plafonds). Les comptes complets sont
 * LISTÉS dans `COMPTES_COMPLETS` (identifiants Supabase, séparés par des
 * virgules ou des espaces) ; tout autre compte est « pages ».
 *
 * Variable ABSENTE ou vide : tout le monde est « complet » — c'est l'état
 * d'avant, et ce qui évite de s'enfermer dehors en déployant.
 *
 * La fermeture tient à TROIS niveaux, parce que masquer un bouton ne ferme
 * rien : navigation (menu), middleware (pages des gents → /pages), gardes
 * serveur (`requireUserWithQuota`, `requireGentAccess`, `requireDraftOwner`
 * → 403). Les gents déjà diffusés restent en ligne : leurs VISITEURS ne
 * passent pas par ces gardes.
 *
 * Module PUR, sans dépendance serveur : le middleware (Edge) le lit aussi.
 */

export type Offre = "complete" | "pages";

export interface Plafonds {
  /** Pages non supprimées. */
  pages: number;
  /** Liens qui s'ouvrent encore (ni révoqués, ni expirés). */
  liensActifs: number;
  /** Questions posées à l'assistant de ses pages, depuis le 1er du mois (heure de Paris). */
  questionsParMois: number;
}

/** Plafonds de l'offre « pages » (validés le 13/11). */
export const PLAFONDS_PAGES: Plafonds = { pages: 50, liensActifs: 200, questionsParMois: 500 };

export function comptesComplets(brut: string | undefined | null): Set<string> | null {
  const ids = (brut ?? "")
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return ids.length ? new Set(ids) : null;
}

export function offreDuCompte(userId: string | null | undefined, brut: string | undefined | null): Offre {
  const complets = comptesComplets(brut);
  if (!complets) return "complete";
  return userId && complets.has(userId.toLowerCase()) ? "complete" : "pages";
}

/** Les plafonds d'une offre ; null = aucun. */
export function plafondsDe(offre: Offre): Plafonds | null {
  return offre === "pages" ? PLAFONDS_PAGES : null;
}

/** Pages de l'application réservées aux gents : un compte « pages » est renvoyé vers /pages. */
const CHEMINS_GENTS = [/^\/builder(\/|$)/, /^\/espace(\/|$)/, /^\/apercu(\/|$)/, /^\/accueil$/, /^\/myspace$/];

export function cheminReserveAuxGents(pathname: string): boolean {
  return CHEMINS_GENTS.some((re) => re.test(pathname));
}

export type GenrePlafond = keyof Plafonds;

/** Levée quand une création dépasserait un plafond : le message est fait pour être montré. */
export class PlafondAtteint extends Error {
  constructor(
    public genre: GenrePlafond,
    public limite: number
  ) {
    super(messagePlafond(genre, limite));
    this.name = "PlafondAtteint";
  }
}

export function messagePlafond(genre: GenrePlafond, limite: number): string {
  if (genre === "pages") return `Vous avez atteint ${limite} pages : supprimez-en une pour en créer une nouvelle. Vos pages restent en ligne.`;
  if (genre === "liensActifs") return `Vous avez ${limite} liens actifs : révoquez-en un pour partager à nouveau. Les liens existants continuent de s'ouvrir.`;
  return `L'assistant a répondu à ${limite} questions ce mois-ci : il reprendra le 1er du mois. Vos pages restent lisibles.`;
}

/** Début du mois en cours, heure de Paris, au format AAAA-MM-JJ (les questions sont datées du jour à Paris). */
export function debutDuMois(maintenant: Date = new Date()): string {
  const jour = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(maintenant);
  return `${jour.slice(0, 7)}-01`;
}

/** Message renvoyé par une route des gents à un compte « pages ». */
export const MESSAGE_OFFRE_PAGES = "Votre accès Getgents Pages ne comprend pas les gents.";
