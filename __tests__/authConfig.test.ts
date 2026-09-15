import { missingAuthEnvVars, readAuthConfig, unconfiguredPolicy } from "@/lib/authConfig";

describe("configuration de l'authentification", () => {
  const avant = { ...process.env };
  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = avant.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = avant.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("exige les deux variables", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(readAuthConfig()).toBeNull();
    expect(missingAuthEnvVars()).toEqual(["NEXT_PUBLIC_SUPABASE_ANON_KEY"]);

    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    expect(readAuthConfig()).toEqual({ url: "https://x.supabase.co", anonKey: "anon" });
    expect(missingAuthEnvVars()).toEqual([]);
  });

  it("ferme en production, laisse passer en développement", () => {
    // Une plateforme multi-comptes sans son service d'authentification n'est
    // pas une maquette : c'est un site ouvert qui se croit fermé.
    expect(unconfiguredPolicy("production")).toBe("bloquer");
    expect(unconfiguredPolicy("development")).toBe("laisser-passer");
    expect(unconfiguredPolicy(undefined)).toBe("laisser-passer");
  });
});
