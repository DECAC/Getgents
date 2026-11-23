import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { avecFichiers, validerFichier, type RefusFichier } from "@/lib/fichiersPage";

/**
 * Fichiers joints aux pages (migration 036) : seau PRIVÉ `pages-fichiers`,
 * une ligne par (page, nom) dans `pages_fichiers`. L'appelant a vérifié que
 * la page est celle du compte (ou que le lien y donne accès, pour servir).
 *
 * Envoi en DEUX temps : `preparerEnvoi` rend une adresse d'envoi signée
 * (le navigateur y envoie le fichier, sans passer par une fonction Vercel,
 * plafonnée à 4,5 Mo), puis `confirmerEnvoi` relit l'objet dans Storage —
 * taille et type RÉELS — avant d'enregistrer la ligne.
 *
 * Sans Supabase, en développement, une mémoire locale le remplace, et le
 * fichier passe par `envoiLocal`.
 */

export const SEAU = "pages-fichiers";
const DUREE_ADRESSE_S = 3600;

export interface FichierPage {
  nom: string;
  type: string;
  taille: number;
  chemin: string;
  creeLe: string;
}

type Local = FichierPage & { donnees: Buffer };

function memoire(): Map<string, Map<string, Local>> {
  if (process.env.NODE_ENV === "production") throw new Error("supabase_non_configure");
  const g = globalThis as unknown as { __fichiersPages?: Map<string, Map<string, Local>> };
  return (g.__fichiersPages ??= new Map());
}

function tableAbsente(e: { code?: string; message?: string } | null): boolean {
  return !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message ?? ""));
}

export class MigrationFichiersManquante extends Error {
  constructor() {
    super("migration_036");
  }
}

function journal(event: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ tag: "getgents:fichiers", event, ...extra }));
}

export async function listerFichiers(pageId: string): Promise<FichierPage[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return Array.from(memoire().get(pageId)?.values() ?? []).map(({ donnees: _d, ...f }) => f);
  const { data, error } = await sb.from("pages_fichiers").select("nom, type, taille, chemin, cree_le").eq("page_id", pageId).order("cree_le");
  if (error) {
    if (tableAbsente(error)) throw new MigrationFichiersManquante();
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => ({ nom: r.nom, type: r.type, taille: r.taille, chemin: r.chemin, creeLe: r.cree_le }));
}

function extension(nom: string): string {
  return nom.slice(nom.lastIndexOf(".") + 1).toLowerCase();
}

export type Preparation =
  | { ok: true; mode: "supabase"; url: string; chemin: string }
  | { ok: true; mode: "local"; chemin: string }
  | { ok: false; refus: RefusFichier };

/** Vérifie nom, type, taille et plafonds, puis rend l'adresse d'envoi. */
export async function preparerEnvoi(pageId: string, f: { nom: string; type: string; taille: number }): Promise<Preparation> {
  const existants = await listerFichiers(pageId);
  const refus = validerFichier(f, existants);
  if (refus) return { ok: false, refus };
  // Chemin ALÉATOIRE : le nom affiché peut contenir accents et espaces, et un
  // remplacement ne doit pas écraser l'ancien avant confirmation.
  const chemin = `${pageId}/${randomUUID()}.${extension(f.nom)}`;
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: true, mode: "local", chemin };
  const { data, error } = await sb.storage.from(SEAU).createSignedUploadUrl(chemin);
  if (error || !data) {
    journal("preparation_echouee", { detail: error?.message });
    throw new Error(error?.message ?? "adresse d'envoi");
  }
  return { ok: true, mode: "supabase", url: data.signedUrl, chemin };
}

/** Développement sans Supabase seulement : le fichier arrive par l'application. */
export function envoiLocal(pageId: string, chemin: string, f: { nom: string; type: string }, donnees: Buffer): void {
  const m = memoire();
  const page = m.get(pageId) ?? new Map<string, Local>();
  m.set(pageId, page);
  page.set(f.nom, { nom: f.nom, type: f.type, taille: donnees.length, chemin, creeLe: new Date().toISOString(), donnees });
}

/**
 * Enregistre un fichier ENVOYÉ : relit l'objet (taille, type réels), revérifie
 * les plafonds, remplace un fichier du même nom (l'ancien objet est retiré).
 */
export async function confirmerEnvoi(pageId: string, f: { nom: string; chemin: string }): Promise<{ ok: true; fichier: FichierPage } | { ok: false; refus: RefusFichier | "absent" }> {
  if (!f.chemin.startsWith(`${pageId}/`) || f.chemin.includes("..")) return { ok: false, refus: "absent" };
  const sb = getSupabaseAdmin();
  if (!sb) {
    const l = memoire().get(pageId)?.get(f.nom);
    if (!l || l.chemin !== f.chemin) return { ok: false, refus: "absent" };
    const { donnees: _d, ...fichier } = l;
    return { ok: true, fichier };
  }
  const nomObjet = f.chemin.slice(pageId.length + 1);
  const { data: objets, error } = await sb.storage.from(SEAU).list(pageId, { search: nomObjet, limit: 5 });
  const objet = (objets ?? []).find((o) => o.name === nomObjet);
  if (error || !objet) return { ok: false, refus: "absent" };
  const meta = (objet.metadata ?? {}) as { size?: number; mimetype?: string };
  const reel = { nom: f.nom, type: String(meta.mimetype ?? ""), taille: Number(meta.size ?? 0) };
  const existants = await listerFichiers(pageId);
  const refus = validerFichier(reel, existants);
  if (refus) {
    await sb.storage.from(SEAU).remove([f.chemin]);
    return { ok: false, refus };
  }
  const ancien = existants.find((e) => e.nom === f.nom);
  const ligne = { page_id: pageId, nom: f.nom, type: reel.type, taille: reel.taille, chemin: f.chemin, cree_le: new Date().toISOString() };
  const { error: e2 } = await sb.from("pages_fichiers").upsert(ligne, { onConflict: "page_id,nom" });
  if (e2) {
    if (tableAbsente(e2)) throw new MigrationFichiersManquante();
    throw new Error(e2.message);
  }
  if (ancien && ancien.chemin !== f.chemin) await sb.storage.from(SEAU).remove([ancien.chemin]);
  journal("fichier_joint", { type: reel.type, taille: reel.taille, remplace: !!ancien });
  return { ok: true, fichier: { nom: f.nom, type: reel.type, taille: reel.taille, chemin: f.chemin, creeLe: ligne.cree_le } };
}

export async function supprimerFichier(pageId: string, nom: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return memoire().get(pageId)?.delete(nom) ?? false;
  const { data, error } = await sb.from("pages_fichiers").delete().eq("page_id", pageId).eq("nom", nom).select("chemin");
  if (error) throw new Error(error.message);
  const chemins = (data ?? []).map((r) => r.chemin as string);
  if (chemins.length) await sb.storage.from(SEAU).remove(chemins);
  return chemins.length > 0;
}

/** Page supprimée : ses fichiers partent avec elle (au mieux, sans bloquer). */
export async function supprimerFichiersPage(pageId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    memoire().delete(pageId);
    return;
  }
  const fichiers = await listerFichiers(pageId).catch(() => []);
  if (fichiers.length) await sb.storage.from(SEAU).remove(fichiers.map((f) => f.chemin));
  await sb.from("pages_fichiers").delete().eq("page_id", pageId);
}

/**
 * Le contenu d'une page à SERVIR : chaque référence à un fichier joint pointe
 * vers une adresse signée d'une heure (`data:` en mémoire locale). Toute
 * erreur rend le contenu tel quel : la page s'affiche, sans ses médias.
 */
export async function contenuAvecFichiers(pageId: string | null | undefined, contenu: string): Promise<string> {
  if (!pageId) return contenu;
  try {
    const sb = getSupabaseAdmin();
    if (!sb) {
      const page = memoire().get(pageId);
      if (!page?.size) return contenu;
      return avecFichiers(
        contenu,
        Array.from(page.values()).map((f) => ({ nom: f.nom, url: `data:${f.type};base64,${f.donnees.toString("base64")}` }))
      );
    }
    const fichiers = await listerFichiers(pageId);
    if (!fichiers.length) return contenu;
    const { data, error } = await sb.storage.from(SEAU).createSignedUrls(
      fichiers.map((f) => f.chemin),
      DUREE_ADRESSE_S
    );
    if (error || !data) throw new Error(error?.message ?? "adresses");
    const urls = new Map(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
    return avecFichiers(
      contenu,
      fichiers.flatMap((f) => (urls.get(f.chemin) ? [{ nom: f.nom, url: urls.get(f.chemin)! }] : []))
    );
  } catch (e) {
    if (!(e instanceof MigrationFichiersManquante)) journal("service_sans_fichiers", { detail: (e as Error).message });
    return contenu;
  }
}
