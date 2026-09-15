import { extractArtefactSignal } from "@/lib/artefactSignal";
import {
  parseProfileSummary,
  materializeProfileMedia,
  PROFILE_SUMMARY_PROMPT_INSTRUCTION,
} from "@/lib/profileSummaryArtefact";

describe("parseProfileSummary", () => {
  it("exige un nom", () => {
    expect(parseProfileSummary({ headline: "CEO" })).toBeNull();
  });

  it("conserve les champs utiles et ignore les URL non https", () => {
    const p = parseProfileSummary({
      name: "Ada Lovelace",
      headline: "Mathématicienne",
      skills: ["Analyse", "Vision"],
      links: [
        { label: "Bio", url: "https://exemple.fr/ada" },
        { label: "Bad", url: "http://insecure.fr" },
      ],
      media: [
        { role: "logo", kind: "web", url: "https://exemple.fr/logo.png" },
        { role: "portrait", kind: "generate", prompt: "stylized portrait of Ada" },
        { role: "illustration", kind: "web", url: "http://bad.fr/x.jpg" },
      ],
    });
    expect(p?.name).toBe("Ada Lovelace");
    expect(p?.links).toHaveLength(1);
    expect(p?.media).toHaveLength(2);
    expect(p?.media?.[0].kind).toBe("web");
    expect(p?.media?.[1].kind).toBe("generate");
  });
});

describe("materializeProfileMedia", () => {
  it("rend les photos web immédiatement disponibles", () => {
    const media = materializeProfileMedia([
      { role: "logo", kind: "web", url: "https://exemple.fr/a.png" },
      { role: "portrait", kind: "generate", prompt: "portrait" },
    ]);
    expect(media[0].status).toBe("ready");
    expect(media[0].imageUrl).toBe("https://exemple.fr/a.png");
    expect(media[1].status).toBe("pending");
  });
});

describe("extractArtefactSignal profile-summary", () => {
  it("extrait un résumé de profil", () => {
    const raw =
      'Voici le parcours.\n<!--ARTEFACT: {"kind":"profile-summary","title":"Ada — résumé","profileSummary":{"name":"Ada Lovelace","headline":"Visionnaire","skills":["Maths"]}}-->';
    const { text, artefact } = extractArtefactSignal(raw);
    expect(text).toBe("Voici le parcours.");
    expect(artefact?.kind).toBe("profile-summary");
    expect(artefact?.profileSummary?.name).toBe("Ada Lovelace");
  });

  it("ignore un profile-summary sans nom", () => {
    const { artefact } = extractArtefactSignal(
      '<!--ARTEFACT: {"kind":"profile-summary","title":"X","profileSummary":{"headline":"seul"}}-->'
    );
    expect(artefact).toBeNull();
  });
});

describe("consigne", () => {
  it("oriente vers un CV synthétique illustré", () => {
    expect(PROFILE_SUMMARY_PROMPT_INSTRUCTION).toMatch(/profile-summary/);
    expect(PROFILE_SUMMARY_PROMPT_INSTRUCTION).toMatch(/media/);
  });
});
