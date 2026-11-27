import { getSupabaseAdmin } from "@/lib/server/supabase";
import { ETAT_VIDE, PROJETS_MAX_PAR_GENT, type EtatProjet } from "@/lib/publiciste";

/**
 * Projets du Publiciste (migrations 040 et 041) : PLUSIEURS par auteur et par
 * gent. Toute requête filtre sur `owner_id` : connaître l'identifiant d'un
 * projet d'autrui ne suffit pas. Écriture CONDITIONNELLE sur la version lue —
 * deux onglets ne s'écrasent pas en silence. Sans Supabase, en
 * développement, une mémoire locale la remplace.
 */

export type Cause = "non_installe" | "erreur" | "introuvable" | "conflit" | "plafond";
type Echec = { ok: false; cause: Cause };

export interface ResumeLigne {
  id: string;
  nom: string;
  etat: EtatProjet;
  modifieLe: string;
  cout: number;
}

const tableAbsente = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || e.code === "42703" || e.code === "PGRST204" ||
    /does not exist|schema cache|could not find the (table|.* column)/i.test(e.message ?? ""));

interface LigneMemoire { owner: string; gent: string; nom: string; etat: EtatProjet; version: number; modifie: string }
function memoire(): Map<string, LigneMemoire> {
  if (process.env.NODE_ENV === "production") throw new Error("supabase_non_configure");
  const g = globalThis as unknown as { __publicisteProjets2?: Map<string, LigneMemoire> };
  return (g.__publicisteProjets2 ??= new Map());
}

function echec(event: string, e: { code?: string; message?: string }): Echec {
  const absente = tableAbsente(e);
  console.error(JSON.stringify({ tag: "getgents:publiciste", event: absente ? "migration_041_absente" : event, detail: (e.message ?? "").slice(0, 160) }));
  return { ok: false, cause: absente ? "non_installe" : "erreur" };
}

export async function listerProjets(owner: string, gent: string): Promise<{ ok: true; projets: ResumeLigne[] } | Echec> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    const projets = Array.from(memoire())
      .filter(([, l]) => l.owner === owner && l.gent === gent)
      .map(([id, l]) => ({ id, nom: l.nom, etat: l.etat, modifieLe: l.modifie, cout: 0 }))
      .sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));
    return { ok: true, projets };
  }
  const { data, error } = await sb
    .from("publiciste_projets")
    .select("id, nom, etat, modifie_le")
    .eq("owner_id", owner)
    .eq("gent_id", gent)
    .order("modifie_le", { ascending: false })
    .limit(PROJETS_MAX_PAR_GENT);
  if (error) return echec("liste_echouee", error);
  const ids = (data ?? []).map((l) => l.id as string);
  const couts = new Map<string, number>();
  if (ids.length) {
    const { data: f, error: e2 } = await sb.from("publiciste_fichiers").select("projet_id, cout").in("projet_id", ids);
    if (e2) return echec("liste_echouee", e2);
    for (const l of f ?? []) couts.set(l.projet_id as string, (couts.get(l.projet_id as string) ?? 0) + Number(l.cout ?? 0));
  }
  return {
    ok: true,
    projets: (data ?? []).map((l) => ({
      id: l.id as string,
      nom: (l.nom as string) ?? "",
      etat: { ...ETAT_VIDE, ...((l.etat as EtatProjet) ?? {}) },
      modifieLe: l.modifie_le as string,
      cout: Math.round((couts.get(l.id as string) ?? 0) * 100) / 100,
    })),
  };
}

export async function creerProjet(owner: string, gent: string): Promise<{ ok: true; id: string } | Echec> {
  const sb = getSupabaseAdmin();
  const maintenant = new Date().toISOString();
  if (!sb) {
    const m = memoire();
    if (Array.from(m.values()).filter((l) => l.owner === owner && l.gent === gent).length >= PROJETS_MAX_PAR_GENT) return { ok: false, cause: "plafond" };
    const id = crypto.randomUUID();
    m.set(id, { owner, gent, nom: "", etat: ETAT_VIDE, version: 1, modifie: maintenant });
    return { ok: true, id };
  }
  const { count, error: e1 } = await sb.from("publiciste_projets").select("id", { count: "exact", head: true }).eq("owner_id", owner).eq("gent_id", gent);
  if (e1) return echec("creation_echouee", e1);
  if ((count ?? 0) >= PROJETS_MAX_PAR_GENT) return { ok: false, cause: "plafond" };
  const { data, error } = await sb
    .from("publiciste_projets")
    .insert({ owner_id: owner, gent_id: gent, nom: "", etat: ETAT_VIDE, version: 1, modifie_le: maintenant })
    .select("id")
    .single();
  if (error) return echec("creation_echouee", error);
  return { ok: true, id: data.id as string };
}

export async function lireProjet(owner: string, id: string): Promise<{ ok: true; nom: string; etat: EtatProjet; version: number } | Echec> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    const l = memoire().get(id);
    if (!l || l.owner !== owner) return { ok: false, cause: "introuvable" };
    return { ok: true, nom: l.nom, etat: l.etat, version: l.version };
  }
  const { data, error } = await sb.from("publiciste_projets").select("nom, etat, version").eq("owner_id", owner).eq("id", id).maybeSingle();
  if (error) return echec("lecture_echouee", error);
  if (!data) return { ok: false, cause: "introuvable" };
  return { ok: true, nom: (data.nom as string) ?? "", etat: { ...ETAT_VIDE, ...(data.etat as EtatProjet) }, version: data.version as number };
}

export async function ecrireProjet(owner: string, id: string, etat: EtatProjet, versionLue: number): Promise<{ ok: true; version: number } | Echec> {
  const sb = getSupabaseAdmin();
  const maintenant = new Date().toISOString();
  if (!sb) {
    const l = memoire().get(id);
    if (!l || l.owner !== owner) return { ok: false, cause: "introuvable" };
    if (l.version !== versionLue) return { ok: false, cause: "conflit" };
    Object.assign(l, { etat, version: l.version + 1, modifie: maintenant });
    return { ok: true, version: l.version };
  }
  const { data, error } = await sb
    .from("publiciste_projets")
    .update({ etat, version: versionLue + 1, modifie_le: maintenant })
    .eq("owner_id", owner)
    .eq("id", id)
    .eq("version", versionLue)
    .select("version");
  if (error) return echec("ecriture_echouee", error);
  if (!data?.length) {
    const existe = await lireProjet(owner, id);
    return { ok: false, cause: existe.ok ? "conflit" : "introuvable" };
  }
  return { ok: true, version: versionLue + 1 };
}

export async function renommerProjet(owner: string, id: string, nom: string): Promise<{ ok: true } | Echec> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    const l = memoire().get(id);
    if (!l || l.owner !== owner) return { ok: false, cause: "introuvable" };
    l.nom = nom;
    return { ok: true };
  }
  const { data, error } = await sb.from("publiciste_projets").update({ nom }).eq("owner_id", owner).eq("id", id).select("id");
  if (error) return echec("renommage_echoue", error);
  return data?.length ? { ok: true } : { ok: false, cause: "introuvable" };
}

/** Supprime le projet ET ses fichiers dans le seau privé (les lignes partent en cascade). */
export async function supprimerProjet(owner: string, id: string): Promise<{ ok: true } | Echec> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    const l = memoire().get(id);
    if (!l || l.owner !== owner) return { ok: false, cause: "introuvable" };
    memoire().delete(id);
    return { ok: true };
  }
  const existe = await lireProjet(owner, id);
  if (!existe.ok) return existe;
  const { data: f, error: e1 } = await sb.from("publiciste_fichiers").select("chemin").eq("projet_id", id);
  if (e1) return echec("suppression_echouee", e1);
  const chemins = (f ?? []).map((l) => l.chemin as string);
  if (chemins.length) {
    const { error: e2 } = await sb.storage.from("publiciste").remove(chemins);
    if (e2) return echec("suppression_fichiers_echouee", e2);
  }
  const { error } = await sb.from("publiciste_projets").delete().eq("owner_id", owner).eq("id", id);
  if (error) return echec("suppression_echouee", error);
  return { ok: true };
}
