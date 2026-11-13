import { getSupabaseAdmin } from "@/lib/server/supabase";
import { lirePage } from "@/lib/server/pages";
import { COMPLEMENT_MAX, COMPLEMENTS_MAX, type Complement } from "@/lib/assistantDocument";

/**
 * Précisions de l'auteur sur une page (migration 025). Lues par l'assistant
 * avec la page, pour tous les destinataires ; jamais montrées comme telles au
 * visiteur. Table absente : aucune précision, rien ne casse.
 */

export interface ComplementPage extends Complement {
  id: string;
  questionId: string | null;
  createdAt: string;
  updatedAt: string;
}

const tableAbsente = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|could not find the table/i.test(e.message ?? ""));

const memoire = (): Map<string, ComplementPage & { pageId: string }> => {
  const g = globalThis as unknown as { __complementsPages?: Map<string, ComplementPage & { pageId: string }> };
  return (g.__complementsPages ??= new Map());
};

const ligne = (d: { id: string; question_id: string | null; sujet: string; texte: string; created_at: string; updated_at: string }): ComplementPage => ({
  id: d.id,
  questionId: d.question_id,
  sujet: d.sujet,
  texte: d.texte,
  createdAt: d.created_at,
  updatedAt: d.updated_at,
});

export type Validation = { ok: true; sujet: string; texte: string } | { ok: false; erreur: string };

export function validerComplement(corps: unknown): Validation {
  const c = (corps && typeof corps === "object" ? corps : {}) as Record<string, unknown>;
  const texte = typeof c.texte === "string" ? c.texte.trim() : "";
  const sujet = typeof c.sujet === "string" ? c.sujet.trim().slice(0, 300) : "";
  if (!texte) return { ok: false, erreur: "La précision est vide." };
  if (texte.length > COMPLEMENT_MAX) return { ok: false, erreur: `${COMPLEMENT_MAX} caractères au plus.` };
  return { ok: true, sujet, texte };
}

/** Pour l'assistant (sans contrôle de propriété : l'appelant a déjà résolu le lien). */
export async function complementsDeLaPage(pageId: string | null): Promise<ComplementPage[]> {
  if (!pageId) return [];
  const sb = getSupabaseAdmin();
  if (!sb) {
    return Array.from(memoire().values())
      .filter((c) => c.pageId === pageId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(({ pageId: _p, ...c }) => c);
  }
  const { data, error } = await sb
    .from("pages_complements")
    .select("id, question_id, sujet, texte, created_at, updated_at")
    .eq("page_id", pageId)
    .order("created_at", { ascending: true })
    .limit(COMPLEMENTS_MAX);
  if (tableAbsente(error)) return [];
  if (error) throw new Error(error.message);
  return (data ?? []).map(ligne);
}

export type Resultat<T> = { ok: true; valeur: T } | { ok: false; raison: "introuvable" | "migration_manquante" | "plafond" };

/** Liste pour l'auteur : la page doit être à lui. */
export async function listerComplements(ownerId: string, pageId: string): Promise<Resultat<ComplementPage[]>> {
  if (!(await lirePage(ownerId, pageId))) return { ok: false, raison: "introuvable" };
  const sb = getSupabaseAdmin();
  if (sb) {
    const { error } = await sb.from("pages_complements").select("id", { head: true, count: "exact" }).eq("page_id", pageId);
    if (tableAbsente(error)) return { ok: false, raison: "migration_manquante" };
  }
  return { ok: true, valeur: await complementsDeLaPage(pageId) };
}

export async function ajouterComplement(
  ownerId: string,
  pageId: string,
  c: { sujet: string; texte: string; questionId: string | null }
): Promise<Resultat<ComplementPage>> {
  const existants = await listerComplements(ownerId, pageId);
  if (!existants.ok) return existants;
  if (existants.valeur.length >= COMPLEMENTS_MAX) return { ok: false, raison: "plafond" };
  const maintenant = new Date().toISOString();
  const sb = getSupabaseAdmin();
  if (!sb) {
    const n: ComplementPage = { id: crypto.randomUUID(), questionId: c.questionId, sujet: c.sujet, texte: c.texte, createdAt: maintenant, updatedAt: maintenant };
    memoire().set(n.id, { ...n, pageId });
    return { ok: true, valeur: n };
  }
  // Une question d'une AUTRE page ne se rattache pas : on garde la précision, sans lien.
  let questionId = c.questionId;
  if (questionId) {
    const { data } = await sb.from("pages_questions").select("id").eq("id", questionId).eq("page_id", pageId).maybeSingle();
    if (!data) questionId = null;
  }
  const { data, error } = await sb
    .from("pages_complements")
    .insert({ page_id: pageId, question_id: questionId, sujet: c.sujet, texte: c.texte })
    .select("id, question_id, sujet, texte, created_at, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return { ok: true, valeur: ligne(data) };
}

export async function modifierComplement(ownerId: string, pageId: string, id: string, c: { sujet: string; texte: string }): Promise<boolean> {
  if (!(await lirePage(ownerId, pageId))) return false;
  const sb = getSupabaseAdmin();
  if (!sb) {
    const x = memoire().get(id);
    if (!x || x.pageId !== pageId) return false;
    Object.assign(x, { sujet: c.sujet, texte: c.texte, updatedAt: new Date().toISOString() });
    return true;
  }
  const { data, error } = await sb
    .from("pages_complements")
    .update({ sujet: c.sujet, texte: c.texte, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("page_id", pageId)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export async function retirerComplement(ownerId: string, pageId: string, id: string): Promise<boolean> {
  if (!(await lirePage(ownerId, pageId))) return false;
  const sb = getSupabaseAdmin();
  if (!sb) {
    const x = memoire().get(id);
    if (!x || x.pageId !== pageId) return false;
    memoire().delete(id);
    return true;
  }
  const { data, error } = await sb.from("pages_complements").delete().eq("id", id).eq("page_id", pageId).select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}
