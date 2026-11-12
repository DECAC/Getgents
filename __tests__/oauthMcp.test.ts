import { createHash } from "crypto";
import {
  adresseAvecParametres,
  adresseRetourValide,
  enteteAuthentification,
  metadonneesServeur,
  origineDeRequete,
  pkceValide,
  validerDemande,
  validerInscription,
  type ClientOAuth,
} from "@/lib/oauthMcp";

const CLIENT: ClientOAuth = { clientId: "mcp_x", nom: "Claude", adressesRetour: ["https://claude.ai/api/mcp/auth_callback"] };
const VERIFIER = "v".repeat(50);
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");
const demande = (p: Record<string, string> = {}) => ({
  client_id: "mcp_x",
  redirect_uri: CLIENT.adressesRetour[0],
  response_type: "code",
  code_challenge: CHALLENGE,
  code_challenge_method: "S256",
  state: "etat",
  ...p,
});

describe("adresses de retour", () => {
  it("HTTPS, ou http sur la machine même — jamais un schéma exotique ni un fragment", () => {
    expect(adresseRetourValide("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(adresseRetourValide("http://localhost:6274/oauth/callback")).toBe(true);
    expect(adresseRetourValide("http://127.0.0.1:9000/cb")).toBe(true);
    expect(adresseRetourValide("http://claude.ai/cb")).toBe(false);
    expect(adresseRetourValide("javascript:alert(1)")).toBe(false);
    expect(adresseRetourValide("https://claude.ai/cb#x")).toBe(false);
    expect(adresseRetourValide(42)).toBe(false);
  });
});

describe("inscription dynamique", () => {
  it("accepte un client public, refuse un secret ou une adresse douteuse", () => {
    expect(validerInscription({ client_name: "Claude", redirect_uris: CLIENT.adressesRetour, token_endpoint_auth_method: "none" })).toEqual({
      ok: true,
      nom: "Claude",
      adressesRetour: CLIENT.adressesRetour,
    });
    expect(validerInscription({ redirect_uris: [] }).ok).toBe(false);
    expect(validerInscription({ redirect_uris: ["http://evil.com/cb"] }).ok).toBe(false);
    expect(validerInscription({ redirect_uris: CLIENT.adressesRetour, token_endpoint_auth_method: "client_secret_basic" }).ok).toBe(false);
    expect(validerInscription({ redirect_uris: CLIENT.adressesRetour })).toMatchObject({ ok: true, nom: "Client sans nom" });
  });
});

describe("demande d'autorisation", () => {
  it("valide une demande complète", () => {
    expect(validerDemande(demande(), CLIENT)).toEqual({
      ok: true,
      demande: { clientId: "mcp_x", adresseRetour: CLIENT.adressesRetour[0], codeChallenge: CHALLENGE, state: "etat", scope: "partage" },
    });
  });

  it("ne renvoie RIEN vers une adresse non déclarée : l'erreur s'affiche", () => {
    expect(validerDemande(demande({ redirect_uri: "https://evil.com/cb" }), CLIENT)).toEqual({ ok: false, afficher: expect.any(String) });
    expect(validerDemande(demande(), null)).toEqual({ ok: false, afficher: expect.any(String) });
  });

  it("PKCE S256 obligatoire ; scope inconnu refusé — renvoyés au client avec le state", () => {
    const sansPkce = validerDemande(demande({ code_challenge_method: "plain" }), CLIENT);
    expect(sansPkce).toMatchObject({ ok: false, renvoyer: { erreur: "invalid_request", state: "etat" } });
    expect(validerDemande(demande({ scope: "admin" }), CLIENT)).toMatchObject({ ok: false, renvoyer: { erreur: "invalid_scope" } });
    expect(validerDemande(demande({ response_type: "token" }), CLIENT)).toMatchObject({ ok: false, renvoyer: { erreur: "unsupported_response_type" } });
  });

  it("retient l'unique adresse déclarée quand la demande n'en donne pas", () => {
    const { redirect_uri: _omis, ...sans } = demande();
    expect(validerDemande(sans, CLIENT)).toMatchObject({ ok: true });
  });
});

describe("PKCE", () => {
  it("vérifie le verifier contre le challenge", () => {
    expect(pkceValide(VERIFIER, CHALLENGE)).toBe(true);
    expect(pkceValide("w".repeat(50), CHALLENGE)).toBe(false);
    expect(pkceValide("court", CHALLENGE)).toBe(false);
    expect(pkceValide(undefined, CHALLENGE)).toBe(false);
  });
});

describe("métadonnées et en-têtes", () => {
  it("annonce les points du parcours sur l'origine publique", () => {
    const m = metadonneesServeur("https://getgents.ai");
    expect(m.authorization_endpoint).toBe("https://getgents.ai/oauth/autoriser");
    expect(m.code_challenge_methods_supported).toEqual(["S256"]);
    expect(enteteAuthentification("https://getgents.ai")).toBe(
      'Bearer resource_metadata="https://getgents.ai/.well-known/oauth-protected-resource"'
    );
    expect(enteteAuthentification("https://getgents.ai", "invalid_token")).toMatch(/^Bearer error="invalid_token", /);
  });

  it("lit l'origine derrière le proxy de l'hébergeur", () => {
    const h = new Map([["x-forwarded-host", "getgents.ai"], ["x-forwarded-proto", "https"]]);
    expect(origineDeRequete("http://localhost:3000/api/mcp", { get: (n) => h.get(n) ?? null })).toBe("https://getgents.ai");
    expect(origineDeRequete("http://localhost:3000/api/mcp", { get: () => null })).toBe("http://localhost:3000");
  });

  it("ajoute code et state à l'adresse de retour sans écraser ses paramètres", () => {
    expect(adresseAvecParametres("https://a.b/cb?x=1", { code: "C", state: null })).toBe("https://a.b/cb?x=1&code=C");
  });
});
