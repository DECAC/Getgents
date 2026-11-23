/**
 * Prolongation des liens (lot « Partager »), en mémoire locale : pas de
 * Supabase. Un compte « pages » est soumis au plafond de 200 liens actifs.
 */
jest.mock("@/lib/server/supabase", () => ({ getSupabaseAdmin: () => null }));

import { DUREE_LIEN_MS, JOUR_MS } from "@/lib/dureeLien";

process.env.COMPTES_COMPLETS = "un-autre-compte";

// Importés APRÈS la variable : l'offre du compte se lit à l'exécution.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { enregistrerArtefact, prolongerPartages, revoquerPartage, listerPartages } = require("@/lib/server/artefactsPartages") as typeof import("@/lib/server/artefactsPartages");

const demande = (destinataire: string) => ({ titre: "Week-end", contenu: "<p>Programme du week-end</p>", format: "html" as const, destinataire });
const proprio = (userId: string) => ({ userId, clientId: "" });
const memoire = () => (globalThis as unknown as { __artefactsPartages: Map<string, { expiresAt: string | null }> }).__artefactsPartages;
const expirer = (jeton: string, jours: number) => {
  memoire().get(jeton)!.expiresAt = new Date(Date.now() + jours * JOUR_MS).toISOString();
};

describe("prolonger des liens", () => {
  it("refait durer 30 jours À PARTIR D'AUJOURD'HUI, pas depuis l'ancienne échéance", async () => {
    const a = (await enregistrerArtefact(demande("Marie"), null, null, proprio("u1")))!;
    expirer(a.jeton, 2);
    const avant = Date.now();
    const r = await prolongerPartages("u1", [a.jeton]);
    expect(r.prolonges).toHaveLength(1);
    const e = Date.parse(r.prolonges[0].expiresAt);
    expect(e - avant).toBeGreaterThanOrEqual(DUREE_LIEN_MS - 1000);
    expect(e - avant).toBeLessThanOrEqual(DUREE_LIEN_MS + 5000);
    expect(memoire().get(a.jeton)!.expiresAt).toBe(r.prolonges[0].expiresAt);
  });

  it("garde de propriété : le jeton d'un autre compte ne se prolonge pas", async () => {
    const a = (await enregistrerArtefact(demande("Paul"), null, null, proprio("u2")))!;
    expirer(a.jeton, 1);
    const avant = memoire().get(a.jeton)!.expiresAt;
    const r = await prolongerPartages("intrus", [a.jeton]);
    expect(r.prolonges).toHaveLength(0);
    expect(r.ignores).toEqual([{ jeton: a.jeton, cause: "introuvable" }]);
    expect(memoire().get(a.jeton)!.expiresAt).toBe(avant);
  });

  it("un lien révoqué ne revient jamais ; un jeton mal formé est ignoré", async () => {
    const a = (await enregistrerArtefact(demande("Luc"), null, null, proprio("u3")))!;
    expect(await revoquerPartage("u3", a.jeton)).toBe(true);
    const r = await prolongerPartages("u3", [a.jeton, "court"]);
    expect(r.prolonges).toHaveLength(0);
    expect(r.ignores).toEqual([{ jeton: a.jeton, cause: "revoque" }]);
  });

  it("un lien EXPIRÉ redevient actif ; un doublon n'est prolongé qu'une fois", async () => {
    const a = (await enregistrerArtefact(demande("Zoé"), null, null, proprio("u4")))!;
    expirer(a.jeton, -5);
    const r = await prolongerPartages("u4", [a.jeton, a.jeton]);
    expect(r.prolonges).toHaveLength(1);
    const l = (await listerPartages("u4")).find((x) => x.jeton === a.jeton)!;
    expect(Date.parse(l.expiresAt!)).toBeGreaterThan(Date.now());
  });

  it("réactiver un lien expiré compte dans le plafond de 200 liens actifs ; prolonger un lien actif, non", async () => {
    const jetons: string[] = [];
    for (let i = 0; i < 200; i++) jetons.push((await enregistrerArtefact(demande(`dest-${i}`), null, null, proprio("u5")))!.jeton);
    // Plafond atteint : un 201e lien est refusé.
    await expect(enregistrerArtefact(demande("de-trop"), null, null, proprio("u5"))).rejects.toThrow(/200 liens actifs/);
    // Un lien expire : on peut en créer un autre, le plafond est de nouveau plein.
    expirer(jetons[0], -1);
    const remplacant = (await enregistrerArtefact(demande("remplaçant"), null, null, proprio("u5")))!;
    // Prolonger un lien ACTIF reste permis, plein ou non.
    expect((await prolongerPartages("u5", [jetons[1]])).prolonges).toHaveLength(1);
    // Réactiver l'expiré dépasserait le plafond : refusé, et dit pourquoi.
    const refus = await prolongerPartages("u5", [jetons[0]]);
    expect(refus.prolonges).toHaveLength(0);
    expect(refus.ignores).toEqual([{ jeton: jetons[0], cause: "plafond" }]);
    // Une place se libère : la réactivation passe.
    await revoquerPartage("u5", remplacant.jeton);
    expect((await prolongerPartages("u5", [jetons[0]])).prolonges).toHaveLength(1);
  });
});
