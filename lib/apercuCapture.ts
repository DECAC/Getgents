/**
 * Aperçu d'un lien par CAPTURE de la page (25/11) — module PUR.
 *
 * Le code d'une page est ARBITRAIRE et la capture l'exécute dans un vrai
 * navigateur, côté serveur. D'où une liste blanche des adresses qu'il peut
 * joindre : http(s) public seulement — jamais localhost, un réseau privé ou
 * l'adresse de métadonnées d'un nuage (169.254.169.254). Limite connue : un
 * nom public qui pointe vers une adresse privée (rebond DNS) n'est pas
 * détecté ici ; le navigateur de capture n'a de toute façon ni cookie ni
 * identifiant à laisser fuir.
 */

export const LARGEUR_CAPTURE = 1200;
export const HAUTEUR_CAPTURE = 630;
/** Au-delà, la capture est abandonnée : la vignette ordinaire reste. */
export const DELAI_CAPTURE_MS = 20_000;
/** Attente maximale du calme réseau (polices, esm.sh pour une page React). */
export const DELAI_RESEAU_MS = 8_000;

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function ipv4Privee(h: string): boolean {
  const m = IPV4.exec(h);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** Le navigateur de capture peut-il joindre cette adresse ? */
export function adresseAutorisee(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol === "data:" || u.protocol === "blob:") return true;
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".invalid")) return false;
  if (ipv4Privee(h)) return false;
  // IPv6 : boucle, lien local, adresses uniques locales, IPv4 encapsulée.
  if (h.includes(":") && (h === "::1" || h === "::" || /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || h.startsWith("::ffff:"))) return false;
  return true;
}

export interface EtatApercu {
  actif: boolean;
  /** Version de la page capturée, null si jamais capturée. */
  version: number | null;
  captureLe: string | null;
}

/** La capture rangée correspond-elle à la version que voient les lecteurs ? */
export const captureAJour = (e: EtatApercu | null, versionPage: number): boolean => !!e && e.version === versionPage;

/** L'aperçu par capture est-il montré dans la vignette du lien ? Jamais sur une page protégée par code. */
export const apercuMontre = (e: EtatApercu | null, versionPage: number, protegee: boolean): boolean =>
  !protegee && !!e?.actif && captureAJour(e, versionPage);

export const cheminCapture = (pageId: string, version: number) => `${pageId}/v${version}.png`;
