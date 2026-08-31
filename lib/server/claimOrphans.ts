import { getSupabaseAdmin } from "@/lib/server/supabase";

/**
 * Reprise des gents d'avant les comptes.
 *
 * L'instance a tourné sans notion de propriétaire : les gents en base
 * n'appartiennent à personne. Au tout premier compte créé, ils lui sont
 * attribués — sans quoi le créateur ouvrirait une liste vide dès que les
 * routes se mettront à filtrer (lot 5), et croirait à une perte de données.
 *
 * L'opération n'a lieu qu'UNE FOIS dans la vie de l'instance, garantie par la
 * table `app_bootstrap` à ligne unique. Elle est donc sûre à appeler à chaque
 * connexion : les appels suivants ne font rien.
 */

export type ClaimResult =
  | { statut: "repris"; gents: number }
  | { statut: "deja-fait" }
  | { statut: "indisponible"; detail: string };

export async function claimOrphanGentsOnce(userId: string): Promise<ClaimResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { statut: "indisponible", detail: "supabase_not_configured" };

  const { data, error } = await supabase.rpc("claim_orphan_gents", { p_user: userId });

  if (error) {
    // Migration 010 pas encore exécutée : l'échec ne doit jamais empêcher
    // quelqu'un de se connecter, mais il doit être visible dans les journaux.
    console.error(
      JSON.stringify({
        tag: "getgents:auth",
        event: "claim_orphans_failed",
        code: error.code,
        detail: error.message,
      })
    );
    return { statut: "indisponible", detail: error.message };
  }

  const repris = typeof data === "number" ? data : -1;
  if (repris < 0) return { statut: "deja-fait" };

  console.log(
    JSON.stringify({ tag: "getgents:auth", event: "claim_orphans", gents: repris, user: userId })
  );
  return { statut: "repris", gents: repris };
}
