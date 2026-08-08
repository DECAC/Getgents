import { ShareLinksError, describeShareLinksFailure } from "@/lib/server/shareLinks";
import { withoutSessionContext } from "@/lib/espaceApiPayload";
import type { Espace, UserFile } from "@/lib/types";

describe("diagnostic des échecs de liens de partage", () => {
  // Le détail des variables citées dépend de l'environnement : il est vérifié
  // plus bas, dans le bloc qui contrôle process.env. Ici on ne teste que le
  // contrat stable — statut 503 et diagnostic actionnable.
  it("nomme Supabase non configuré", () => {
    const r = describeShareLinksFailure(new Error("supabase_not_configured"));
    expect(r.status).toBe(503);
    expect(r.error).toBe("supabase_not_configured");
    expect(r.hint).toContain("REDÉPLOYEZ");
  });

  it("détecte une table absente via le code Postgres 42P01", () => {
    const r = describeShareLinksFailure(new ShareLinksError('relation "public.share_links" does not exist', "42P01"));
    expect(r.status).toBe(503);
    expect(r.hint).toContain("002_share_links.sql");
  });

  it("détecte une table absente via le code PostgREST PGRST205", () => {
    const r = describeShareLinksFailure(
      new ShareLinksError("Could not find the table 'public.share_links' in the schema cache", "PGRST205")
    );
    expect(r.hint).toContain("002_share_links.sql");
  });

  it("détecte une fonction RPC absente (PGRST202)", () => {
    const r = describeShareLinksFailure(new ShareLinksError("Could not find the function", "PGRST202"));
    expect(r.hint).toContain("002_share_links.sql");
  });

  it("détecte le message même sans code, par correspondance de texte", () => {
    const r = describeShareLinksFailure(new Error('relation "public.share_links" does not exist'));
    expect(r.hint).toContain("002_share_links.sql");
  });

  it("reste générique pour une erreur sans rapport", () => {
    const r = describeShareLinksFailure(new Error("connection timeout"));
    expect(r.status).toBe(500);
    expect(r.hint).toBeUndefined();
    expect(r.error).toBe("connection timeout");
  });
});

describe("neutralisation du contexte de session pour un visiteur externe", () => {
  const espace = {
    memory: "Résumé de l'utilisation par Charles",
    files: [{ id: "f1", name: "cv.pdf", size: "1 Ko", date: "hier", text: "Contenu du CV" } as UserFile],
    name: "Next Move",
  } as unknown as Espace;

  it("vide la mémoire et les fichiers", () => {
    const out = withoutSessionContext(espace);
    expect(out.memory).toBe("");
    expect(out.files).toEqual([]);
  });

  it("ne modifie pas l'espace d'origine (persistance intacte)", () => {
    withoutSessionContext(espace);
    expect(espace.memory).toBe("Résumé de l'utilisation par Charles");
    expect(espace.files).toHaveLength(1);
  });

  it("conserve le reste de l'espace", () => {
    expect(withoutSessionContext(espace).name).toBe("Next Move");
  });
});

describe("nomme précisément la ou les variables Supabase manquantes", () => {
  const ORIGINAL = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it("cite les deux variables si aucune n'est définie", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const r = describeShareLinksFailure(new Error("supabase_not_configured"));
    expect(r.hint).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(r.hint).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(r.hint).toContain("REDÉPLOYEZ");
  });

  it("ne cite que la variable réellement absente", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemple.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const r = describeShareLinksFailure(new Error("supabase_not_configured"));
    expect(r.hint).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(r.hint).not.toContain("NEXT_PUBLIC_SUPABASE_URL manquante");
  });
});
