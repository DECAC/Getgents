import { getSupabaseAdmin } from "@/lib/server/supabase";

/** Durée promise dans la politique de confidentialité (« 12 mois »). */
export const CONSERVATION_DEMANDES_JOURS = 365;

/**
 * Efface les demandes d'accès de plus de 12 mois — la durée annoncée aux
 * visiteurs. Appelée par la tâche horaire, comme la purge de l'activité des
 * pages : une durée promise doit être tenue, pas seulement écrite.
 */
export async function purgerDemandesAcces(): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const limite = new Date(Date.now() - CONSERVATION_DEMANDES_JOURS * 24 * 3600 * 1000).toISOString();
  const { error } = await supabase.from("demandes_acces").delete().lt("created_at", limite);
  if (error) throw new Error(error.message);
}
