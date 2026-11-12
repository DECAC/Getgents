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

// ——— Rubrique « Pages » : liste, fiche, versions, suppression (lot B) ———

export interface DestinatairePage {
  jeton: string;
  destinataire: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  questions: number;
}

export interface ResumePage {
  id: string;
  titre: string;
  format: FormatArtefact;
  origine: string | null;
  assistant: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  /** Liens ni révoqués ni expirés. */
  actifs: number;
  /** Tous les liens, révoqués et expirés compris. */
  liens: number;
  /** Date d'expiration la plus lointaine parmi les liens actifs. */
  expireLe: string | null;
  /** Le lien actif le plus récent : ce qu'ouvre « Voir comme le client ». */
  dernierJeton: string | null;
}

export interface VersionPage {
  version: number;
  titre: string;
  createdAt: string;
}

const estActif = (d: { revokedAt: string | null; expiresAt: string | null }, maintenant = Date.now()) =>
  !d.revokedAt && !(d.expiresAt && Date.parse(d.expiresAt) < maintenant);

/** Le partage tel que la rubrique le lit (sans contenu : 2 Mo par ligne). */
async function liensDuCompte(ownerId: string): Promise<(DestinatairePage & { pageId: string | null })[]> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    const g = globalThis as unknown as {
      __artefactsPartages?: Map<string, { ownerId: string | null; pageId: string | null; jeton: string; destinataire: string; createdAt: string; expiresAt: string | null; revokedAt: string | null; questions: number }>;
    };
    return Array.from(g.__artefactsPartages?.values() ?? [])
      .filter((m) => m.ownerId === ownerId)
      .map((m) => ({ jeton: m.jeton, destinataire: m.destinataire, createdAt: m.createdAt, expiresAt: m.expiresAt, revokedAt: m.revokedAt, questions: m.questions, pageId: m.pageId }));
  }
  const { data, error } = await sb
    .from("artefacts_partages")
    .select("jeton, destinataire, created_at, expires_at, revoked_at, questions, page_id")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => ({
    jeton: d.jeton,
    destinataire: d.destinataire,
    createdAt: d.created_at,
    expiresAt: d.expires_at,
    revokedAt: d.revoked_at,
    questions: d.questions ?? 0,
    pageId: d.page_id ?? null,
  }));
}

/** Les pages du compte, de la plus récemment modifiée à la plus ancienne, avec leurs compteurs de liens. */
export async function listerPages(ownerId: string): Promise<ResumePage[]> {
  const sb = getSupabaseAdmin();
  let pages: Page[];
  if (!sb) {
    pages = Array.from(memoire().pages.values()).filter((p) => p.ownerId === ownerId && !p.supprimeeAt);
  } else {
    const { data, error } = await sb
      .from("pages")
      .select("id, owner_id, titre, format, origine, assistant, version, created_at, updated_at")
      .eq("owner_id", ownerId)
      .is("supprimee_at", null)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    pages = (data ?? []).map((d) => depuisLigne({ ...(d as Omit<Ligne, "contenu">), contenu: "" }));
  }
  const liens = await liensDuCompte(ownerId);
  const maintenant = Date.now();
  return pages
    .map((p) => {
      const siens = liens.filter((l) => l.pageId === p.id);
      const actifs = siens.filter((l) => estActif(l, maintenant));
      const expireLe = actifs.map((l) => l.expiresAt).filter((x): x is string => !!x).sort().pop() ?? null;
      return {
        id: p.id,
        titre: p.titre,
        format: p.format,
        origine: p.origine,
        assistant: p.assistant,
        version: p.version,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        actifs: actifs.length,
        liens: siens.length,
        expireLe,
        dernierJeton: [...actifs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.jeton ?? null,
      };
    })
    .sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
}

export interface DetailPage extends Omit<Page, "contenu"> {
  destinataires: DestinatairePage[];
  versions: VersionPage[];
  questions: number;
}

/** La fiche d'une page : ses destinataires et ses versions. Null si elle n'est pas à ce compte. */
export async function detailPage(ownerId: string, id: string): Promise<DetailPage | null> {
  const page = await lirePage(ownerId, id);
  if (!page) return null;
  const destinataires = (await liensDuCompte(ownerId))
    .filter((l) => l.pageId === id)
    .map(({ pageId: _p, ...l }) => l);
  let versions: VersionPage[];
  const sb = getSupabaseAdmin();
  if (!sb) {
    versions = (memoire().versions.get(id) ?? []).map((v) => ({ version: v.version, titre: v.titre, createdAt: v.createdAt }));
  } else {
    const { data, error } = await sb.from("pages_versions").select("version, titre, created_at").eq("page_id", id).order("version", { ascending: false });
    if (error) throw new Error(error.message);
    versions = (data ?? []).map((v) => ({ version: v.version, titre: v.titre, createdAt: v.created_at }));
  }
  versions.sort((a, b) => b.version - a.version);
  const { contenu: _c, ...meta } = page;
  return { ...meta, destinataires, versions, questions: destinataires.reduce((n, d) => n + d.questions, 0) };
}

/**
 * Restaure une version ANCIENNE en la remettant en tête, comme une nouvelle
 * version : la version actuelle est rangée à son tour — restaurer est
 * lui-même un changement, rien n'est détruit.
 */
export async function restaurerVersion(ownerId: string, id: string, version: number): Promise<Page | null> {
  const page = await lirePage(ownerId, id);
  if (!page || !Number.isInteger(version)) return null;
  let ancienne: { titre: string; format: FormatArtefact; contenu: string } | null = null;
  const sb = getSupabaseAdmin();
  if (!sb) {
    const v = (memoire().versions.get(id) ?? []).find((x) => x.version === version);
    ancienne = v ? { titre: v.titre, format: v.format, contenu: v.contenu } : null;
  } else {
    const { data } = await sb.from("pages_versions").select("titre, format, contenu").eq("page_id", id).eq("version", version).maybeSingle();
    ancienne = data ? { titre: data.titre, format: data.format, contenu: data.contenu } : null;
  }
  if (!ancienne) return null;
  return mettreAJourPage(ownerId, id, ancienne);
}

/**
 * Supprime une page : elle disparaît de la rubrique et TOUS ses liens
 * tombent. Marquée, pas effacée — les lignes restent, sans plus rien servir.
 */
export async function supprimerPage(ownerId: string, id: string): Promise<boolean> {
  if (!estIdPage(id)) return false;
  const maintenant = new Date().toISOString();
  const sb = getSupabaseAdmin();
  if (!sb) {
    const p = memoire().pages.get(id);
    if (!p || p.ownerId !== ownerId || p.supprimeeAt) return false;
    p.supprimeeAt = maintenant;
    return true;
  }
  const { data, error } = await sb
    .from("pages")
    .update({ supprimee_at: maintenant })
    .eq("id", id)
    .eq("owner_id", ownerId)
    .is("supprimee_at", null)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/** Contenu d'une page pour l'aperçu de son PROPRIÉTAIRE (fiche, vignettes). */
export async function contenuPourProprietaire(ownerId: string, id: string): Promise<Page | null> {
  return lirePage(ownerId, id);
}
