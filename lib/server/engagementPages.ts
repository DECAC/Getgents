import { randomUUID } from "crypto";
import { choixValides, ENGAGEMENT_PAR_DEFAUT, type ChoixLecteur, type ReglageEngagement, type ReponseEngagement } from "@/lib/engagement";
import type { ArtefactPartage } from "@/lib/server/artefactsPartages";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { lirePage } from "@/lib/server/pages";

/**
 * Bouton d'engagement (migration 031). Table absente : bouton DÉSACTIVÉ
 * partout, et le bloc de la fiche le dit — rien ne casse.
 */

const tableAbsente = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|could not find the table/i.test(e.message ?? ""));

interface Memoire {
  reglages: Map<string, ReglageEngagement>;
  reponses: Map<string, ReponseEngagement & { pageId: string }>;
}
const memoire = (): Memoire => {
  const g = globalThis as unknown as { __engagementPages?: Memoire };
  return (g.__engagementPages ??= { reglages: new Map(), reponses: new Map() });
};

export type Lecture<T> = { ok: true; valeur: T } | { ok: false; raison: "introuvable" | "migration_manquante" };

/** Réglage d'une page pour le LECTEUR (l'appelant a résolu le lien). Erreur ou table absente : inactif. */
export async function engagementDeLaPage(pageId: string | null): Promise<ReglageEngagement> {
  if (!pageId) return ENGAGEMENT_PAR_DEFAUT;
  const sb = getSupabaseAdmin();
  if (!sb) return memoire().reglages.get(pageId) ?? ENGAGEMENT_PAR_DEFAUT;
  const { data, error } = await sb.from("pages_engagement").select("actif, intitule, mot").eq("page_id", pageId).maybeSingle();
  if (error || !data) return ENGAGEMENT_PAR_DEFAUT;
  return { actif: !!data.actif, intitule: String(data.intitule), mot: !!data.mot };
}

/** Réglage pour l'AUTEUR, qui doit savoir si la migration manque. */
export async function lireEngagement(ownerId: string, pageId: string): Promise<Lecture<ReglageEngagement>> {
  if (!(await lirePage(ownerId, pageId))) return { ok: false, raison: "introuvable" };
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: true, valeur: memoire().reglages.get(pageId) ?? ENGAGEMENT_PAR_DEFAUT };
  const { data, error } = await sb.from("pages_engagement").select("actif, intitule, mot").eq("page_id", pageId).maybeSingle();
  if (tableAbsente(error)) return { ok: false, raison: "migration_manquante" };
  if (error) throw new Error(error.message);
  return { ok: true, valeur: data ? { actif: !!data.actif, intitule: String(data.intitule), mot: !!data.mot } : ENGAGEMENT_PAR_DEFAUT };
}

export async function definirEngagement(ownerId: string, pageId: string, r: ReglageEngagement): Promise<"ok" | "introuvable" | "migration_manquante"> {
  if (!(await lirePage(ownerId, pageId))) return "introuvable";
  const sb = getSupabaseAdmin();
  if (!sb) {
    memoire().reglages.set(pageId, r);
    return "ok";
  }
  const { error } = await sb
    .from("pages_engagement")
    .upsert({ page_id: pageId, actif: r.actif, intitule: r.intitule, mot: r.mot, updated_at: new Date().toISOString() });
  if (tableAbsente(error)) return "migration_manquante";
  if (error) throw new Error(error.message);
  return "ok";
}

/** La réponse déjà envoyée sur CE lien, s'il y en a une. */
export async function reponseDuLien(jeton: string): Promise<{ createdAt: string } | null> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    const r = Array.from(memoire().reponses.values()).find((x) => x.jeton === jeton);
    return r ? { createdAt: r.createdAt } : null;
  }
  const { data, error } = await sb.from("pages_reponses").select("created_at").eq("jeton", jeton).maybeSingle();
  if (error || !data) return null;
  return { createdAt: String(data.created_at) };
}

/** Enregistre LA réponse d'un lien. « deja » : une réponse existe (contrainte unique). */
export async function enregistrerReponse(a: ArtefactPartage, intitule: string, mot: string | null, choix: ChoixLecteur[]): Promise<"ok" | "deja" | "migration_manquante"> {
  if (!a.pageId) return "migration_manquante";
  const maintenant = new Date().toISOString();
  const sb = getSupabaseAdmin();
  if (!sb) {
    const m = memoire();
    if (Array.from(m.reponses.values()).some((x) => x.jeton === a.jeton)) return "deja";
    const id = randomUUID();
    m.reponses.set(id, { id, pageId: a.pageId, jeton: a.jeton, destinataire: a.destinataire, intitule, mot, choix, version: a.version, createdAt: maintenant, vueAt: null });
    return "ok";
  }
  const { error } = await sb
    .from("pages_reponses")
    .insert({ page_id: a.pageId, jeton: a.jeton, destinataire: a.destinataire, intitule, mot, choix, version: a.version });
  if (tableAbsente(error)) return "migration_manquante";
  if (error && (error.code === "23505" || /duplicate key/i.test(error.message))) return "deja";
  if (error) throw new Error(error.message);
  return "ok";
}

export async function reponsesDeLaPage(ownerId: string, pageId: string): Promise<Lecture<ReponseEngagement[]>> {
  if (!(await lirePage(ownerId, pageId))) return { ok: false, raison: "introuvable" };
  const sb = getSupabaseAdmin();
  if (!sb) {
    const liste = Array.from(memoire().reponses.values())
      .filter((r) => r.pageId === pageId)
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
      .map(({ pageId: _p, ...r }) => r);
    return { ok: true, valeur: liste };
  }
  const { data, error } = await sb
    .from("pages_reponses")
    .select("id, jeton, destinataire, intitule, mot, choix, version, created_at, vue_at")
    .eq("page_id", pageId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (tableAbsente(error)) return { ok: false, raison: "migration_manquante" };
  if (error) throw new Error(error.message);
  return {
    ok: true,
    valeur: (data ?? []).map((r) => ({
      id: String(r.id),
      jeton: String(r.jeton),
      destinataire: String(r.destinataire),
      intitule: String(r.intitule),
      mot: r.mot == null ? null : String(r.mot),
      choix: choixValides(r.choix),
      version: Number(r.version) || 1,
      createdAt: String(r.created_at),
      vueAt: r.vue_at == null ? null : String(r.vue_at),
    })),
  };
}

/** L'auteur a ouvert la liste : les réponses nouvelles deviennent « vues ». */
export async function marquerReponsesVues(ownerId: string, pageId: string): Promise<void> {
  if (!(await lirePage(ownerId, pageId))) return;
  const maintenant = new Date().toISOString();
  const sb = getSupabaseAdmin();
  if (!sb) {
    for (const r of memoire().reponses.values()) if (r.pageId === pageId && !r.vueAt) r.vueAt = maintenant;
    return;
  }
  await sb.from("pages_reponses").update({ vue_at: maintenant }).eq("page_id", pageId).is("vue_at", null);
}
