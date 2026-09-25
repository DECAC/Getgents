import { adressePriveePour, cheminEspace, cheminPrive } from "@/lib/diffusionPrivee";
import { espacePourVisiteur, gentPrive } from "@/lib/server/gentVersions";

describe("diffusion privée", () => {
  it("donne une adresse lisible, sans draft", () => {
    expect(adressePriveePour("Assistant Email", [])).toBe("assistant-email");
    expect(cheminPrive("assistant-email")).toBe("/espace/assistant-email");
  });

  it("l'adresse est unique parmi celles du compte", () => {
    expect(adressePriveePour("Assistant Email", ["assistant-email"])).toBe("assistant-email-2");
  });

  it("un nom vide donne quand même une adresse", () => {
    expect(adressePriveePour("", [])).toBe("mon-gent");
  });

  it("l'espace s'ouvre à l'adresse privée seulement si la diffusion est privée", () => {
    expect(cheminEspace("draft-1", { diffusionPrivee: true, adressePrivee: "assistant-email" })).toBe("/espace/assistant-email");
    expect(cheminEspace("draft-1", { diffusionPrivee: false, adressePrivee: "assistant-email" })).toBe("/espace/draft-1");
  });

  it("le serveur ferme l'accès visiteur si l'une des deux versions est privée", () => {
    const ouvert = { espace: { name: "G" }, diffused: { name: "G" } };
    expect(gentPrive(ouvert)).toBe(false);
    expect(espacePourVisiteur(ouvert)).not.toBeNull();
    // Case cochée : la version de travail le dit tout de suite, la diffusée pas encore.
    const coche = { espace: { name: "G", diffusionPrivee: true }, diffused: { name: "G" } };
    expect(gentPrive(coche)).toBe(true);
    expect(espacePourVisiteur(coche)).toBeNull();
    expect(gentPrive({ espace: { name: "G" }, diffused: { name: "G", diffusionPrivee: true } })).toBe(true);
  });
});

describe("la case s'applique tout de suite, dans les deux sens", () => {
  it("décocher rouvre même si la version diffusée était privée", () => {
    expect(gentPrive({ espace: { diffusionPrivee: false }, diffused: { diffusionPrivee: true } })).toBe(false);
  });
  it("cocher ferme même si la version diffusée ne l'était pas", () => {
    expect(gentPrive({ espace: { diffusionPrivee: true }, diffused: { diffusionPrivee: false } })).toBe(true);
  });
  it("sans réglage dans la version de travail, la version diffusée décide", () => {
    expect(gentPrive({ espace: {}, diffused: { diffusionPrivee: true } })).toBe(true);
  });
});
