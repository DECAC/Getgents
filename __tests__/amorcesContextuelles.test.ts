import { amorcesAJour, consigneAmorces, lireAmorces, nomExpediteur, VALIDITE_AMORCES_MS } from "@/lib/amorcesContextuelles";

describe("amorces tirées de la boîte mail", () => {
  it("garde le nom de l'expéditeur, jamais son adresse", () => {
    expect(nomExpediteur("The Batch <thebatch@deeplearning.ai>")).toBe("The Batch");
    expect(nomExpediteur('"AI Secret" <newsletter@aisecret.us>')).toBe("AI Secret");
  });

  it("la consigne cite les expéditeurs et objets, sans adresse", () => {
    const c = consigneAmorces([{ from: "The Batch <thebatch@deeplearning.ai>", subject: "Muse, l'agent de Meta" }], "Assistant Email");
    expect(c).toContain("The Batch — Muse, l'agent de Meta");
    expect(c).not.toContain("@deeplearning.ai");
    expect(c).toMatch(/N'invente AUCUN expéditeur/);
  });

  it("lit un tableau JSON, même entouré de texte", () => {
    expect(lireAmorces('Voici : ["Que retient The Batch ?", "Faut-il répondre à Paul ?"]')).toEqual([
      "Que retient The Batch ?",
      "Faut-il répondre à Paul ?",
    ]);
  });

  it("écarte ce qui n'est pas une phrase courte, et toute adresse e-mail", () => {
    expect(lireAmorces('["ok ?", 3, "' + "x".repeat(200) + '", "Écris à paul@exemple.fr ?", "Que dit AI Secret ?"]')).toEqual([
      "Que dit AI Secret ?",
    ]);
  });

  it("une réponse illisible ne donne aucune amorce", () => {
    expect(lireAmorces("désolé")).toEqual([]);
    expect(lireAmorces("[pas du json")).toEqual([]);
  });

  it("au plus quatre", () => {
    expect(lireAmorces(JSON.stringify(["Question a ?", "Question b ?", "Question c ?", "Question d ?", "Question e ?"]))).toHaveLength(4);
  });

  it("se renouvellent au bout de six heures", () => {
    const maintenant = Date.parse("2026-09-25T12:00:00Z");
    const recentes = { at: "2026-09-25T09:00:00Z", items: ["x ?"] };
    expect(amorcesAJour(recentes, maintenant)).toBe(true);
    expect(amorcesAJour(recentes, maintenant + VALIDITE_AMORCES_MS)).toBe(false);
    expect(amorcesAJour(undefined, maintenant)).toBe(false);
  });
});

import { amorcesDuGent } from "@/lib/starterSignal";
import type { Espace } from "@/lib/types";

describe("amorces affichées", () => {
  const base = { starters: ["Question générique ?"], amorcesContextuelles: { at: "2026-09-25T09:00:00Z", items: ["Que dit The Batch ?"] } } as unknown as Espace;

  it("celles de la boîte mail d'abord", () => {
    expect(amorcesDuGent(base)).toEqual(["Que dit The Batch ?"]);
  });

  it("option coupée dans le studio : retour aux amorces du gent", () => {
    expect(amorcesDuGent({ ...base, amorcesAuto: false })).toEqual(["Question générique ?"]);
  });
});
