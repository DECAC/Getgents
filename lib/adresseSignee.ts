/**
 * Adresses SIGNÉES du domaine de contenu (`lib/domaineContenu.ts`).
 *
 * getgents.ai a vérifié l'accès ; l'adresse le prouve au domaine de contenu,
 * qui n'a ni cookie ni compte. Elle dit QUOI servir (un lien, une page à son
 * propriétaire, un brouillon collé), QUI peut l'encadrer (l'origine de
 * l'application qui a signé) et JUSQU'À QUAND. Une adresse copiée expire
 * seule ; une adresse retouchée ne passe pas.
 *
 * Module pur (la clé est passée en paramètre) — testé sans serveur.
 */

import { createHash, createHmac, timingSafeEqual } from "crypto";
import { origineAppValide } from "./domaineContenu";

/** Durée de validité : de quoi charger le cadre, et le recharger un peu plus tard. */
export const DUREE_ADRESSE_MS = 10 * 60 * 1000;

export type ObjetContenu =
  /** Le document d'un lien de partage (accès vérifié par getgents.ai). */
  | { t: "partage"; j: string }
  /** Une page, pour son propriétaire `u` (aperçu de la fiche, vignettes). */
  | { t: "page"; id: string; u: string }
  /** Un code collé, pas encore enregistré : le corps POSTé doit avoir l'empreinte `h`. */
  | { t: "brouillon"; u: string; h: string };

export type AdresseLue = ObjetContenu & { /** origine autorisée à encadrer */ o: string; /** expiration, ms */ e: number };

const b64 = (b: Buffer) => b.toString("base64url");

function signature(corps: string, cle: string): Buffer {
  return createHmac("sha256", cle).update(`getgents:contenu:${corps}`).digest();
}

export function signerAdresse(objet: ObjetContenu, opts: { cle: string; origineApp: string; maintenant: number; dureeMs?: number }): string {
  if (!opts.cle) throw new Error("clé de signature absente");
  if (!origineAppValide(opts.origineApp)) throw new Error("origine d'application invalide");
  const corps = b64(Buffer.from(JSON.stringify({ ...objet, o: opts.origineApp, e: opts.maintenant + (opts.dureeMs ?? DUREE_ADRESSE_MS) })));
  return `${corps}.${b64(signature(corps, opts.cle))}`;
}

const JETON = /^[A-Za-z0-9_-]{20,64}$/;
const UUID = /^[0-9a-f-]{36}$/i;

/** L'objet signé, ou la raison du refus (journalisée, jamais montrée en détail). */
export function lireAdresse(jeton: string, cle: string, maintenant: number): { ok: true; adresse: AdresseLue } | { ok: false; raison: "forme" | "signature" | "expiree" } {
  const [corps, sig, ...reste] = jeton.split(".");
  if (!corps || !sig || reste.length || !cle || corps.length > 2000) return { ok: false, raison: "forme" };
  const attendue = signature(corps, cle);
  const recue = Buffer.from(sig, "base64url");
  if (recue.length !== attendue.length || !timingSafeEqual(recue, attendue)) return { ok: false, raison: "signature" };
  let a: Record<string, unknown>;
  try {
    a = JSON.parse(Buffer.from(corps, "base64url").toString("utf8"));
  } catch {
    return { ok: false, raison: "forme" };
  }
  if (typeof a.e !== "number" || !origineAppValide(a.o)) return { ok: false, raison: "forme" };
  if (a.e < maintenant) return { ok: false, raison: "expiree" };
  const base = { o: a.o as string, e: a.e };
  if (a.t === "partage" && typeof a.j === "string" && JETON.test(a.j)) return { ok: true, adresse: { t: "partage", j: a.j, ...base } };
  if (a.t === "page" && typeof a.id === "string" && UUID.test(a.id) && typeof a.u === "string" && a.u) return { ok: true, adresse: { t: "page", id: a.id, u: a.u, ...base } };
  if (a.t === "brouillon" && typeof a.u === "string" && a.u && typeof a.h === "string" && /^[0-9a-f]{64}$/.test(a.h))
    return { ok: true, adresse: { t: "brouillon", u: a.u, h: a.h, ...base } };
  return { ok: false, raison: "forme" };
}

/** Empreinte d'un brouillon : les champs BRUTS du formulaire, tels que le navigateur les reposte. */
export function empreinteBrouillon(contenu: string, format: string, titre: string): string {
  return createHash("sha256").update(JSON.stringify([contenu, format, titre])).digest("hex");
}
