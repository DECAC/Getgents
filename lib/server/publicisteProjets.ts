import { getSupabaseAdmin } from "@/lib/server/supabase";
import type { EtatProjet } from "@/lib/publiciste";

/**
 * Projets du Publiciste (migration 040) : un par gent et par auteur. Écriture
 * CONDITIONNELLE sur la version lue — deux onglets ne s'écrasent pas en
 * silence, le second est refusé et relit. Sans Supabase, en développement,
 * une mémoire locale la remplace.
 */

export type LectureProjet = { ok: true; etat: EtatProjet | null; version: number } | { ok: false; cause: "non_installe" | "erreur" };
export type EcritureProjet = { ok: true; version: number } | { ok: false; cause: "conflit" | "non_installe" | "erreur" };

const tableAbsente = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache|could not find the table/i.test(e.message ?? ""));

function memoire(): Map<string, { etat: EtatProjet; version: number }> {
  if (process.env.NODE_ENV === "production") throw new Error("supabase_non_configure");
  const g = globalThis as unknown as { __publicisteProjets?: Map<string, { etat: EtatProjet; version: number }> };
  return (g.__publicisteProjets ??= new Map());
}

function journal(event: string, detail?: string) {
  console.error(JSON.stringify({ tag: "getgents:publiciste", event, ...(detail ? { detail: detail.slice(0, 160) } : {}) }));
}

export async function lireProjet(ownerId: string, gentId: string): Promise<LectureProjet> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    const p = memoire().get(`${ownerId}:${gentId}`);
    return { ok: true, etat: p?.etat ?? null, version: p?.version ?? 0 };
  }
  const { data, error } = await sb.from("publiciste_projets").select("etat, version").eq("owner_id", ownerId).eq("gent_id", gentId).maybeSingle();
  if (error) {
    journal(tableAbsente(error) ? "migration_040_absente" : "lecture_echouee", error.message);
    return { ok: false, cause: tableAbsente(error) ? "non_installe" : "erreur" };
  }
  return { ok: true, etat: (data?.etat as EtatProjet) ?? null, version: (data?.version as number) ?? 0 };
}

/** `versionLue` = 0 : le projet n'existe pas encore, on le crée. */
export async function ecrireProjet(ownerId: string, gentId: string, etat: EtatProjet, versionLue: number): Promise<EcritureProjet> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    const m = memoire();
    const cle = `${ownerId}:${gentId}`;
    const actuel = m.get(cle)?.version ?? 0;
    if (actuel !== versionLue) return { ok: false, cause: "conflit" };
    m.set(cle, { etat, version: actuel + 1 });
    return { ok: true, version: actuel + 1 };
  }
  const maintenant = new Date().toISOString();
  if (versionLue === 0) {
    const { error } = await sb.from("publiciste_projets").insert({ owner_id: ownerId, gent_id: gentId, etat, version: 1, modifie_le: maintenant });
    if (!error) return { ok: true, version: 1 };
    if (error.code === "23505") return { ok: false, cause: "conflit" };
    journal(tableAbsente(error) ? "migration_040_absente" : "ecriture_echouee", error.message);
    return { ok: false, cause: tableAbsente(error) ? "non_installe" : "erreur" };
  }
  const { data, error } = await sb
    .from("publiciste_projets")
    .update({ etat, version: versionLue + 1, modifie_le: maintenant })
    .eq("owner_id", ownerId)
    .eq("gent_id", gentId)
    .eq("version", versionLue)
    .select("version");
  if (error) {
    journal(tableAbsente(error) ? "migration_040_absente" : "ecriture_echouee", error.message);
    return { ok: false, cause: tableAbsente(error) ? "non_installe" : "erreur" };
  }
  if (!data || data.length === 0) return { ok: false, cause: "conflit" };
  return { ok: true, version: versionLue + 1 };
}
