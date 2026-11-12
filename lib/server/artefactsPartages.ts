import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import type { DemandePartage, Fidelite, FormatArtefact, ResumePartage } from "@/lib/mcpPartage";
import { definirAssistantPage, lirePage, pagePourLien, trouverOuCreerPage, type Page } from "@/lib/server/pages";

/**
 * Artefacts partagés par le connecteur MCP. Table `artefacts_partages`
 * (migrations 019 et 020 : `owner_id`) ; sans Supabase, en développement
 * seulement, une mémoire locale tient lieu de base pour essayer le connecteur.
 */

export interface ArtefactPartage {
  jeton: string;
  titre: string;
  contenu: string;
  format: FormatArtefact;
  destinataire: string;
  message: string | null;
  caracteres: number;
  client: string | null;
  createdAt: string;
  expiresAt: string | null;
  /** Assistant du document activé (migration 021). */
  assistant: boolean;
  /** Questions déjà posées à l'assistant sur ce lien. */
  questions: number;
  /** Compte du commercial : c'est lui qui paie l'assistant. Null pour un partage de la clé d'essai. */
  ownerId: string | null;
  /** Page partagée (migration 022). Null pour un partage antérieur sans propriétaire. */
  pageId: string | null;
  /** Version de la page affichée, et date de sa mise à jour si elle a changé depuis la première. */
  version: number;
  misAJourLe: string | null;
}

/** Durée de vie d'un lien d'essai : 30 jours. */
export const DUREE_LIEN_MS = 30 * 24 * 3600 * 1000;

type Memoire = Map<string, ArtefactPartage & { revokedAt: string | null }>;
const memoire = (): Memoire => {
  const g = globalThis as unknown as { __artefactsPartages?: Memoire };
  return (g.__artefactsPartages ??= new Map());
};

export function nouveauJeton(): string {
  return randomBytes(24).toString("base64url");
}

export interface Proprietaire {
  userId: string;
  clientId: string;
}

/**
 * Partage une page à un destinataire. Deux chemins :
 *   - `pageId` donné : la page EXISTE (repartage) — aucun contenu recopié ;
 *   - sinon : le contenu envoyé retrouve sa page (même empreinte) ou en crée une.
 * Le partage ne garde pas de copie du document : le lien lit la page, donc
 * sa DERNIÈRE version. Rend null si `pageId` ne désigne aucune page du compte.
 */
export async function enregistrerArtefact(
  d: DemandePartage,
  f: Fidelite | null,
  client: string | null,
  proprietaire: Proprietaire,
  origine: string | null = null
): Promise<(ArtefactPartage & { nouvellePage: boolean }) | null> {
  let page: Page | null;
  let nouvellePage = false;
  if (d.pageId) {
    page = await lirePage(proprietaire.userId, d.pageId);
    if (!page) return null;
    if (d.assistant && !page.assistant) {
      await definirAssistantPage(proprietaire.userId, page.id, true);
      page = { ...page, assistant: true };
    }
  } else {
    const r = await trouverOuCreerPage(proprietaire.userId, {
      titre: d.titre,
      format: d.format,
      contenu: d.contenu,
      origine,
      assistant: d.assistant === true,
    });
    page = r.page;
    nouvellePage = r.nouvelle;
  }
  const maintenant = new Date();
  const a: ArtefactPartage = {
    jeton: nouveauJeton(),
    titre: page.titre,
    contenu: page.contenu,
    format: page.format,
    destinataire: d.destinataire,
    message: d.message ?? null,
    caracteres: f?.caracteres ?? page.contenu.length,
    client: client ? client.slice(0, 200) : null,
    createdAt: maintenant.toISOString(),
    expiresAt: new Date(maintenant.getTime() + DUREE_LIEN_MS).toISOString(),
    assistant: page.assistant,
    questions: 0,
    ownerId: proprietaire.userId,
    pageId: page.id,
    version: page.version,
    misAJourLe: page.version > 1 ? page.updatedAt : null,
  };
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    memoire().set(a.jeton, { ...a, revokedAt: null });
    return { ...a, nouvellePage };
  }
  const { error } = await supabase.from("artefacts_partages").insert({
    jeton: a.jeton,
    titre: a.titre,
    // La page porte le document : pas de seconde copie par destinataire.
    contenu: "",
    format: a.format,
    destinataire: a.destinataire,
    message: a.message,
    caracteres: a.caracteres,
    client: a.client,
    expires_at: a.expiresAt,
    owner_id: proprietaire.userId,
    mcp_client_id: proprietaire.clientId,
    page_id: page.id,
  });
  if (error) {
    console.error(JSON.stringify({ tag: "getgents:partage", event: "enregistrement_echoue", detail: error.message }));
    throw new Error(error.message);
  }
  return { ...a, nouvellePage };
}

/**
 * Un lien expiré ou révoqué n'existe plus pour le visiteur. Un partage
 * rattaché à une page affiche la page (dernière version, son assistant) ;
 * un partage ancien sans page (clé d'essai) garde sa propre copie.
 */
export async function lireArtefact(jeton: string): Promise<ArtefactPartage | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(jeton)) return null;
  const supabase = getSupabaseAdmin();
  let a: ArtefactPartage | null = null;
  if (!supabase) {
    const m = memoire().get(jeton);
    a = m && !m.revokedAt ? { ...m } : null;
  } else {
    const { data, error } = await supabase
      .from("artefacts_partages")
      .select("jeton, titre, contenu, format, destinataire, message, caracteres, client, created_at, expires_at, revoked_at, owner_id, assistant, questions, page_id")
      .eq("jeton", jeton)
      .maybeSingle();
    if (error) {
      console.error(JSON.stringify({ tag: "getgents:partage", event: "lecture_echouee", detail: error.message }));
      return null;
    }
    if (!data || data.revoked_at) return null;
    a = {
      jeton: data.jeton,
      titre: data.titre,
      contenu: data.contenu,
      format: data.format,
      destinataire: data.destinataire,
      message: data.message,
      caracteres: data.caracteres,
      client: data.client,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      assistant: data.assistant === true,
      questions: data.questions ?? 0,
      ownerId: data.owner_id ?? null,
      pageId: data.page_id ?? null,
      version: 1,
      misAJourLe: null,
    };
  }
  if (a?.expiresAt && Date.parse(a.expiresAt) < Date.now()) return null;
  if (a?.pageId) {
    let page: Page | null = null;
    try {
      page = await pagePourLien(a.pageId);
    } catch (e) {
      console.error(JSON.stringify({ tag: "getgents:partage", event: "lecture_page_echouee", detail: (e as Error).message }));
      return null;
    }
    // Page supprimée : tous ses liens tombent.
    if (!page) return null;
    a = {
      ...a,
      titre: page.titre,
      contenu: page.contenu,
      format: page.format,
      assistant: page.assistant,
      version: page.version,
      misAJourLe: page.version > 1 ? page.updatedAt : null,
    };
  }
  return a;
}

/**
 * Les partages d'un compte, du plus récent au plus ancien — sans le contenu,
 * qui peut peser 2 Mo par ligne et ne sert pas à une liste.
 */
export async function listerPartages(ownerId: string, limite = 100): Promise<ResumePartage[]> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    return Array.from(memoire().values())
      .filter((m) => m.ownerId === ownerId)
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
      .slice(0, limite)
      .map((m) => ({
        jeton: m.jeton,
        titre: m.titre,
        format: m.format,
        destinataire: m.destinataire,
        caracteres: m.caracteres,
        createdAt: m.createdAt,
        expiresAt: m.expiresAt,
        revokedAt: m.revokedAt,
        assistant: m.assistant,
        pageId: m.pageId,
      }));
  }
  const { data, error } = await sb
    .from("artefacts_partages")
    .select("jeton, titre, format, destinataire, caracteres, created_at, expires_at, revoked_at, assistant, page_id, pages(titre, assistant)")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) {
    console.error(JSON.stringify({ tag: "getgents:partage", event: "liste_echouee", detail: error.message }));
    throw new Error(error.message);
  }
  return (data ?? []).map((d) => {
    // La page fait foi pour le titre et l'assistant (réglé par page).
    const page = (Array.isArray(d.pages) ? d.pages[0] : d.pages) as { titre: string; assistant: boolean } | null;
    return {
      jeton: d.jeton,
      titre: page?.titre ?? d.titre,
      format: d.format,
      destinataire: d.destinataire,
      caracteres: d.caracteres,
      createdAt: d.created_at,
      expiresAt: d.expires_at,
      revokedAt: d.revoked_at,
      assistant: page ? page.assistant === true : d.assistant === true,
      pageId: d.page_id ?? null,
    };
  });
}

/**
 * Révoque un partage DE CE COMPTE. Le filtre sur `owner_id` est la garde :
 * connaître le jeton d'autrui ne suffit pas. Rend vrai si un lien actif a
 * été coupé, faux s'il n'existe pas, n'est pas à ce compte, ou l'était déjà.
 */
export async function revoquerPartage(ownerId: string, jeton: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(jeton)) return false;
  const sb = getSupabaseAdmin();
  if (!sb) {
    const m = memoire().get(jeton);
    if (!m || m.ownerId !== ownerId || m.revokedAt) return false;
    m.revokedAt = new Date().toISOString();
    return true;
  }
  const { data, error } = await sb
    .from("artefacts_partages")
    .update({ revoked_at: new Date().toISOString() })
    .eq("jeton", jeton)
    .eq("owner_id", ownerId)
    .is("revoked_at", null)
    .select("jeton");
  if (error) throw new Error(error.message);
  const coupe = (data ?? []).length > 0;
  if (coupe) console.log(JSON.stringify({ tag: "getgents:partage", event: "partage_revoque", ownerId }));
  return coupe;
}

/**
 * Active ou coupe l'assistant depuis un partage DE CE COMPTE. L'assistant se
 * règle PAR PAGE : basculer depuis un lien vaut pour tous les liens de la page.
 * Un ancien partage sans page garde son réglage propre.
 */
export async function definirAssistant(ownerId: string, jeton: string, actif: boolean): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(jeton)) return false;
  const sb = getSupabaseAdmin();
  if (!sb) {
    const m = memoire().get(jeton);
    if (!m || m.ownerId !== ownerId) return false;
    if (m.pageId) return definirAssistantPage(ownerId, m.pageId, actif);
    m.assistant = actif;
    return true;
  }
  const { data: ligne } = await sb.from("artefacts_partages").select("page_id").eq("jeton", jeton).eq("owner_id", ownerId).maybeSingle();
  if (!ligne) return false;
  if (ligne.page_id) return definirAssistantPage(ownerId, ligne.page_id, actif);
  const { data, error } = await sb
    .from("artefacts_partages")
    .update({ assistant: actif })
    .eq("jeton", jeton)
    .eq("owner_id", ownerId)
    .select("jeton");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/**
 * Compte une question posée à l'assistant. Rend faux si le plafond est
 * atteint. Mise à jour CONDITIONNELLE sur l'ancienne valeur : deux questions
 * simultanées ne passent pas toutes deux sous le plafond (au pire, l'une est
 * refusée à tort et le visiteur la repose).
 */
export async function compterQuestion(jeton: string, plafond: number): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    const m = memoire().get(jeton);
    if (!m || m.questions >= plafond) return false;
    m.questions += 1;
    return true;
  }
  const { data } = await sb.from("artefacts_partages").select("questions").eq("jeton", jeton).maybeSingle();
  const avant = data?.questions ?? 0;
  if (avant >= plafond) return false;
  const { data: maj } = await sb
    .from("artefacts_partages")
    .update({ questions: avant + 1 })
    .eq("jeton", jeton)
    .eq("questions", avant)
    .select("jeton");
  return (maj ?? []).length > 0;
}
