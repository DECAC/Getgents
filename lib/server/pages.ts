import { createHash, randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import type { FormatArtefact } from "@/lib/mcpPartage";

/**
 * Pages (rubrique GetSite, migration 022) : le document partagé, sa version
 * courante et son assistant. Chaque partage (`artefacts_partages`) désigne
 * une page ; les liens affichent toujours la DERNIÈRE version.
 *
 * Toute lecture et toute écriture filtrent sur le PROPRIÉTAIRE : connaître
 * l'identifiant d'une page d'autrui ne donne rien.
 */

export interface Page {
  id: string;
  ownerId: string;
  titre: string;
  format: FormatArtefact;
  contenu: string;
  origine: string | null;
  assistant: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** Versions précédentes gardées par page : au-delà, les plus anciennes partent. */
export const VERSIONS_MAX = 20;

export const empreinteContenu = (contenu: string) => createHash("md5").update(contenu).digest("hex");

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const estIdPage = (id: unknown): id is string => typeof id === "string" && ID_RE.test(id);

interface Memoire {
  pages: Map<string, Page & { empreinte: string; supprimeeAt: string | null }>;
  versions: Map<string, { version: number; titre: string; format: FormatArtefact; contenu: string; createdAt: string }[]>;
}
function memoire(): Memoire {
  if (process.env.NODE_ENV === "production") throw new Error("supabase_non_configure");
  const g = globalThis as unknown as { __pagesGetsite?: Memoire };
  return (g.__pagesGetsite ??= { pages: new Map(), versions: new Map() });
}

const COLONNES = "id, owner_id, titre, format, contenu, origine, assistant, version, created_at, updated_at";
type Ligne = {
  id: string;
  owner_id: string;
  titre: string;
  format: FormatArtefact;
  contenu: string;
  origine: string | null;
  assistant: boolean;
  version: number;
  created_at: string;
  updated_at: string;
};
const depuisLigne = (d: Ligne): Page => ({
  id: d.id,
  ownerId: d.owner_id,
  titre: d.titre,
  format: d.format,
  contenu: d.contenu,
  origine: d.origine,
  assistant: d.assistant === true,
  version: d.version,
  createdAt: d.created_at,
  updatedAt: d.updated_at,
});

export async function lirePage(ownerId: string, id: string): Promise<Page | null> {
  if (!estIdPage(id)) return null;
  const sb = getSupabaseAdmin();
  if (!sb) {
    const p = memoire().pages.get(id);
    return p && p.ownerId === ownerId && !p.supprimeeAt ? p : null;
  }
  const { data, error } = await sb.from("pages").select(COLONNES).eq("id", id).eq("owner_id", ownerId).is("supprimee_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? depuisLigne(data as Ligne) : null;
}

/**
 * La page de ce contenu, créée si elle n'existe pas encore. Un contenu
 * re-partagé À L'IDENTIQUE (même empreinte, même compte) retrouve sa page :
 * partager deux fois le même document ne crée pas deux pages. Demander
 * l'assistant l'active ; ne pas le demander ne le coupe pas.
 */
export async function trouverOuCreerPage(
  ownerId: string,
  d: { titre: string; format: FormatArtefact; contenu: string; origine: string | null; assistant: boolean }
): Promise<{ page: Page; nouvelle: boolean }> {
  const empreinte = empreinteContenu(d.contenu);
  const maintenant = new Date().toISOString();
  const sb = getSupabaseAdmin();
  if (!sb) {
    const m = memoire();
    const existante = Array.from(m.pages.values()).find((p) => p.ownerId === ownerId && p.empreinte === empreinte && !p.supprimeeAt);
    if (existante) {
      if (d.assistant) existante.assistant = true;
      return { page: existante, nouvelle: false };
    }
    const page = {
      id: randomUUID(),
      ownerId,
      titre: d.titre,
      format: d.format,
      contenu: d.contenu,
      origine: d.origine,
      assistant: d.assistant,
      version: 1,
      createdAt: maintenant,
      updatedAt: maintenant,
      empreinte,
      supprimeeAt: null,
    };
    m.pages.set(page.id, page);
    return { page, nouvelle: true };
  }
  const { data: existante, error: e1 } = await sb
    .from("pages")
    .select(COLONNES)
    .eq("owner_id", ownerId)
    .eq("empreinte", empreinte)
    .is("supprimee_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (existante) {
    const page = depuisLigne(existante as Ligne);
    if (d.assistant && !page.assistant) {
      await sb.from("pages").update({ assistant: true }).eq("id", page.id).eq("owner_id", ownerId);
      page.assistant = true;
    }
    return { page, nouvelle: false };
  }
  const { data, error } = await sb
    .from("pages")
    .insert({ owner_id: ownerId, titre: d.titre, format: d.format, contenu: d.contenu, empreinte, origine: d.origine, assistant: d.assistant })
    .select(COLONNES)
    .single();
  if (error) throw new Error(error.message);
  return { page: depuisLigne(data as Ligne), nouvelle: true };
}

/**
 * Nouvelle version d'une page. L'état précédent est RANGÉ (pages_versions)
 * avant d'être remplacé : rien n'est perdu, tout se restaure. Rend null si
 * la page n'existe pas ou n'est pas à ce compte.
 */
export async function mettreAJourPage(
  ownerId: string,
  id: string,
  d: { contenu: string; titre?: string; format?: FormatArtefact }
): Promise<Page | null> {
  const avant = await lirePage(ownerId, id);
  if (!avant) return null;
  const maintenant = new Date().toISOString();
  const suivante = {
    titre: d.titre?.trim() || avant.titre,
    format: d.format ?? avant.format,
    contenu: d.contenu,
    version: avant.version + 1,
  };
  const sb = getSupabaseAdmin();
  if (!sb) {
    const m = memoire();
    const liste = m.versions.get(id) ?? [];
    liste.push({ version: avant.version, titre: avant.titre, format: avant.format, contenu: avant.contenu, createdAt: avant.updatedAt });
    m.versions.set(id, liste.slice(-VERSIONS_MAX));
    const p = m.pages.get(id)!;
    Object.assign(p, suivante, { empreinte: empreinteContenu(d.contenu), updatedAt: maintenant });
    return { ...p };
  }
  const { error: e1 } = await sb.from("pages_versions").upsert({
    page_id: id,
    version: avant.version,
    titre: avant.titre,
    format: avant.format,
    contenu: avant.contenu,
    created_at: avant.updatedAt,
  });
  if (e1) throw new Error(e1.message);
  // Mise à jour CONDITIONNELLE sur la version lue : deux mises à jour
  // simultanées ne s'écrasent pas en silence, la seconde échoue.
  const { data, error } = await sb
    .from("pages")
    .update({ ...suivante, empreinte: empreinteContenu(d.contenu), updated_at: maintenant })
    .eq("id", id)
    .eq("owner_id", ownerId)
    .eq("version", avant.version)
    .select(COLONNES)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("mise_a_jour_concurrente");
  // Au-delà de VERSIONS_MAX, les plus anciennes partent.
  await sb.from("pages_versions").delete().eq("page_id", id).lte("version", suivante.version - 1 - VERSIONS_MAX);
  return depuisLigne(data as Ligne);
}

/** Active ou coupe l'assistant d'une page de ce compte (tous ses liens). */
export async function definirAssistantPage(ownerId: string, id: string, actif: boolean): Promise<boolean> {
  if (!estIdPage(id)) return false;
  const sb = getSupabaseAdmin();
  if (!sb) {
    const p = memoire().pages.get(id);
    if (!p || p.ownerId !== ownerId) return false;
    p.assistant = actif;
    return true;
  }
  const { data, error } = await sb.from("pages").update({ assistant: actif }).eq("id", id).eq("owner_id", ownerId).select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/** Lecture d'une page pour un LIEN (sans contrôle de propriétaire : le jeton du partage a déjà fait l'accès). */
export async function pagePourLien(id: string): Promise<Page | null> {
  if (!estIdPage(id)) return null;
  const sb = getSupabaseAdmin();
  if (!sb) {
    const p = memoire().pages.get(id);
    return p && !p.supprimeeAt ? p : null;
  }
  const { data, error } = await sb.from("pages").select(COLONNES).eq("id", id).is("supprimee_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? depuisLigne(data as Ligne) : null;
}
