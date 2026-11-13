import { getSupabaseAdmin } from "@/lib/server/supabase";
import { lirePage } from "@/lib/server/pages";
import { suggestionsValides, type Suggestion } from "@/lib/suggestionsPage";

/**
 * Questions suggérées d'une page (migration 026). Sans ligne : null, et
 * l'appelant retombe sur les suggestions par défaut. Table absente : idem —
 * rien ne casse.
 */

const tableAbsente = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|could not find the table/i.test(e.message ?? ""));

const memoire = (): Map<string, Suggestion[]> => {
  const g = globalThis as unknown as { __suggestionsPages?: Map<string, Suggestion[]> };
  return (g.__suggestionsPages ??= new Map());
};

/** Pour le visiteur (l'appelant a déjà résolu le lien). Null = suggestions par défaut. */
export async function suggestionsDeLaPage(pageId: string | null): Promise<Suggestion[] | null> {
  if (!pageId) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return memoire().get(pageId) ?? null;
  const { data, error } = await sb.from("pages_suggestions").select("questions").eq("page_id", pageId).maybeSingle();
  if (tableAbsente(error)) return null;
  if (error) throw new Error(error.message);
  if (!data) return null;
  // Relue par le même filtre qu'à l'écriture : une ligne abîmée ne passe pas telle quelle.
  return suggestionsValides({ suggestions: data.questions });
}

export type Lecture = { ok: true; suggestions: Suggestion[] | null } | { ok: false; raison: "introuvable" | "migration_manquante" };

/** Pour l'auteur : la page doit être à lui. */
export async function lireSuggestions(ownerId: string, pageId: string): Promise<Lecture> {
  if (!(await lirePage(ownerId, pageId))) return { ok: false, raison: "introuvable" };
  const sb = getSupabaseAdmin();
  if (sb) {
    const { error } = await sb.from("pages_suggestions").select("page_id", { head: true, count: "exact" }).eq("page_id", pageId);
    if (tableAbsente(error)) return { ok: false, raison: "migration_manquante" };
  }
  return { ok: true, suggestions: await suggestionsDeLaPage(pageId) };
}

export async function definirSuggestions(ownerId: string, pageId: string, suggestions: Suggestion[]): Promise<"ok" | "introuvable" | "migration_manquante"> {
  if (!(await lirePage(ownerId, pageId))) return "introuvable";
  const sb = getSupabaseAdmin();
  if (!sb) {
    memoire().set(pageId, suggestions);
    return "ok";
  }
  const { error } = await sb.from("pages_suggestions").upsert({ page_id: pageId, questions: suggestions, updated_at: new Date().toISOString() });
  if (tableAbsente(error)) return "migration_manquante";
  if (error) throw new Error(error.message);
  return "ok";
}
