import { getSupabaseAdmin } from "@/lib/server/supabase";
import { lirePage } from "@/lib/server/pages";
import { COOKIE_LANGUE, langueEffective, type Langue, type ReglageLangue } from "@/lib/langueLecteur";
import type { ArtefactPartage } from "@/lib/server/artefactsPartages";

/**
 * Réglage de langue des lecteurs, PAR PAGE (migration 034). Sans ligne ou
 * sans table : « auto ». Une erreur de lecture vaut « auto » aussi — la
 * langue n'est pas une garde d'accès, se tromper n'expose rien.
 */

const tableAbsente = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache|could not find the table/i.test(e.message ?? ""));

const memoire = (): Map<string, "fr" | "en"> => {
  const g = globalThis as unknown as { __langueLecteurs?: Map<string, "fr" | "en"> };
  return (g.__langueLecteurs ??= new Map());
};

export async function reglageLangue(pageId: string | null): Promise<ReglageLangue> {
  if (!pageId) return "auto";
  const sb = getSupabaseAdmin();
  if (!sb) return memoire().get(pageId) ?? "auto";
  const { data, error } = await sb.from("pages_langue").select("langue").eq("page_id", pageId).maybeSingle();
  if (error) {
    if (!tableAbsente(error)) console.error(JSON.stringify({ tag: "getgents:langue", event: "lecture_echouee", detail: error.message }));
    return "auto";
  }
  return data?.langue === "fr" || data?.langue === "en" ? data.langue : "auto";
}

/** Règle la langue d'une page DE CE COMPTE. « auto » efface le réglage. */
export async function definirLangue(ownerId: string, pageId: string, reglage: ReglageLangue): Promise<"ok" | "introuvable" | "migration_manquante"> {
  const page = await lirePage(ownerId, pageId);
  if (!page) return "introuvable";
  const sb = getSupabaseAdmin();
  if (!sb) {
    if (reglage === "auto") memoire().delete(pageId);
    else memoire().set(pageId, reglage);
    return "ok";
  }
  const { error } =
    reglage === "auto"
      ? await sb.from("pages_langue").delete().eq("page_id", pageId)
      : await sb.from("pages_langue").upsert({ page_id: pageId, langue: reglage, updated_at: new Date().toISOString() });
  if (tableAbsente(error)) return "migration_manquante";
  if (error) throw new Error(error.message);
  return "ok";
}

/** Langue montrée au lecteur d'un lien : son choix (cookie), le réglage de l'auteur, puis la page. */
export async function langueDuLecteur(a: Pick<ArtefactPartage, "pageId" | "contenu">, choix: string | undefined): Promise<Langue> {
  const reglage = await reglageLangue(a.pageId).catch(() => "auto" as const);
  return langueEffective({ choix, reglage, contenu: a.contenu });
}

/** Le cookie du choix explicite, lu depuis une requête. */
export function choixDuCookie(cookies: { get: (n: string) => { value: string } | undefined }): string | undefined {
  return cookies.get(COOKIE_LANGUE)?.value;
}
