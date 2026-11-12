import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import type { DemandePartage, Fidelite, FormatArtefact } from "@/lib/mcpPartage";

/**
 * Artefacts partagés par le connecteur MCP (phase 0). Table
 * `artefacts_partages` (migration 019) ; sans Supabase, en développement
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

type Memoire = Map<string, ArtefactPartage>;
const memoire = (): Memoire => {
  const g = globalThis as unknown as { __artefactsPartages?: Memoire };
  return (g.__artefactsPartages ??= new Map());
};

export function nouveauJeton(): string {
  return randomBytes(24).toString("base64url");
}

export async function enregistrerArtefact(d: DemandePartage, f: Fidelite, client: string | null): Promise<ArtefactPartage> {
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
    memoire().set(a.jeton, a);
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
    a = memoire().get(jeton) ?? null;
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
