import { extractJsonFromHtmlMarker, repairTruncatedJson } from "@/lib/server/markerJson";
import { extractPinnedDashboard, diagnosePinnedFailure } from "@/lib/server/pinnedArtefact";

describe("réparation d'un JSON tronqué", () => {
  it("referme un objet coupé après une valeur complète", () => {
    const repaired = repairTruncatedJson('{"a":1,"b":2');
    expect(repaired && JSON.parse(repaired)).toEqual({ a: 1, b: 2 });
  });

  it("abandonne le dernier élément incomplet d'un tableau", () => {
    const repaired = repairTruncatedJson('{"blocks":[{"type":"text","body":"ok"},{"type":"tab');
    expect(repaired && JSON.parse(repaired)).toEqual({ blocks: [{ type: "text", body: "ok" }] });
  });

  it("gère une chaîne laissée ouverte", () => {
    const repaired = repairTruncatedJson('{"blocks":[{"type":"text","body":"ok"},{"type":"text","body":"coupé au mil');
    expect(repaired && JSON.parse(repaired)).toEqual({ blocks: [{ type: "text", body: "ok" }] });
  });

  it("laisse intact un JSON déjà complet", () => {
    const repaired = repairTruncatedJson('{"a":[1,2]}');
    expect(repaired && JSON.parse(repaired)).toEqual({ a: [1, 2] });
  });

  it("renvoie null quand rien n'est récupérable", () => {
    expect(repairTruncatedJson('{"bl')).toBeNull();
  });
});

describe("récupération d'un dashboard tronqué de bout en bout", () => {
  // Réponse coupée par la limite de tokens, en plein milieu du 3e bloc.
  const tronquee =
    '<!--PINNED: {"dashboard":{"subtitle":"Trajectoire","blocks":[' +
    '{"type":"stats","items":[{"label":"Postes analysés","value":"5"}]},' +
    '{"type":"text","body":"Synthèse du parcours."},' +
    '{"type":"table","title":"Rémun';

  it("récupère les blocs complets au lieu de tout perdre", () => {
    const spec = extractPinnedDashboard(tronquee);
    expect(spec).not.toBeNull();
    expect(spec!.blocks).toHaveLength(2);
    expect(spec!.subtitle).toBe("Trajectoire");
  });
});

describe("diagnostic d'échec", () => {
  it("distingue l'absence totale de bloc", () => {
    expect(diagnosePinnedFailure("Voici votre tableau de bord en texte libre.")).toContain(
      "aucun bloc PINNED/ARTEFACT détecté"
    );
  });

  it("nomme les types de blocs quand le schéma les refuse", () => {
    const raw =
      '<!--PINNED: {"dashboard":{"blocks":[{"type":"gauge","valeur":42},{"type":"chart"}]}}-->';
    const note = diagnosePinnedFailure(raw);
    expect(note).toContain("2 bloc(s) reçu(s)");
    expect(note).toContain("gauge");
    expect(note).toContain("chart");
  });

  it("signale un tableau de blocs vide", () => {
    expect(diagnosePinnedFailure('<!--PINNED: {"dashboard":{"blocks":[]}}-->')).toContain("vide");
  });

  it("extrait le fragment même sans accolade fermante", () => {
    expect(extractJsonFromHtmlMarker('<!--PINNED: {"dashboard":{"blocks":[{"type":"text","body":"a"}', "PINNED")).not.toBeNull();
  });
});

describe("conflit entre la règle anti-HTML du gent et l'enveloppe PINNED", () => {
  const prose = "Voici votre tableau de bord :\n\n## Top 5 des postes\n1. Directeur Produit — 42 %";

  it("nomme le conflit quand le prompt du gent interdit les balises HTML", () => {
    const promptDuGent =
      "7. FORMAT STRICT : n'insère JAMAIS de balises HTML ni de balises de citation (<cite index=\"...\">) dans tes réponses.";
    const note = diagnosePinnedFailure(prose, promptDuGent);
    expect(note).toContain("interdit");
    expect(note).toContain("<!--PINNED-->");
    expect(note).toContain("Reformulez");
  });

  it("reste générique quand le prompt ne contient pas cette règle", () => {
    const note = diagnosePinnedFailure(prose, "Tu es un assistant carrière. Sois concis.");
    expect(note).toContain("texte libre");
    expect(note).not.toContain("Reformulez");
  });

  it("détecte aussi les formulations voisines", () => {
    expect(diagnosePinnedFailure(prose, "N'utilise aucune balise HTML.")).toContain("Reformulez");
    expect(diagnosePinnedFailure(prose, "Pas de balises HTML dans le rendu.")).toContain("Reformulez");
  });
});
