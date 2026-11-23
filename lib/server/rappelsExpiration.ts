import { createHmac } from "crypto";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { isBrevoConfigured, sendBrevoEmail } from "@/lib/server/brevo";
import { liensARappeler, marquerRappels } from "@/lib/server/artefactsPartages";
import { orchestrerRappels, type BilanRappels, type DepsRappels } from "@/lib/rappelsExpiration";
import { normaliserNomAffiche } from "@/lib/nomAffiche";

/**
 * Rappel d'expiration : les VRAIES dépendances (Supabase, Brevo) de
 * l'orchestration de `lib/rappelsExpiration.ts`. Appelé par la tâche horaire.
 */

/** Clé des jetons d'e-mail, dérivée de `SECRET_BOX_KEY` (comme le cookie d'accès par code). Vide = pas de rappel. */
export function clePourRappels(): string {
  const base = process.env.SECRET_BOX_KEY;
  if (base) return createHmac("sha256", base).update("getgents:rappel-expiration").digest("hex");
  return process.env.NODE_ENV === "production" ? "" : "cle-rappel-developpement";
}

export const origineDuSite = () => (process.env.NEXT_PUBLIC_APP_URL ?? "https://getgents.ai").replace(/\/+$/, "");

/** Le titulaire d'un compte : adresse CONFIRMÉE seulement, nom affiché, et s'il veut les rappels (activés par défaut). */
export async function auteurDuCompte(ownerId: string): Promise<{ email: string | null; nom: string | null; rappels: boolean }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { email: process.env.NODE_ENV === "production" ? null : "auteur@dev.invalid", nom: null, rappels: true };
  const { data, error } = await sb.auth.admin.getUserById(ownerId);
  if (error || !data?.user) throw new Error(error?.message ?? "compte introuvable");
  const u = data.user;
  return {
    email: u.email_confirmed_at ? (u.email ?? null) : null,
    nom: normaliserNomAffiche(u.user_metadata?.nom_affiche) || null,
    rappels: u.user_metadata?.rappels_expiration !== false,
  };
}

/** Coupe ou rétablit les rappels d'un compte (métadonnées du compte, comme le nom affiché). */
export async function definirRappelsExpirationPour(ownerId: string, actifs: boolean): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return process.env.NODE_ENV !== "production";
  const { data } = await sb.auth.admin.getUserById(ownerId);
  if (!data?.user) return false;
  const { error } = await sb.auth.admin.updateUserById(ownerId, { user_metadata: { ...(data.user.user_metadata ?? {}), rappels_expiration: actifs } });
  return !error;
}

export function depsReelles(): DepsRappels {
  return {
    liens: liensARappeler,
    auteur: auteurDuCompte,
    envoyer: async (to, objet, html) => {
      if (isBrevoConfigured()) return sendBrevoEmail(to, objet, html);
      if (process.env.NODE_ENV !== "production") {
        // Développement sans Brevo : on l'écrit dans le journal, sans l'adresse.
        console.log(JSON.stringify({ tag: "getgents:rappels", event: "rappel_dev", objet }));
        return { ok: true, note: "développement : non envoyé" };
      }
      return { ok: false, note: "Brevo non configuré" };
    },
    marquer: marquerRappels,
    cle: clePourRappels(),
    origine: origineDuSite(),
  };
}

/** Un passage de la tâche horaire. Ne lève jamais : un échec ne doit pas empêcher les routines des gents. */
export async function rappelerExpirations(opts: { maintenant?: number; ignorerFenetre?: boolean; garderMails?: boolean } = {}): Promise<BilanRappels | null> {
  const deps = depsReelles();
  if (!deps.cle) {
    console.error(JSON.stringify({ tag: "getgents:rappels", event: "cle_absente", detail: "SECRET_BOX_KEY absente : aucun rappel envoyé." }));
    return null;
  }
  try {
    const bilan = await orchestrerRappels(opts.maintenant ?? Date.now(), deps, opts);
    if (bilan.fenetre && (bilan.auteurs || bilan.echecs))
      console.log(JSON.stringify({ tag: "getgents:rappels", event: "passage", auteurs: bilan.auteurs, envoyes: bilan.envoyes, echecs: bilan.echecs, ignores: bilan.ignores, liensMarques: bilan.liensMarques }));
    return bilan;
  } catch (e) {
    console.error(JSON.stringify({ tag: "getgents:rappels", event: "passage_echoue", detail: (e as Error).message }));
    return null;
  }
}

export const definirRappelsExpiration = definirRappelsExpirationPour;
