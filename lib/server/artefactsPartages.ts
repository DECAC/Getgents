import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import type { DemandePartage, Fidelite, FormatArtefact, ResumePartage } from "@/lib/mcpPartage";

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
}

/** Durée de vie d'un lien d'essai : 30 jours. */
export const DUREE_LIEN_MS = 30 * 24 * 3600 * 1000;

type Memoire = Map<string, ArtefactPartage & { ownerId: string | null; revokedAt: string | null }>;
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

export async function enregistrerArtefact(
  d: DemandePartage,
  f: Fidelite,
  client: string | null,
  proprietaire: Proprietaire | null = null
): Promise<ArtefactPartage> {
  const maintenant = new Date();
  const a: ArtefactPartage = {
    jeton: nouveauJeton(),
    titre: d.titre,
    contenu: d.contenu,
    format: d.format,
    destinataire: d.destinataire,
    message: d.message ?? null,
    caracteres: f.caracteres,
    client: client ? client.slice(0, 200) : null,
    createdAt: maintenant.toISOString(),
    expiresAt: new Date(maintenant.getTime() + DUREE_LIEN_MS).toISOString(),
  };
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    if (process.env.NODE_ENV === "production") throw new Error("supabase_non_configure");
    memoire().set(a.jeton, { ...a, ownerId: proprietaire?.userId ?? null, revokedAt: null });
    return a;
  }
  const { error } = await supabase.from("artefacts_partages").insert({
    jeton: a.jeton,
    titre: a.titre,
    contenu: a.contenu,
    format: a.format,
    destinataire: a.destinataire,
    message: a.message,
    caracteres: a.caracteres,
    client: a.client,
    expires_at: a.expiresAt,
    // Sans propriétaire (clé d'essai), on n'écrit pas les colonnes de la
    // migration 020 : la phase 0 reste valable avant que celle-ci soit passée.
    ...(proprietaire ? { owner_id: proprietaire.userId, mcp_client_id: proprietaire.clientId } : {}),
  });
  if (error) {
    console.error(JSON.stringify({ tag: "getgents:partage", event: "enregistrement_echoue", detail: error.message }));
    throw new Error(error.message);
  }
  return a;
}

/** Un lien expiré ou révoqué n'existe plus pour le visiteur. */
export async function lireArtefact(jeton: string): Promise<ArtefactPartage | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(jeton)) return null;
  const supabase = getSupabaseAdmin();
  let a: ArtefactPartage | null = null;
  if (!supabase) {
    const m = memoire().get(jeton);
    a = m && !m.revokedAt ? m : null;
  } else {
    const { data, error } = await supabase
      .from("artefacts_partages")
      .select("jeton, titre, contenu, format, destinataire, message, caracteres, client, created_at, expires_at, revoked_at")
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
    };
  }
  if (a?.expiresAt && Date.parse(a.expiresAt) < Date.now()) return null;
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
      }));
  }
  const { data, error } = await sb
    .from("artefacts_partages")
    .select("jeton, titre, format, destinataire, caracteres, created_at, expires_at, revoked_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) {
    console.error(JSON.stringify({ tag: "getgents:partage", event: "liste_echouee", detail: error.message }));
    throw new Error(error.message);
  }
  return (data ?? []).map((d) => ({
    jeton: d.jeton,
    titre: d.titre,
    format: d.format,
    destinataire: d.destinataire,
    caracteres: d.caracteres,
    createdAt: d.created_at,
    expiresAt: d.expires_at,
    revokedAt: d.revoked_at,
  }));
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
