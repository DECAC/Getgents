import { createHmac } from "crypto";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { lirePage } from "@/lib/server/pages";
import { isBrevoConfigured, sendBrevoEmail } from "@/lib/server/brevo";
import {
  accesValide,
  DELAI_RENVOI_MS,
  DUREE_CODE_MS,
  empreinteCode,
  ENVOIS_MAX,
  ESSAIS_MAX,
  mailCode,
  masquerEmail,
  nouveauCode,
  peutRecevoirCode,
} from "@/lib/accesCode";
import type { ArtefactPartage } from "@/lib/server/artefactsPartages";

/**
 * Accès protégé par code (migration 023). Deux tables NOUVELLES : déployé
 * avant la migration, « table absente » se lit « aucune page protégée » —
 * le comportement d'avant —, et activer la protection échoue en le disant.
 * Toute AUTRE erreur de base refuse l'accès : une panne ne doit pas ouvrir
 * en silence une page protégée.
 */

/** Clé du cookie d'accès, dérivée de SECRET_BOX_KEY (déjà requise en production). */
export function cleAcces(): string {
  const base = process.env.SECRET_BOX_KEY;
  if (base) return createHmac("sha256", base).update("getgents:acces-partage").digest("hex");
  return process.env.NODE_ENV === "production" ? "" : "cle-acces-developpement";
}

const tableAbsente = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|could not find the table/i.test(e.message ?? ""));

interface Etat {
  codeHash: string | null;
  codeExpire: number | null;
  essais: number;
  dernierEnvoi: number | null;
  envois: number;
  valideLe: string | null;
}
interface Memoire {
  protection: Map<string, boolean>;
  acces: Map<string, Etat>;
}
const memoire = (): Memoire => {
  const g = globalThis as unknown as { __accesPartage?: Memoire };
  return (g.__accesPartage ??= { protection: new Map(), acces: new Map() });
};

export class AccesIndisponible extends Error {}

/** La page est-elle protégée ? Lève AccesIndisponible si la base ne répond pas correctement. */
export async function protectionActive(pageId: string | null): Promise<boolean> {
  if (!pageId) return false;
  const sb = getSupabaseAdmin();
  if (!sb) return memoire().protection.get(pageId) === true;
  const { data, error } = await sb.from("pages_protection").select("actif").eq("page_id", pageId).maybeSingle();
  if (tableAbsente(error)) return false;
  if (error) throw new AccesIndisponible(error.message);
  return data?.actif === true;
}

/** Active ou coupe la protection d'une page DE CE COMPTE. */
export async function definirProtection(ownerId: string, pageId: string, actif: boolean): Promise<"ok" | "introuvable" | "migration_manquante"> {
  const page = await lirePage(ownerId, pageId);
  if (!page) return "introuvable";
  const sb = getSupabaseAdmin();
  if (!sb) {
    memoire().protection.set(pageId, actif);
    return "ok";
  }
  const { error } = await sb.from("pages_protection").upsert({ page_id: pageId, actif, updated_at: new Date().toISOString() });
  if (tableAbsente(error)) return "migration_manquante";
  if (error) throw new Error(error.message);
  return "ok";
}

async function lireEtat(jeton: string): Promise<Etat | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return memoire().acces.get(jeton) ?? null;
  const { data, error } = await sb
    .from("acces_partages")
    .select("code_hash, code_expire, essais, dernier_envoi, envois, valide_le")
    .eq("jeton", jeton)
    .maybeSingle();
  if (error) throw new AccesIndisponible(error.message);
  if (!data) return null;
  return {
    codeHash: data.code_hash,
    codeExpire: data.code_expire ? Date.parse(data.code_expire) : null,
    essais: data.essais ?? 0,
    dernierEnvoi: data.dernier_envoi ? Date.parse(data.dernier_envoi) : null,
    envois: data.envois ?? 0,
    valideLe: data.valide_le,
  };
}

async function ecrireEtat(jeton: string, e: Etat): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    memoire().acces.set(jeton, e);
    return;
  }
  const iso = (t: number | null) => (t === null ? null : new Date(t).toISOString());
  const { error } = await sb.from("acces_partages").upsert({
    jeton,
    code_hash: e.codeHash,
    code_expire: iso(e.codeExpire),
    essais: e.essais,
    dernier_envoi: iso(e.dernierEnvoi),
    envois: e.envois,
    valide_le: e.valideLe,
  });
  if (error) throw new Error(error.message);
}

export type Decision = "ouvert" | "code" | "sans_adresse" | "indisponible";

/**
 * Ce que voit le porteur d'un lien. Le cookie d'accès n'est consulté que si
 * la page est protégée ; un lien sans adresse e-mail sur une page protégée
 * est BLOQUÉ — pas ouvert en douce.
 */
export async function decisionAcces(a: Pick<ArtefactPartage, "jeton" | "pageId" | "destinataire">, cookie: string | undefined): Promise<Decision> {
  let protegee: boolean;
  try {
    protegee = await protectionActive(a.pageId);
  } catch (e) {
    console.error(JSON.stringify({ tag: "getgents:acces", event: "protection_illisible", detail: (e as Error).message }));
    return "indisponible";
  }
  if (!protegee) return "ouvert";
  if (!peutRecevoirCode(a.destinataire)) return "sans_adresse";
  return accesValide(cleAcces(), a.jeton, cookie) ? "ouvert" : "code";
}

export type ResultatEnvoi = { ok: true; masque: string } | { ok: false; status: number; erreur: string };

/** Envoie un code au destinataire du lien. Renvoi limité (60 s), envois limités par lien. */
export async function envoyerCode(a: Pick<ArtefactPartage, "jeton" | "destinataire" | "titre">): Promise<ResultatEnvoi> {
  if (!peutRecevoirCode(a.destinataire)) return { ok: false, status: 400, erreur: "Ce lien n'a pas d'adresse e-mail : demandez-en un nouveau." };
  const avant = await lireEtat(a.jeton);
  const maintenant = Date.now();
  if (avant?.dernierEnvoi && maintenant - avant.dernierEnvoi < DELAI_RENVOI_MS) {
    const s = Math.ceil((DELAI_RENVOI_MS - (maintenant - avant.dernierEnvoi)) / 1000);
    return { ok: false, status: 429, erreur: `Un code vient de partir. Attendez ${s} s avant d'en redemander un.` };
  }
  if ((avant?.envois ?? 0) >= ENVOIS_MAX)
    return { ok: false, status: 429, erreur: "Trop de codes demandés pour ce lien. Demandez-en un nouveau à la personne qui vous l'a envoyé." };
  const code = nouveauCode();
  await ecrireEtat(a.jeton, {
    codeHash: empreinteCode(a.jeton, code),
    codeExpire: maintenant + DUREE_CODE_MS,
    essais: 0,
    dernierEnvoi: maintenant,
    envois: (avant?.envois ?? 0) + 1,
    valideLe: avant?.valideLe ?? null,
  });
  const mail = mailCode(a.titre, code);
  // Développement SANS Brevo : le code part dans le journal du serveur, pour
  // exercer le parcours. Jamais en production — là, l'e-mail est obligatoire.
  if (process.env.NODE_ENV !== "production" && !isBrevoConfigured()) {
    console.log(`[getgents:acces] code de développement pour ${a.jeton.slice(0, 6)}… : ${code}`);
    return { ok: true, masque: masquerEmail(a.destinataire) };
  }
  const r = await sendBrevoEmail(a.destinataire, mail.objet, mail.html);
  console.log(JSON.stringify({ tag: "getgents:acces", event: r.ok ? "code_envoye" : "code_non_envoye", note: r.ok ? undefined : r.note }));
  if (!r.ok) return { ok: false, status: 502, erreur: "Le code n'a pas pu être envoyé. Réessayez dans un instant." };
  return { ok: true, masque: masquerEmail(a.destinataire) };
}

export type ResultatVerification = { ok: true } | { ok: false; status: number; erreur: string };

/** Vérifie un code. 5 essais par code : au-delà, il faut en redemander un. */
export async function verifierCode(jeton: string, code: string): Promise<ResultatVerification> {
  const e = await lireEtat(jeton);
  if (!e?.codeHash || !e.codeExpire) return { ok: false, status: 400, erreur: "Demandez d'abord un code." };
  if (e.codeExpire < Date.now()) return { ok: false, status: 400, erreur: "Ce code a expiré : demandez-en un nouveau." };
  if (e.essais >= ESSAIS_MAX) return { ok: false, status: 429, erreur: "Trop d'essais : demandez un nouveau code." };
  if (empreinteCode(jeton, code) !== e.codeHash) {
    await ecrireEtat(jeton, { ...e, essais: e.essais + 1 });
    const reste = ESSAIS_MAX - e.essais - 1;
    return {
      ok: false,
      status: 400,
      erreur: reste > 0 ? `Code incorrect. ${reste} essai${reste > 1 ? "s" : ""} restant${reste > 1 ? "s" : ""}.` : "Code incorrect. Demandez un nouveau code.",
    };
  }
  // Un code ne sert qu'une fois.
  await ecrireEtat(jeton, { ...e, codeHash: null, codeExpire: null, essais: 0, valideLe: new Date().toISOString() });
  console.log(JSON.stringify({ tag: "getgents:acces", event: "code_valide" }));
  return { ok: true };
}

/** Pour la fiche : la date de validation de chaque lien (absent = pas encore validé). */
export async function validations(jetons: string[]): Promise<Record<string, string>> {
  if (!jetons.length) return {};
  const sb = getSupabaseAdmin();
  if (!sb) {
    const r: Record<string, string> = {};
    for (const j of jetons) {
      const v = memoire().acces.get(j)?.valideLe;
      if (v) r[j] = v;
    }
    return r;
  }
  const { data, error } = await sb.from("acces_partages").select("jeton, valide_le").in("jeton", jetons).not("valide_le", "is", null);
  if (error) return {};
  return Object.fromEntries((data ?? []).map((d) => [d.jeton, d.valide_le]));
}
