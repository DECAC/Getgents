/**
 * Domaine de CONTENU des pages partagées (13/11) — défense en profondeur.
 *
 * Le document d'une page (code arbitraire écrit par l'auteur) est déjà isolé
 * par la CSP `sandbox` sans `allow-same-origin`. Le servir depuis un AUTRE
 * site (`getgents-pages.com`) ajoute une seconde barrière : une faille du bac
 * à sable n'atteindrait toujours pas getgents.ai, et une page malveillante
 * signalée par Google ferait marquer ce domaine-là, pas l'application.
 *
 * Le cadre ne reçoit pas les cookies de getgents.ai (cookies tiers, bloqués
 * par Safari et Chrome sur iPhone). Il ne s'en sert donc plus : getgents.ai
 * vérifie l'accès (cookie du code, session du propriétaire), puis REDIRIGE le
 * cadre vers une adresse SIGNÉE, valable quelques minutes. Le domaine de
 * contenu ne connaît ni compte ni cookie : il vérifie la signature et sert le
 * document. Toute autre adresse y répond 404.
 *
 * Sans `DOMAINE_CONTENU`, rien ne change : tout reste servi par getgents.ai.
 *
 * Module PUR, sans `node:crypto` : il est lu aussi par le middleware (Edge).
 */

export const CHEMIN_CONTENU = "/api/contenu/";

export interface DomaineContenu {
  /** Hôte tel que l'en-tête `Host` le porte (port compris en développement). */
  hote: string;
  /** Hôte sans port : ce que compare une règle `has: host` de Next. */
  nom: string;
  /** `https://getgents-pages.com` — `http://` pour 127.0.0.1 / localhost seulement. */
  origine: string;
}

const LOCAL = /^(localhost|127\.0\.0\.1)$/;

/** Lit `DOMAINE_CONTENU`. Null si absent ou mal formé : on garde alors le comportement d'avant. */
export function lireDomaineContenu(brut: string | undefined | null): DomaineContenu | null {
  const v = (brut ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!v) return null;
  const m = v.match(/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*)(?::(\d{2,5}))?$/);
  if (!m) return null;
  const nom = m[1];
  if (!LOCAL.test(nom) && !nom.includes(".")) return null;
  if (m[2] && !LOCAL.test(nom)) return null;
  return { hote: v, nom, origine: `${LOCAL.test(nom) ? "http" : "https"}://${v}` };
}

/** Origine d'application acceptée comme `frame-ancestors` du document : https, ou localhost en développement. */
export function origineAppValide(o: unknown): o is string {
  return typeof o === "string" && /^(https:\/\/[a-z0-9.-]+|http:\/\/(localhost|127\.0\.0\.1))(:\d{2,5})?$/.test(o);
}

/** La requête vise-t-elle le domaine de contenu ? */
export function estDomaineContenu(hote: string | null | undefined, d: DomaineContenu | null): boolean {
  return !!d && !!hote && hote.toLowerCase() === d.hote;
}
