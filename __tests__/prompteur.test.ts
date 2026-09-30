import {
  alignerPosition,
  choisirFormatVideo,
  consignePrompteur,
  decouperScript,
  dureeEstimee,
  extraireScript,
  formatDuree,
  motsEntendus,
  motsCibles,
  motsProches,
  nomFichierCapsule,
  normaliserMot,
  rectangleCadrage,
  texteDepuisBlocs,
  texteParle,
} from "@/lib/prompteur";

const SCRIPT = [
  "L'IA ne va pas vous remplacer.",
  "",
  "Mais quelqu'un qui sait s'en servir, oui.",
  "",
  "Cette semaine, j'ai confié trois heures de travail à un assistant.",
].join("\n");

describe("texte à dire", () => {
  it("le markdown devient du texte parlé, paragraphes gardés", () => {
    expect(texteParle("## Titre\n\n**L'IA** ne va *pas* vous remplacer.\n- Mais [vous](https://x) oui.")).toBe(
      "Titre\n\nL'IA ne va pas vous remplacer. Mais vous oui."
    );
  });

  it("extrait la DERNIÈRE version encadrée et retire les marqueurs du texte affiché", () => {
    const raw =
      "Première piste :\n<!--SCRIPT-->\nVersion un.\n<!--/SCRIPT-->\n\nPlus percutant :\n<!--SCRIPT-->\n" +
      SCRIPT +
      "\n<!--/SCRIPT-->\nDurée : 20 s.";
    const { text, script } = extraireScript(raw);
    expect(script).toBe(texteParle(SCRIPT));
    expect(text).not.toContain("<!--");
    expect(text).toContain("Version un.");
    expect(text).toContain("Durée : 20 s.");
  });

  it("un script coupé (marqueur sans fin) ne part pas au prompteur", () => {
    expect(extraireScript("<!--SCRIPT-->\nL'IA ne va pas").script).toBeUndefined();
    expect(extraireScript("Sans script.")).toEqual({ text: "Sans script." });
  });

  it("le texte d'un artefact gardé : ses blocs de texte, sans titres", () => {
    expect(
      texteDepuisBlocs([
        { type: "heading", text: "Capsule" },
        { type: "text", body: "**Accroche.**" },
        { type: "table", columns: [], rows: [] },
        { type: "text", body: "Chute ?" },
      ])
    ).toBe("Accroche.\n\nChute ?");
  });

  it("durées : 150 mots par minute", () => {
    expect(motsCibles(60)).toBe(150);
    expect(dureeEstimee("un ".repeat(150))).toBe(60);
    expect(formatDuree(65)).toBe("1:05");
  });

  it("la consigne fixe la forme et les marqueurs, jamais la fréquence des artefacts", () => {
    const c = consignePrompteur(45);
    expect(c).toContain("<!--SCRIPT-->");
    expect(c).toContain("113 mots");
    expect(c).not.toMatch(/artefact/i);
  });
});

describe("suivi de la voix", () => {
  const mots = decouperScript(SCRIPT);
  const norms = mots.map((m) => m.norm);

  it("découpe en mots normalisés, paragraphe par paragraphe", () => {
    expect(mots[0]).toEqual({ mot: "L'IA", norm: "lia", paragraphe: 0 });
    expect(mots[mots.length - 1].paragraphe).toBe(2);
    expect(normaliserMot("Réussite,")).toBe("reussite");
  });

  it("avance au fil des mots entendus", () => {
    let pos = 0;
    pos = alignerPosition(norms, motsEntendus("l'IA ne va pas"), pos);
    expect(pos).toBe(4);
    pos = alignerPosition(norms, motsEntendus("l'IA ne va pas vous remplacer mais"), pos);
    expect(pos).toBe(7);
  });

  it("tolère les erreurs de reconnaissance d'une lettre ou d'un accord", () => {
    expect(motsProches("remplace", "remplacer")).toBe(true);
    expect(motsProches("semaines", "semaine")).toBe(true);
    expect(motsProches("de", "le")).toBe(false);
    const pos = alignerPosition(norms, motsEntendus("cette semaines j'ai confier trois"), 12);
    expect(norms[pos - 1]).toBe("trois");
  });

  it("un petit mot isolé ne fait jamais sauter le texte", () => {
    expect(alignerPosition(norms, ["a"], 0)).toBe(0);
    expect(alignerPosition(norms, ["xyz", "abc"], 5)).toBe(5);
  });

  it("ne recule pas quand on répète une phrase déjà dite", () => {
    expect(alignerPosition(norms, motsEntendus("ne va pas"), 10)).toBe(10);
  });
});

describe("enregistrement", () => {
  it("recadre au centre, sans agrandir, en dimensions paires", () => {
    expect(rectangleCadrage(1280, 720, "carre")).toEqual({ sx: 280, sy: 0, sw: 720, sh: 720 });
    expect(rectangleCadrage(1280, 720, "vertical")).toEqual({ sx: 438, sy: 0, sw: 404, sh: 720 });
    expect(rectangleCadrage(720, 1280, "vertical")).toEqual({ sx: 0, sy: 0, sw: 720, sh: 1280 });
    expect(rectangleCadrage(1280, 720, "paysage")).toEqual({ sx: 0, sy: 0, sw: 1280, sh: 720 });
  });

  it("préfère le MP4, retombe sur le WebM", () => {
    expect(choisirFormatVideo((t) => t.startsWith("video/mp4"))?.extension).toBe("mp4");
    expect(choisirFormatVideo((t) => t === "video/webm;codecs=vp8,opus")).toEqual({
      mimeType: "video/webm;codecs=vp8,opus",
      extension: "webm",
    });
    expect(choisirFormatVideo(() => false)).toBeNull();
  });

  it("nomme le fichier par sa date", () => {
    expect(nomFichierCapsule(new Date(2026, 8, 30, 9, 5), "mp4")).toBe("capsule-2026-09-30-0905.mp4");
  });
});

import { brouillonNeuf, ONGLET_DU_FORMAT } from "@/lib/builderDraftStorage";
import { draftToEspace } from "@/lib/publishedGents";
import { espaceForPublicLink } from "@/lib/espaceApiPayload";
import { buildGentSystemPrompt } from "@/lib/gentRuntimePrompt";
import { titreScript, MARQUEUR_SCRIPT } from "@/lib/prompteur";

describe("le type de gent « Le Prompteur »", () => {
  const draft = brouillonNeuf("draft-prompteur", "prompteur");
  const espace = draftToEspace(draft);

  it("se crée nommé, activé, avec des instructions de départ, et s'ouvre sur son réglage", () => {
    expect(draft.name).toBe("Le Prompteur");
    expect(draft.icon).toBe("🎬");
    expect(draft.prompteur?.enabled).toBe(true);
    expect(draft.systemPrompt).toMatch(/capsule vidéo/);
    expect(ONGLET_DU_FORMAT.prompteur).toBe("prompteur");
    // Une phrase du créateur ne remplace pas l'emblème.
    expect(brouillonNeuf("d2", "prompteur", "Mes capsules sur le management").icon).toBe("🎬");
  });

  it("le réglage suit le gent jusqu'au lien de partage : le visiteur filme SA capsule", () => {
    expect(espace.prompteur).toEqual({ enabled: true, dureeCible: undefined });
    expect(espaceForPublicLink(espace).prompteur?.enabled).toBe(true);
  });

  it("la consigne est jointe au gent, pas au super gent", () => {
    expect(buildGentSystemPrompt(espace, { variant: "espace" })).toContain(MARQUEUR_SCRIPT);
    expect(buildGentSystemPrompt(espace, { variant: "sharedLink" })).toContain(MARQUEUR_SCRIPT);
    expect(buildGentSystemPrompt(espace, { variant: "superGent" })).not.toContain(MARQUEUR_SCRIPT);
    expect(buildGentSystemPrompt(draftToEspace(brouillonNeuf("d3", "conversationnel")), { variant: "espace" })).not.toContain(
      MARQUEUR_SCRIPT
    );
  });

  it("le script gardé prend pour titre sa première phrase", () => {
    expect(titreScript("L'IA ne va pas vous remplacer. Mais quelqu'un, oui.")).toBe("L'IA ne va pas vous remplacer");
    expect(titreScript("")).toBe("Capsule vidéo");
    expect(titreScript("mot ".repeat(40)).length).toBeLessThanOrEqual(60);
  });
});

import { memoryNote, MEMOIRE_MAX } from "@/lib/sessionContext";

describe("ce que le gent sait de moi", () => {
  const avecMemoire = { ...draftToEspace(brouillonNeuf("d4", "prompteur")), memory: "Directeur des opérations dans une ESN." };

  it("part dans le prompt de l'espace personnel, jamais sur un lien ni au super gent", () => {
    expect(buildGentSystemPrompt(avecMemoire, { variant: "espace" })).toContain("Directeur des opérations dans une ESN.");
    expect(buildGentSystemPrompt(avecMemoire, { variant: "sharedLink" })).not.toContain("Directeur des opérations");
    expect(buildGentSystemPrompt(avecMemoire, { variant: "superGent" })).not.toContain("Directeur des opérations");
  });

  it("dit au gent de ne pas redemander ce qu'il sait, et reste bornée", () => {
    expect(memoryNote("x")).toMatch(/ne lui redemande pas/);
    expect(memoryNote("a".repeat(MEMOIRE_MAX + 500)).length).toBeLessThan(MEMOIRE_MAX + 300);
  });
});
