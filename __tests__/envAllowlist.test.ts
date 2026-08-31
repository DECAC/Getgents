import {
  CONNECTOR_ENV_ALLOWLIST,
  envRefusalMessage,
  isAllowedEnvName,
  readConnectorEnv,
} from "@/lib/server/envAllowlist";

describe("liste blanche des variables de connecteur", () => {
  it("autorise les clés d'API tierces prévues pour ça", () => {
    for (const name of CONNECTOR_ENV_ALLOWLIST) {
      expect(isAllowedEnvName(name)).toBe(true);
    }
  });

  it("refuse les secrets de la plateforme", () => {
    // Le scénario réel : un connecteur pointant sur le serveur de
    // l'attaquant, avec `value: "env:SUPABASE_SERVICE_ROLE_KEY"`.
    for (const name of [
      "SUPABASE_SERVICE_ROLE_KEY",
      "OPENROUTER_API_KEY",
      "GOOGLE_CLIENT_SECRET",
      "APP_ACCESS_SECRET",
      "CRON_SECRET",
      "WHATSAPP_TOKEN",
      "BREVO_API_KEY",
      "POWENS_CLIENT_SECRET",
      "NEXT_PUBLIC_SUPABASE_URL",
      "PATH",
      "AWS_SECRET_ACCESS_KEY",
    ]) {
      expect(isAllowedEnvName(name)).toBe(false);
    }
  });

  it("ne se laisse pas contourner par une variante du nom", () => {
    for (const name of [
      "serpapi_key",
      "SerpApi_Key",
      " SERPAPI_KEY",
      "SERPAPI_KEY ",
      "SERPAPI_KEY_2",
      "X_SERPAPI_KEY",
    ]) {
      expect(isAllowedEnvName(name)).toBe(false);
    }
  });

  it("ne lit rien hors de la liste, même si la variable existe", () => {
    const avant = process.env.OPENROUTER_API_KEY;
    try {
      process.env.OPENROUTER_API_KEY = "sk-secret-a-ne-pas-fuiter";
      expect(readConnectorEnv("OPENROUTER_API_KEY")).toBeNull();
    } finally {
      if (avant === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = avant;
    }
  });

  it("lit bien une variable autorisée", () => {
    const avant = process.env.SERPAPI_KEY;
    try {
      process.env.SERPAPI_KEY = "clé-serpapi";
      expect(readConnectorEnv("SERPAPI_KEY")).toBe("clé-serpapi");
    } finally {
      if (avant === undefined) delete process.env.SERPAPI_KEY;
      else process.env.SERPAPI_KEY = avant;
    }
  });

  it("explique le refus au lieu de renvoyer une valeur vide muette", () => {
    const msg = envRefusalMessage("SUPABASE_SERVICE_ROLE_KEY");
    expect(msg).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(msg).toContain("Clé d'API");
  });
});
