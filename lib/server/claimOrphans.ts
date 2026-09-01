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

/**
 * Scelle sur un compte les invitations qui visaient son adresse.
 *
 * Une invitation vise une ADRESSE tant que personne ne l'a réclamée. Au
 * premier passage du destinataire, on l'attache à son identifiant : sans ce
 * scellement, l'accès resterait accroché à une chaîne de caractères, et une
 * réinscription ultérieure avec l'adresse d'un ancien collègue transférerait
 * ses droits en silence.
 *
 * `confirmedEmail` n'est renseigné QUE pour une adresse vérifiée. C'est la
 * condition qui empêche de s'inscrire avec l'adresse d'autrui pour hériter de
 * ses accès — et c'est pour cela que l'appelant ne doit jamais passer une
 * adresse non confirmée.
 */
export async function sealGrantsForUser(userId: string, confirmedEmail: string | null): Promise<number> {
  if (!confirmedEmail) return 0;

  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;

  const { data, error } = await supabase
    .from("gent_grants")
    .update({ grantee_id: userId, accepted_at: new Date().toISOString() })
    .eq("invited_email", confirmedEmail)
    .is("grantee_id", null)
    .is("revoked_at", null)
    .select("id");

  if (error) {
    console.error(
      JSON.stringify({ tag: "getgents:auth", event: "seal_grants_failed", detail: error.message })
    );
    return 0;
  }
  return (data ?? []).length;
}
