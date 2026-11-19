import { invitesValides } from "@/lib/groupesPages";
import { lireArtefact } from "@/lib/server/artefactsPartages";
import { getSupabaseAdmin } from "@/lib/server/supabase";

/**
 * Liens de groupe (migration 033). Table absente : aucun lien n'est un groupe,
 * la création d'un groupe est refusée et le dit — les liens ordinaires ne
 * changent pas.
 */

const tableAbsente = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|could not find the table/i.test(e.message ?? ""));

const memoire = (): Map<string, string[]> => {
  const g = globalThis as unknown as { __groupesPages?: Map<string, string[]> };
  return (g.__groupesPages ??= new Map());
};

/** Les invités d'un lien de groupe, ou null pour un lien ordinaire (ou en cas d'erreur). */
export async function groupeDuLien(jeton: string): Promise<string[] | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return memoire().get(jeton) ?? null;
  const { data, error } = await sb.from("partages_groupes").select("invites").eq("jeton", jeton).maybeSingle();
  if (error || !data) return null;
  return invitesValides(data.invites);
}

/** Groupes de plusieurs liens d'un coup (fiche de la page). */
export async function groupesDesLiens(jetons: string[]): Promise<Record<string, string[]>> {
  if (jetons.length === 0) return {};
  const sb = getSupabaseAdmin();
  if (!sb) {
    const m = memoire();
    return Object.fromEntries(jetons.filter((j) => m.has(j)).map((j) => [j, m.get(j)!]));
  }
  const { data, error } = await sb.from("partages_groupes").select("jeton, invites").in("jeton", jetons);
  if (error || !data) return {};
  return Object.fromEntries(data.map((d) => [String(d.jeton), invitesValides(d.invites)]));
}

/** Pose (ou remplace) la liste des invités d'un lien du PROPRIÉTAIRE. */
export async function definirGroupe(ownerId: string, jeton: string, invites: string[]): Promise<"ok" | "introuvable" | "migration_manquante"> {
  const a = await lireArtefact(jeton);
  if (!a || a.ownerId !== ownerId) return "introuvable";
  const sb = getSupabaseAdmin();
  if (!sb) {
    memoire().set(jeton, invites);
    return "ok";
  }
  const { error } = await sb.from("partages_groupes").upsert({ jeton, invites, updated_at: new Date().toISOString() });
  if (tableAbsente(error)) return "migration_manquante";
  if (error) throw new Error(error.message);
  return "ok";
}

/** La migration est-elle passée ? (Avant de créer un lien qui serait un groupe sans liste.) */
export async function groupesDisponibles(): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return true;
  const { error } = await sb.from("partages_groupes").select("jeton").limit(1);
  return !tableAbsente(error);
}
