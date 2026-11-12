import { createHash, randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import {
  DUREE_ACCES_S,
  DUREE_CODE_MS,
  DUREE_RENOUVELLEMENT_MS,
  type ClientOAuth,
  type DemandeAutorisation,
} from "@/lib/oauthMcp";

/**
 * Stockage de l'autorisation du connecteur MCP (migration 020). Codes et
 * jetons ne sont JAMAIS gardés en clair : seule leur empreinte SHA-256.
 * Sans Supabase, en développement seulement, une mémoire locale tient lieu
 * de base pour exercer le parcours complet avec le client MCP officiel.
 *
 * Les passages qui consomment (code, renouvellement) sont des mises à jour
 * CONDITIONNELLES (`… is null` + `returning`) : deux requêtes simultanées
 * avec le même code ne peuvent pas obtenir deux jetons.
 */

const empreinte = (s: string) => createHash("sha256").update(s).digest("hex");
const aleatoire = (octets = 32) => randomBytes(octets).toString("base64url");

interface Code {
  clientId: string;
  userId: string;
  adresseRetour: string;
  codeChallenge: string;
  scope: string;
  expiresAt: number;
  usedAt: number | null;
}
interface Jeton {
  type: "acces" | "renouvellement";
  clientId: string;
  userId: string;
  scope: string;
  famille: string;
  expiresAt: number;
  revokedAt: number | null;
}
interface Memoire {
  clients: Map<string, ClientOAuth>;
  codes: Map<string, Code>;
  jetons: Map<string, Jeton>;
}
function memoire(): Memoire {
  if (process.env.NODE_ENV === "production") throw new Error("supabase_non_configure");
  const g = globalThis as unknown as { __oauthMcp?: Memoire };
  return (g.__oauthMcp ??= { clients: new Map(), codes: new Map(), jetons: new Map() });
}

function journal(event: string, detail: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ tag: "getgents:oauth-mcp", event, ...detail }));
}

export async function inscrireClient(nom: string, adressesRetour: string[]): Promise<ClientOAuth> {
  const client: ClientOAuth = { clientId: `mcp_${aleatoire(18)}`, nom, adressesRetour };
  const sb = getSupabaseAdmin();
  if (!sb) {
    memoire().clients.set(client.clientId, client);
  } else {
    const { error } = await sb.from("mcp_clients").insert({ client_id: client.clientId, nom, redirect_uris: adressesRetour });
    if (error) throw new Error(error.message);
  }
  journal("client_inscrit", { clientId: client.clientId, nom, sites: adressesRetour.map((a) => new URL(a).host) });
  return client;
}

export async function lireClient(clientId: string | undefined | null): Promise<ClientOAuth | null> {
  if (!clientId || clientId.length > 100) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return memoire().clients.get(clientId) ?? null;
  const { data, error } = await sb.from("mcp_clients").select("client_id, nom, redirect_uris").eq("client_id", clientId).maybeSingle();
  if (error || !data) return null;
  return { clientId: data.client_id, nom: data.nom, adressesRetour: data.redirect_uris ?? [] };
}

/** Le consentement donné : un code à usage unique, valable 5 minutes. */
export async function creerCode(d: DemandeAutorisation, userId: string): Promise<string> {
  const code = aleatoire();
  const ligne: Code = {
    clientId: d.clientId,
    userId,
    adresseRetour: d.adresseRetour,
    codeChallenge: d.codeChallenge,
    scope: d.scope,
    expiresAt: Date.now() + DUREE_CODE_MS,
    usedAt: null,
  };
  const sb = getSupabaseAdmin();
  if (!sb) {
    memoire().codes.set(empreinte(code), ligne);
  } else {
    const { error } = await sb.from("mcp_codes").insert({
      code_hash: empreinte(code),
      client_id: ligne.clientId,
      user_id: userId,
      redirect_uri: ligne.adresseRetour,
      code_challenge: ligne.codeChallenge,
      scope: ligne.scope,
      expires_at: new Date(ligne.expiresAt).toISOString(),
    });
    if (error) throw new Error(error.message);
  }
  journal("consentement", { clientId: d.clientId, userId });
  return code;
}

/** Consomme le code (une seule fois). Rend sa ligne, ou null s'il est inconnu, expiré ou déjà servi. */
export async function consommerCode(code: string): Promise<Code | null> {
  const h = empreinte(code);
  const sb = getSupabaseAdmin();
  let ligne: Code | null = null;
  if (!sb) {
    const c = memoire().codes.get(h);
    if (c && c.usedAt === null) {
      c.usedAt = Date.now();
      ligne = c;
    }
  } else {
    const { data } = await sb
      .from("mcp_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("code_hash", h)
      .is("used_at", null)
      .select("client_id, user_id, redirect_uri, code_challenge, scope, expires_at")
      .maybeSingle();
    if (data)
      ligne = {
        clientId: data.client_id,
        userId: data.user_id,
        adresseRetour: data.redirect_uri,
        codeChallenge: data.code_challenge,
        scope: data.scope,
        expiresAt: Date.parse(data.expires_at),
        usedAt: Date.now(),
      };
  }
  if (!ligne || ligne.expiresAt < Date.now()) return null;
  return ligne;
}

export interface PaireJetons {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export async function emettreJetons(clientId: string, userId: string, scope: string, famille = aleatoire(12)): Promise<PaireJetons> {
  const acces = aleatoire();
  const renouvellement = aleatoire();
  const maintenant = Date.now();
  const lignes: [string, Jeton][] = [
    [empreinte(acces), { type: "acces", clientId, userId, scope, famille, expiresAt: maintenant + DUREE_ACCES_S * 1000, revokedAt: null }],
    [
      empreinte(renouvellement),
      { type: "renouvellement", clientId, userId, scope, famille, expiresAt: maintenant + DUREE_RENOUVELLEMENT_MS, revokedAt: null },
    ],
  ];
  const sb = getSupabaseAdmin();
  if (!sb) {
    for (const [h, j] of lignes) memoire().jetons.set(h, j);
  } else {
    const { error } = await sb.from("mcp_jetons").insert(
      lignes.map(([h, j]) => ({
        hash: h,
        type: j.type,
        client_id: j.clientId,
        user_id: j.userId,
        scope: j.scope,
        famille: j.famille,
        expires_at: new Date(j.expiresAt).toISOString(),
      }))
    );
    if (error) throw new Error(error.message);
  }
  return { access_token: acces, token_type: "Bearer", expires_in: DUREE_ACCES_S, refresh_token: renouvellement, scope };
}

async function revoquerFamille(famille: string) {
  const sb = getSupabaseAdmin();
  if (!sb) {
    for (const j of Array.from(memoire().jetons.values())) if (j.famille === famille && j.revokedAt === null) j.revokedAt = Date.now();
    return;
  }
  await sb.from("mcp_jetons").update({ revoked_at: new Date().toISOString() }).eq("famille", famille).is("revoked_at", null);
}

/**
 * Renouvellement avec ROTATION : l'ancien jeton est révoqué, une nouvelle
 * paire émise dans la même famille. Un jeton déjà tourné qui revient est
 * un jeton volé (ou une copie) : toute la famille tombe, le commercial se
 * reconnecte une fois.
 */
export async function renouveler(jeton: string, clientId: string): Promise<PaireJetons | null> {
  const h = empreinte(jeton);
  const sb = getSupabaseAdmin();
  let ligne: Jeton | null = null;
  let dejaRevoque: Jeton | null = null;
  if (!sb) {
    const j = memoire().jetons.get(h);
    if (j?.type === "renouvellement") {
      if (j.revokedAt === null) {
        j.revokedAt = Date.now();
        ligne = j;
      } else dejaRevoque = j;
    }
  } else {
    const { data } = await sb
      .from("mcp_jetons")
      .update({ revoked_at: new Date().toISOString() })
      .eq("hash", h)
      .eq("type", "renouvellement")
      .is("revoked_at", null)
      .select("client_id, user_id, scope, famille, expires_at")
      .maybeSingle();
    if (data)
      ligne = {
        type: "renouvellement",
        clientId: data.client_id,
        userId: data.user_id,
        scope: data.scope,
        famille: data.famille,
        expiresAt: Date.parse(data.expires_at),
        revokedAt: Date.now(),
      };
    else {
      const { data: ancien } = await sb.from("mcp_jetons").select("famille, client_id").eq("hash", h).eq("type", "renouvellement").maybeSingle();
      if (ancien) dejaRevoque = { famille: ancien.famille, clientId: ancien.client_id } as Jeton;
    }
  }
  if (dejaRevoque) {
    await revoquerFamille(dejaRevoque.famille);
    journal("renouvellement_rejoue", { clientId: dejaRevoque.clientId });
    return null;
  }
  if (!ligne || ligne.expiresAt < Date.now() || ligne.clientId !== clientId) return null;
  return emettreJetons(ligne.clientId, ligne.userId, ligne.scope, ligne.famille);
}

export interface Porteur {
  userId: string;
  clientId: string;
  scope: string;
}

/** Le jeton d'accès présenté à /api/mcp : à qui il appartient, ou null. */
export async function verifierAcces(jeton: string): Promise<Porteur | null> {
  if (!/^[A-Za-z0-9_-]{30,100}$/.test(jeton)) return null;
  const h = empreinte(jeton);
  const sb = getSupabaseAdmin();
  let j: Jeton | null = null;
  if (!sb) {
    j = memoire().jetons.get(h) ?? null;
  } else {
    const { data } = await sb
      .from("mcp_jetons")
      .select("type, client_id, user_id, scope, famille, expires_at, revoked_at")
      .eq("hash", h)
      .maybeSingle();
    if (data)
      j = {
        type: data.type,
        clientId: data.client_id,
        userId: data.user_id,
        scope: data.scope,
        famille: data.famille,
        expiresAt: Date.parse(data.expires_at),
        revokedAt: data.revoked_at ? Date.parse(data.revoked_at) : null,
      };
  }
  if (!j || j.type !== "acces" || j.revokedAt !== null || j.expiresAt < Date.now()) return null;
  return { userId: j.userId, clientId: j.clientId, scope: j.scope };
}
