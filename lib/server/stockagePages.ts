import { getSupabaseAdmin } from "@/lib/server/supabase";
import { ecritureAdmise, type DemandeStockage, type RefusStockage } from "@/lib/stockagePage";

/**
 * Stockage partagé d'une page (migration 035) : commun à TOUS les liens de la
 * page. L'appelant a vérifié l'accès (lien valide et code, ou propriétaire).
 * Sans Supabase, en développement, une mémoire locale le remplace.
 */

type Resultat =
  | { ok: true; resultat: unknown }
  | { ok: false; refus: RefusStockage | "indisponible" };

function memoire(): Map<string, Map<string, string>> {
  if (process.env.NODE_ENV === "production") throw new Error("supabase_non_configure");
  const g = globalThis as unknown as { __stockagePages?: Map<string, Map<string, string>> };
  return (g.__stockagePages ??= new Map());
}

/** Exécute une opération ; rend la MÊME forme que `window.storage` chez Claude (avec `shared: true`). */
export async function operationStockage(pageId: string, d: DemandeStockage): Promise<Resultat> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    const m = memoire();
    const page = m.get(pageId) ?? new Map<string, string>();
    m.set(pageId, page);
    if (d.op === "get") return { ok: true, resultat: page.has(d.cle!) ? { key: d.cle, value: page.get(d.cle!), shared: true } : null };
    if (d.op === "list") return { ok: true, resultat: { keys: Array.from(page.keys()).filter((k) => k.startsWith(d.prefixe ?? "")), prefix: d.prefixe ?? "", shared: true } };
    if (d.op === "delete") {
      page.delete(d.cle!);
      return { ok: true, resultat: { key: d.cle, deleted: true, shared: true } };
    }
    const tailles = new Map(Array.from(page).map(([k, v]) => [k, v.length]));
    const refus = ecritureAdmise(tailles, d.cle!, d.valeur!.length);
    if (refus) return { ok: false, refus };
    page.set(d.cle!, d.valeur!);
    return { ok: true, resultat: { key: d.cle, value: d.valeur, shared: true } };
  }

  // Table absente (migration 035 pas passée) : une erreur lisible pour la page.
  const indisponible = (e: { message: string }) => {
    console.error(JSON.stringify({ tag: "getgents:stockage", event: "erreur", detail: e.message.slice(0, 160) }));
    return { ok: false as const, refus: "indisponible" as const };
  };

  if (d.op === "get") {
    const { data, error } = await sb.from("pages_stockage").select("valeur").eq("page_id", pageId).eq("cle", d.cle!).maybeSingle();
    if (error) return indisponible(error);
    return { ok: true, resultat: data ? { key: d.cle, value: data.valeur, shared: true } : null };
  }
  if (d.op === "list") {
    const { data, error } = await sb.from("pages_stockage").select("cle").eq("page_id", pageId).order("cle").limit(1000);
    if (error) return indisponible(error);
    const prefixe = d.prefixe ?? "";
    return { ok: true, resultat: { keys: (data ?? []).map((r) => r.cle as string).filter((k) => k.startsWith(prefixe)), prefix: prefixe, shared: true } };
  }
  if (d.op === "delete") {
    const { error } = await sb.from("pages_stockage").delete().eq("page_id", pageId).eq("cle", d.cle!);
    if (error) return indisponible(error);
    return { ok: true, resultat: { key: d.cle, deleted: true, shared: true } };
  }
  const { data: lignes, error: e1 } = await sb.from("pages_stockage").select("cle, taille").eq("page_id", pageId).limit(1000);
  if (e1) return indisponible(e1);
  const refus = ecritureAdmise(new Map((lignes ?? []).map((l) => [l.cle as string, l.taille as number])), d.cle!, d.valeur!.length);
  if (refus) return { ok: false, refus };
  const { error } = await sb
    .from("pages_stockage")
    .upsert({ page_id: pageId, cle: d.cle, valeur: d.valeur, taille: d.valeur!.length, maj: new Date().toISOString() });
  if (error) return indisponible(error);
  return { ok: true, resultat: { key: d.cle, value: d.valeur, shared: true } };
}

/** Ce que la fiche montre : nombre de clés et taille totale. */
export async function resumeStockage(pageId: string): Promise<{ cles: number; taille: number } | null> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    const page = memoire().get(pageId);
    return { cles: page?.size ?? 0, taille: page ? Array.from(page.values()).reduce((s, v) => s + v.length, 0) : 0 };
  }
  const { data, error } = await sb.from("pages_stockage").select("taille").eq("page_id", pageId).limit(1000);
  if (error) return null;
  return { cles: (data ?? []).length, taille: (data ?? []).reduce((s, l) => s + ((l.taille as number) ?? 0), 0) };
}

/** Remet la page à zéro : votes, scores… tout ce que ses lecteurs ont écrit. */
export async function viderStockage(pageId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    memoire().delete(pageId);
    return true;
  }
  const { error } = await sb.from("pages_stockage").delete().eq("page_id", pageId);
  return !error;
}
