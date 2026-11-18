import { etatDesInscriptions, lirePlafondInscriptions, type EtatInscriptions } from "@/lib/inscriptions";
import { getSupabaseAdmin } from "@/lib/server/supabase";

/** Développement sans Supabase : un compteur en mémoire, perdu au redémarrage. */
const memoire = globalThis as unknown as { __getgentsInscriptions?: number };

export function journalInscription(event: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ tag: "getgents:inscription", event, ...extra }));
}

/** Comptes créés par le formulaire ; null si la lecture échoue. */
export async function comptesCrees(depuis?: Date): Promise<number | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return memoire.__getgentsInscriptions ?? 0;
  let q = sb.from("inscriptions").select("id", { count: "exact", head: true });
  if (depuis) q = q.gte("created_at", depuis.toISOString());
  const { count, error } = await q;
  if (error) {
    journalInscription("lecture_echouee", { erreur: error.message.slice(0, 160) });
    return null;
  }
  return count ?? 0;
}

/**
 * État des inscriptions. Une lecture en échec FERME : on ne crée jamais de
 * compte sans savoir combien il y en a déjà (table absente avant la
 * migration 030, panne de Supabase).
 */
export async function etatInscriptions(): Promise<EtatInscriptions> {
  const plafond = lirePlafondInscriptions(process.env.INSCRIPTIONS_PLAFOND);
  if (!plafond) return { genre: "fermees" };
  const n = await comptesCrees();
  if (n === null) return { genre: "fermees" };
  return etatDesInscriptions(plafond, n);
}

export async function noterInscription(userId: string, pourQuoi: string): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    memoire.__getgentsInscriptions = (memoire.__getgentsInscriptions ?? 0) + 1;
    return;
  }
  const { error } = await sb.from("inscriptions").insert({ user_id: userId, pour_quoi: pourQuoi || null });
  if (error) journalInscription("ligne_non_gardee", { erreur: error.message.slice(0, 160) });
}
