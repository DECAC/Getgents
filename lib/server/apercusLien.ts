import { marked } from "marked";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { lirePage } from "@/lib/server/pages";
import { protectionActive } from "@/lib/server/accesPartage";
import { contenuAvecFichiers } from "@/lib/server/fichiersPages";
import { capturerDocument } from "@/lib/server/captureApercu";
import { CSP_ARTEFACT, documentArtefact } from "@/lib/documentArtefact";
import { cheminCapture, type EtatApercu } from "@/lib/apercuCapture";

/**
 * Aperçu du lien par capture (migration 039) : réglage par page, capture par
 * version rangée dans le seau PRIVÉ `pages-apercus`. Sans table : option
 * coupée (lecture), activation refusée (« migration_manquante »).
 */

const SEAU = "pages-apercus";

const tableAbsente = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache|could not find the table/i.test(e.message ?? ""));

const journal = (event: string, extra: Record<string, unknown> = {}) => console.log(JSON.stringify({ tag: "getgents:apercu-lien", event, ...extra }));

interface Memoire {
  etats: Map<string, EtatApercu>;
  images: Map<string, Buffer>;
}
const memoire = (): Memoire => {
  const g = globalThis as unknown as { __apercusLien?: Memoire };
  return (g.__apercusLien ??= { etats: new Map(), images: new Map() });
};

/** L'état de l'option pour une page, ou null (jamais réglée, table absente, erreur). */
export async function etatApercu(pageId: string | null): Promise<EtatApercu | null> {
  if (!pageId) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return memoire().etats.get(pageId) ?? null;
  const { data, error } = await sb.from("pages_apercu_lien").select("actif, version, capture_le").eq("page_id", pageId).maybeSingle();
  if (error) {
    if (!tableAbsente(error)) journal("lecture_echouee", { detail: error.message });
    return null;
  }
  return data ? { actif: data.actif === true, version: data.version ?? null, captureLe: data.capture_le ?? null } : null;
}

export type ResultatCaptureRangee =
  | { ok: true; etat: EtatApercu }
  | { ok: false; raison: "introuvable" | "protegee" | "migration_manquante" | "vide" | "delai" | "erreur" };

/** Capture la version COURANTE d'une page de ce compte et la range. L'option garde son état (activée ou non). */
export async function capturerEtRanger(ownerId: string, pageId: string): Promise<ResultatCaptureRangee> {
  const page = await lirePage(ownerId, pageId);
  if (!page) return { ok: false, raison: "introuvable" };
  if (await protectionActive(page.id).catch(() => true)) return { ok: false, raison: "protegee" };
  const html = documentArtefact(await contenuAvecFichiers(page.id, page.contenu), page.format, page.titre, (md) => marked.parse(md, { async: false }) as string);
  const debut = Date.now();
  const r = await capturerDocument(html, CSP_ARTEFACT);
  journal(r.ok ? "capture_faite" : "capture_echouee", { duree: Date.now() - debut, ...(r.ok ? { octets: r.png.length } : { raison: r.raison, detail: r.detail }) });
  if (!r.ok) return { ok: false, raison: r.raison };
  const maintenant = new Date().toISOString();
  const sb = getSupabaseAdmin();
  const precedent = await etatApercu(page.id);
  const etat: EtatApercu = { actif: precedent?.actif ?? false, version: page.version, captureLe: maintenant };
  if (!sb) {
    memoire().images.set(cheminCapture(page.id, page.version), r.png);
    memoire().etats.set(page.id, etat);
    return { ok: true, etat };
  }
  const { error: e1 } = await sb.storage.from(SEAU).upload(cheminCapture(page.id, page.version), r.png, { contentType: "image/png", upsert: true });
  if (e1) {
    if (/bucket not found/i.test(e1.message)) return { ok: false, raison: "migration_manquante" };
    throw new Error(e1.message);
  }
  const { error: e2 } = await sb
    .from("pages_apercu_lien")
    .upsert({ page_id: page.id, actif: etat.actif, version: page.version, capture_le: maintenant, updated_at: maintenant });
  if (tableAbsente(e2)) return { ok: false, raison: "migration_manquante" };
  if (e2) throw new Error(e2.message);
  // Les captures des versions précédentes ne servent plus.
  if (precedent?.version && precedent.version !== page.version) await sb.storage.from(SEAU).remove([cheminCapture(page.id, precedent.version)]).catch(() => undefined);
  return { ok: true, etat };
}

/** Active ou coupe l'option. Activer exige une capture de la version courante : l'auteur a VU l'image. */
export async function definirApercu(ownerId: string, pageId: string, actif: boolean): Promise<"ok" | "introuvable" | "sans_capture" | "protegee" | "migration_manquante"> {
  const page = await lirePage(ownerId, pageId);
  if (!page) return "introuvable";
  const etat = await etatApercu(page.id);
  if (actif) {
    if (await protectionActive(page.id).catch(() => true)) return "protegee";
    if (!etat || etat.version !== page.version) return "sans_capture";
  }
  const sb = getSupabaseAdmin();
  if (!sb) {
    memoire().etats.set(page.id, { actif, version: etat?.version ?? null, captureLe: etat?.captureLe ?? null });
    return "ok";
  }
  const { error } = await sb.from("pages_apercu_lien").upsert({ page_id: page.id, actif, version: etat?.version ?? null, capture_le: etat?.captureLe ?? null, updated_at: new Date().toISOString() });
  if (tableAbsente(error)) return "migration_manquante";
  if (error) throw new Error(error.message);
  journal(actif ? "active" : "coupe", { pageId: page.id });
  return "ok";
}

/** L'image rangée pour cette version, ou null. */
export async function imageCapture(pageId: string, version: number): Promise<Buffer | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return memoire().images.get(cheminCapture(pageId, version)) ?? null;
  const { data, error } = await sb.storage.from(SEAU).download(cheminCapture(pageId, version));
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/** Efface les captures d'une page supprimée (la ligne part en cascade). */
export async function supprimerCaptures(pageId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    for (const k of Array.from(memoire().images.keys())) if (k.startsWith(`${pageId}/`)) memoire().images.delete(k);
    memoire().etats.delete(pageId);
    return;
  }
  const { data } = await sb.storage.from(SEAU).list(pageId);
  if (data?.length) await sb.storage.from(SEAU).remove(data.map((f) => `${pageId}/${f.name}`));
}

/**
 * Tâche horaire : refait la capture des pages dont l'option est ACTIVE mais
 * dont la version a changé (mise à jour par le connecteur, sans passer par la
 * fiche). En attendant, la vignette ordinaire est montrée.
 */
export async function recapturerPagesChangees(max = 3): Promise<number> {
  const sb = getSupabaseAdmin();
  if (!sb) return 0;
  const { data, error } = await sb.from("pages_apercu_lien").select("page_id, version, pages(version, owner_id, supprimee_at)").eq("actif", true).limit(200);
  if (error) {
    if (!tableAbsente(error)) journal("tache_lecture_echouee", { detail: error.message });
    return 0;
  }
  let faites = 0;
  for (const l of data ?? []) {
    if (faites >= max) break;
    const p = (Array.isArray(l.pages) ? l.pages[0] : l.pages) as { version: number; owner_id: string; supprimee_at: string | null } | null;
    if (!p || p.supprimee_at || p.version === l.version) continue;
    const r = await capturerEtRanger(p.owner_id, l.page_id).catch(() => null);
    if (r?.ok) faites++;
  }
  return faites;
}
