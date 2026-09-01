import { getSupabaseAdmin } from "@/lib/server/supabase";
import { dechiffrer } from "@/lib/server/secretBox";
import type { SourceDeCle } from "@/lib/openRouterKey";

/**
 * Qui paie l'appel en cours — le SEUL endroit du projet qui lit
 * `process.env.OPENROUTER_API_KEY`.
 *
 * Un test de discipline (`__tests__/openRouterDiscipline.test.ts`) vérifie
 * qu'aucun autre fichier ne la lit. Sans cette garde, un chemin ajouté plus
 * tard retomberait silencieusement sur la clé commune, et la plateforme se
 * remettrait à payer pour un builder qui croit régler ses propres appels :
 * une dérive de facturation invisible, le pire résultat possible ici.
 *
 * Le contexte est PASSÉ en paramètre, jamais lu dans un stockage ambiant.
 * Un `AsyncLocalStorage` éviterait de toucher aux signatures — c'est
 * exactement son défaut : un chemin qui oublie d'entrer dans le store hérite
 * du contexte d'un autre, ou de rien, sans que rien ne le signale. Le webhook
 * WhatsApp et le cron n'entrent pas par la même porte que le studio. Un
 * paramètre rend chaque oubli visible : le compilateur refuse de laisser un
 * chemin non traité.
 */

export interface ContexteLlm {
  /**
   * Compte qui paie. `null` sur la clé plateforme sans session identifiée
   * (gent d'avant la reprise, développement local sans Supabase).
   */
  ownerId: string | null;
  /** Vide si aucune clé n'est disponible — l'appelant doit le traiter. */
  cle: string;
  source: SourceDeCle;
}

/** Contexte de repli : clé commune, aucun payeur identifié. */
function platform(ownerId: string | null): ContexteLlm {
  return { ownerId, cle: process.env.OPENROUTER_API_KEY ?? "", source: "plateforme" };
}

export const CONTEXTE_ANONYME: ContexteLlm = { ownerId: null, cle: "", source: "plateforme" };

/** La clé personnelle d'un compte, déchiffrée, ou `null`. */
export async function clePersonnelle(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("user_api_keys")
    .select("ciphertext")
    .eq("user_id", userId)
    .eq("provider", "openrouter")
    .maybeSingle();

  if (error) {
    // Migration 013 pas encore passée, ou base indisponible : on retombe sur
    // la clé plateforme. Refuser ici transformerait une migration oubliée en
    // panne totale de génération.
    console.error(
      JSON.stringify({ tag: "getgents:cle", event: "lecture_echouee", detail: error.message })
    );
    return null;
  }
  if (!data) return null;

  // `dechiffrer` renvoie null si SECRET_BOX_KEY a changé : la clé devient
  // illisible, l'appel retombe sur la plateforme, et le builder ressaisira.
  return dechiffrer(data.ciphertext as string);
}

/** Contexte pour une action déclenchée par un utilisateur identifié. */
export async function contexteForUser(userId: string | null): Promise<ContexteLlm> {
  const perso = await clePersonnelle(userId);
  if (perso) return { ownerId: userId, cle: perso, source: "personnelle" };
  return platform(userId);
}

/**
 * Contexte pour une action déclenchée SANS session : visiteur d'un lien de
 * partage, gent public, message WhatsApp entrant, routine planifiée.
 *
 * C'est le PROPRIÉTAIRE du gent qui paie — et dont le quota est décompté.
 * C'est la vraie protection contre « je publie un gent, dix mille visiteurs
 * vident la clé commune ».
 */
export async function contexteForGent(gentId: string | null | undefined): Promise<ContexteLlm> {
  if (!gentId) return platform(null);
  const supabase = getSupabaseAdmin();
  if (!supabase) return platform(null);

  const { data } = await supabase
    .from("published_gents")
    .select("owner_id")
    .eq("id", gentId)
    .maybeSingle();

  const ownerId = ((data?.owner_id as string | null) ?? null) || null;
  return contexteForUser(ownerId);
}

/**
 * Trace d'un refus d'OpenRouter, SANS jamais supprimer la clé : un 401 peut
 * venir d'une panne côté OpenRouter, et effacer serait irréversible pour
 * l'utilisateur. La page compte affiche cette note à côté de l'indice.
 */
export async function noterEchecCle(ctx: ContexteLlm, status: number): Promise<void> {
  if (ctx.source !== "personnelle" || !ctx.ownerId) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase
    .from("user_api_keys")
    .update({ last_error: `Refus d'OpenRouter (${status}) le ${new Date().toISOString()}` })
    .eq("user_id", ctx.ownerId);
}
