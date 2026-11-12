/**
 * Autorisation du connecteur MCP — PHASE 1, lot 1 (11/2026).
 *
 * Le commercial ajoute `https://getgents.ai/api/mcp` dans Claude ; Claude
 * découvre qu'il faut une autorisation (réponse 401 + métadonnées), s'inscrit
 * tout seul (enregistrement dynamique de client, RFC 7591), envoie le
 * commercial sur /oauth/autoriser où il se connecte et consent, puis échange
 * le code contre un jeton (OAuth 2.1, PKCE S256 obligatoire). Chaque partage
 * est alors rattaché à SON compte — fini la clé unique dans l'adresse.
 *
 * Module PUR : validation des demandes et des adresses de retour. Le
 * stockage (jetons hachés) vit dans lib/server/oauthMcp.ts.
 */

import { createHash } from "crypto";

export const SCOPE_PARTAGE = "partage";
/** Un code d'autorisation ne sert qu'une fois, et pas longtemps. */
export const DUREE_CODE_MS = 5 * 60 * 1000;
/** Jeton d'accès court : un jeton volé ne sert qu'une heure. */
export const DUREE_ACCES_S = 3600;
/** Jeton de renouvellement : le commercial ne se reconnecte qu'une fois par mois au plus. */
export const DUREE_RENOUVELLEMENT_MS = 30 * 24 * 3600 * 1000;

export const NOM_CLIENT_MAX = 100;
export const ADRESSES_RETOUR_MAX = 5;

/**
 * Adresse de retour acceptable : HTTPS, ou http sur la machine elle-même
 * (clients de développement, inspecteur MCP). Jamais de fragment, jamais de
 * schéma exotique (`javascript:`, `data:`) : c'est là qu'on enverrait le code.
 */
export function adresseRetourValide(uri: unknown): uri is string {
  if (typeof uri !== "string" || uri.length > 500) return false;
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]");
}

export interface ClientOAuth {
  clientId: string;
  nom: string;
  adressesRetour: string[];
}

export type Inscription = { ok: true; nom: string; adressesRetour: string[] } | { ok: false; erreur: string; description: string };

/** Corps d'un enregistrement dynamique de client (RFC 7591), réduit à ce qu'on accepte. */
export function validerInscription(corps: unknown): Inscription {
  const c = (corps && typeof corps === "object" ? corps : {}) as Record<string, unknown>;
  const adresses = Array.isArray(c.redirect_uris) ? c.redirect_uris : [];
  if (!adresses.length) return { ok: false, erreur: "invalid_redirect_uri", description: "redirect_uris est obligatoire." };
  if (adresses.length > ADRESSES_RETOUR_MAX)
    return { ok: false, erreur: "invalid_redirect_uri", description: `${ADRESSES_RETOUR_MAX} adresses de retour au plus.` };
  if (!adresses.every(adresseRetourValide))
    return { ok: false, erreur: "invalid_redirect_uri", description: "Adresse de retour refusée (HTTPS obligatoire, sans fragment)." };
  const methode = c.token_endpoint_auth_method;
  if (methode !== undefined && methode !== "none")
    return { ok: false, erreur: "invalid_client_metadata", description: "Seuls les clients publics (PKCE, sans secret) sont acceptés." };
  const nom = (typeof c.client_name === "string" ? c.client_name : "").trim().slice(0, NOM_CLIENT_MAX) || "Client sans nom";
  return { ok: true, nom, adressesRetour: adresses as string[] };
}

export interface DemandeAutorisation {
  clientId: string;
  adresseRetour: string;
  codeChallenge: string;
  state: string | null;
  scope: string;
}

export type ValidationDemande =
  | { ok: true; demande: DemandeAutorisation }
  /** Erreur qu'on ne peut PAS renvoyer au client (adresse de retour douteuse) : on l'affiche. */
  | { ok: false; afficher: string }
  /** Erreur à renvoyer à l'adresse de retour, qui est sûre. */
  | { ok: false; renvoyer: { adresseRetour: string; erreur: string; description: string; state: string | null } };

/**
 * Vérifie une demande d'autorisation. L'ordre compte : tant que le client et
 * son adresse de retour ne sont pas établis, on n'y renvoie RIEN — sans quoi
 * n'importe qui ferait rediriger Getgents vers l'adresse de son choix.
 */
export function validerDemande(p: Record<string, string | undefined>, client: ClientOAuth | null): ValidationDemande {
  if (!client) return { ok: false, afficher: "Application inconnue : recommencez la connexion depuis Claude." };
  const adresseRetour = p.redirect_uri ?? (client.adressesRetour.length === 1 ? client.adressesRetour[0] : "");
  if (!adresseRetour || !client.adressesRetour.includes(adresseRetour))
    return { ok: false, afficher: "Adresse de retour non déclarée par l'application : connexion refusée." };
  const state = p.state ?? null;
  const renvoyer = (erreur: string, description: string) => ({ ok: false as const, renvoyer: { adresseRetour, erreur, description, state } });
  if (p.response_type !== "code") return renvoyer("unsupported_response_type", "Seul response_type=code est accepté.");
  if (!p.code_challenge || p.code_challenge_method !== "S256")
    return renvoyer("invalid_request", "PKCE obligatoire (code_challenge, méthode S256).");
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(p.code_challenge)) return renvoyer("invalid_request", "code_challenge malformé.");
  const scope = (p.scope ?? SCOPE_PARTAGE).trim() || SCOPE_PARTAGE;
  if (scope.split(/\s+/).some((s) => s !== SCOPE_PARTAGE)) return renvoyer("invalid_scope", `Seul le scope « ${SCOPE_PARTAGE} » existe.`);
  return { ok: true, demande: { clientId: client.clientId, adresseRetour, codeChallenge: p.code_challenge, state, scope } };
}

/** L'adresse de retour, avec le code (ou l'erreur) et le `state` d'origine. */
export function adresseAvecParametres(adresseRetour: string, parametres: Record<string, string | null | undefined>): string {
  const u = new URL(adresseRetour);
  for (const [k, v] of Object.entries(parametres)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

/** Le nom à montrer sur la page de consentement, et le site où partira le code. */
export function presentationClient(client: ClientOAuth, adresseRetour: string): { nom: string; site: string } {
  return { nom: client.nom, site: new URL(adresseRetour).host };
}

/** Métadonnées de la ressource protégée (RFC 9728). */
export function metadonneesRessource(origine: string) {
  return {
    resource: `${origine}/api/mcp`,
    authorization_servers: [origine],
    scopes_supported: [SCOPE_PARTAGE],
    bearer_methods_supported: ["header"],
    resource_name: "Getgents — Pages (GetSite)",
  };
}

/** Métadonnées du serveur d'autorisation (RFC 8414). */
export function metadonneesServeur(origine: string) {
  return {
    issuer: origine,
    authorization_endpoint: `${origine}/oauth/autoriser`,
    token_endpoint: `${origine}/api/oauth/token`,
    registration_endpoint: `${origine}/api/oauth/register`,
    scopes_supported: [SCOPE_PARTAGE],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  };
}

/** L'en-tête qui dit au client où trouver comment s'autoriser (spécification MCP). */
export function enteteAuthentification(origine: string, erreur?: "invalid_token"): string {
  const meta = `resource_metadata="${origine}/.well-known/oauth-protected-resource"`;
  return erreur ? `Bearer error="${erreur}", ${meta}` : `Bearer ${meta}`;
}

/** Origine publique de la requête, derrière le proxy de l'hébergeur. */
export function origineDeRequete(url: string, enTetes: { get(n: string): string | null }): string {
  const u = new URL(url);
  const hote = enTetes.get("x-forwarded-host") ?? u.host;
  const proto = enTetes.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  return `${proto.split(",")[0].trim()}://${hote.split(",")[0].trim()}`;
}

/** PKCE S256 : base64url(SHA-256(verifier)) doit redonner le challenge. */
export function pkceValide(verifier: unknown, challenge: string): boolean {
  if (typeof verifier !== "string" || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}
