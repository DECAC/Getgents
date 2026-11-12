/**
 * Accès protégé par code (Pages / GetSite) — module PUR : constantes, code,
 * masquage d'adresse, cookie signé. Le stockage vit dans
 * lib/server/accesPartage.ts.
 *
 * Le destinataire d'un lien protégé reçoit un code à 6 chiffres à l'adresse
 * À LAQUELLE LE LIEN A ÉTÉ ADRESSÉ — il ne la tape pas : un lien transféré
 * envoie donc le code au vrai destinataire, pas à celui qui l'a reçu.
 */

import { createHash, createHmac, randomInt, timingSafeEqual } from "crypto";
import { estAdresseEmail } from "./mcpPartage";

export const DUREE_CODE_MS = 10 * 60 * 1000;
export const ESSAIS_MAX = 5;
export const DELAI_RENVOI_MS = 60 * 1000;
/** Au-delà, plus d'envoi pour ce lien (une boîte ne doit pas être bombardée). */
export const ENVOIS_MAX = 10;
export const DUREE_ACCES_MS = 30 * 24 * 3600 * 1000;

export const nouveauCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/** Empreinte liée au lien : un code d'un lien ne vaut rien pour un autre. */
export const empreinteCode = (jeton: string, code: string) => createHash("sha256").update(`${jeton}:${code}`).digest("hex");

/** Ce que l'utilisateur tape, ramené à 6 chiffres (espaces et tirets tolérés), ou null. */
export function codeSaisi(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(c) ? c : null;
}

/** « marie.dupont@acme.fr » → « m•••@acme.fr ». Rien d'autre ne sort : ni nom, ni longueur. */
export function masquerEmail(adresse: string): string {
  const [local, domaine] = adresse.trim().split("@");
  if (!local || !domaine) return "•••";
  return `${local[0]}•••@${domaine}`;
}

/** Une protection ne s'applique qu'à un lien adressé à une ADRESSE : sans elle, nulle part où envoyer le code. */
export const peutRecevoirCode = (destinataire: string) => estAdresseEmail(destinataire.trim());

export const nomCookie = (jeton: string) => `gg_acces_${jeton.slice(0, 32)}`;

/** Cookie d'accès : « expiration.signature », la signature couvrant le jeton et l'expiration. */
export function signerAcces(cle: string, jeton: string, expire: number): string {
  const sig = createHmac("sha256", cle).update(`acces:${jeton}:${expire}`).digest("base64url");
  return `${expire}.${sig}`;
}

export function accesValide(cle: string, jeton: string, valeur: string | undefined, maintenant = Date.now()): boolean {
  if (!cle || !valeur) return false;
  const [exp, sig] = valeur.split(".");
  const expire = Number(exp);
  if (!Number.isFinite(expire) || expire < maintenant || !sig) return false;
  const attendue = signerAcces(cle, jeton, expire).split(".")[1];
  const a = Buffer.from(sig);
  const b = Buffer.from(attendue);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Le mail du code : court, sans lien (un lien dans un mail de code apprend à cliquer sur n'importe quoi). */
export function mailCode(titre: string, code: string): { objet: string; html: string } {
  const t = titre.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
  return {
    objet: `Votre code pour ouvrir « ${titre.slice(0, 80)} »`,
    html:
      `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#2a1f19;line-height:1.5">` +
      `<p>Voici votre code pour ouvrir <b>${t}</b> :</p>` +
      `<p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:18px 0">${code}</p>` +
      `<p>Il est valable 10 minutes. Si vous n'avez rien demandé, ignorez simplement cet e-mail.</p>` +
      `<p style="color:#73665f;font-size:13px">Getgents</p></div>`,
  };
}
