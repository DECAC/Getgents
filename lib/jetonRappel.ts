/**
 * Jetons SIGNÉS des liens d'un e-mail de rappel d'expiration (lot
 * « Partager », étape 2). Module pur : la clé est passée en paramètre.
 *
 * Un jeton dit quoi faire (prolonger un lien, prolonger tout ce qui expirait
 * dans une fenêtre, ne plus recevoir de rappels), POUR QUEL COMPTE, et
 * jusqu'à quand. Il ouvre une page de CONFIRMATION : le simple fait de le
 * lire ne change rien — les messageries d'entreprise ouvrent les liens pour
 * les analyser, un lien qui agirait au chargement serait déclenché sans que
 * l'auteur l'ait voulu. Seul le bouton de la page (un POST) agit.
 *
 * Pas de connexion : l'action est peu risquée (elle ne fait que prolonger les
 * liens du compte, ou couper les rappels), et un lien d'e-mail à usage unique
 * pour s'authentifier serait plus lourd que le mal qu'il prévient.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { JOUR_MS } from "./dureeLien";

export type ActionRappel =
  | { t: "p"; u: string; j: string }
  | { t: "pt"; u: string; de: number; a: number }
  | { t: "d"; u: string };

export type JetonRappel = ActionRappel & { e: number };

/** Validité d'un lien d'e-mail : assez pour agir après coup, pas pour toujours. */
export const VALIDITE_JETON_MS = 14 * JOUR_MS;

const b64 = (b: Buffer) => b.toString("base64url");
const signature = (corps: string, cle: string) => createHmac("sha256", cle).update(`getgents:rappel:${corps}`).digest();

const JETON = /^[A-Za-z0-9_-]{20,64}$/;

export function signerJetonRappel(action: ActionRappel, o: { cle: string; maintenant: number; validiteMs?: number }): string {
  if (!o.cle) throw new Error("clé de signature absente");
  const corps = b64(Buffer.from(JSON.stringify({ ...action, e: o.maintenant + (o.validiteMs ?? VALIDITE_JETON_MS) })));
  return `${corps}.${b64(signature(corps, o.cle))}`;
}

export type LectureJeton = { ok: true; jeton: JetonRappel } | { ok: false; raison: "forme" | "signature" | "expire" };

export function lireJetonRappel(texte: string, cle: string, maintenant: number): LectureJeton {
  const [corps, sig, ...reste] = texte.split(".");
  if (!corps || !sig || reste.length || !cle || corps.length > 1000) return { ok: false, raison: "forme" };
  const attendue = signature(corps, cle);
  const recue = Buffer.from(sig, "base64url");
  if (recue.length !== attendue.length || !timingSafeEqual(recue, attendue)) return { ok: false, raison: "signature" };
  let a: Record<string, unknown>;
  try {
    a = JSON.parse(Buffer.from(corps, "base64url").toString("utf8"));
  } catch {
    return { ok: false, raison: "forme" };
  }
  if (typeof a.e !== "number" || typeof a.u !== "string" || !a.u || a.u.length > 80) return { ok: false, raison: "forme" };
  if (a.e < maintenant) return { ok: false, raison: "expire" };
  if (a.t === "p" && typeof a.j === "string" && JETON.test(a.j)) return { ok: true, jeton: { t: "p", u: a.u, j: a.j, e: a.e } };
  if (a.t === "pt" && typeof a.de === "number" && typeof a.a === "number" && a.a > a.de) return { ok: true, jeton: { t: "pt", u: a.u, de: a.de, a: a.a, e: a.e } };
  if (a.t === "d") return { ok: true, jeton: { t: "d", u: a.u, e: a.e } };
  return { ok: false, raison: "forme" };
}
