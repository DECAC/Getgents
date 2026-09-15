import {
  MESSAGE_SIGNALEMENT,
  PRECISION_MAX,
  corpsEmailSignalement,
  libelleMotif,
  sujetEmailSignalement,
  validerSignalement,
  type Signalement,
} from "@/lib/signalement";

const vide: Signalement = { appreciation: null, motif: null, precision: "" };

describe("validerSignalement", () => {
  it("refuse un signalement entièrement vide", () => {
    // Il n'apprend rien et encombrerait la boîte du créateur, qui cesserait
    // alors de les lire — le pire résultat possible pour cette fonction.
    expect(validerSignalement(vide)).toBe("vide");
  });

  it("accepte une seule des deux réponses", () => {
    // Exiger les deux ferait perdre les retours de qui ne veut répondre
    // qu'à l'une.
    expect(validerSignalement({ ...vide, appreciation: "oui" })).toBeNull();
    expect(validerSignalement({ ...vide, motif: "resultat" })).toBeNull();
    expect(validerSignalement({ ...vide, precision: "ça boucle" })).toBeNull();
  });

  it("exige une description pour une anomalie", () => {
    // « Il y a un bug » sans lequel est inexploitable.
    expect(validerSignalement({ ...vide, motif: "anomalie" })).toBe("precision-manquante");
    expect(validerSignalement({ ...vide, motif: "anomalie", precision: "  " })).toBe(
      "precision-manquante"
    );
    expect(
      validerSignalement({ ...vide, motif: "anomalie", precision: "le bouton ne répond pas" })
    ).toBeNull();
  });

  it("n'exige pas de description pour les autres motifs", () => {
    expect(validerSignalement({ ...vide, motif: "conversation" })).toBeNull();
  });

  it("borne la description", () => {
    expect(validerSignalement({ ...vide, precision: "a".repeat(PRECISION_MAX + 1) })).toBe(
      "precision-trop-longue"
    );
  });

  it("chaque erreur a un message qui dit quoi faire", () => {
    for (const [cle, message] of Object.entries(MESSAGE_SIGNALEMENT)) {
      expect(message.length).toBeGreaterThan(20);
      expect(message).not.toContain(cle);
    }
  });
});

describe("corpsEmailSignalement", () => {
  it("échappe le texte libre", () => {
    // Il vient d'un inconnu et atterrit dans un e-mail HTML : sans
    // échappement, un signalement devient une injection.
    const html = corpsEmailSignalement({
      nomGent: "Coach",
      signalement: { ...vide, precision: "<script>alert(1)</script>" },
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("échappe aussi le nom du gent", () => {
    // Il est choisi par le créateur, mais un créateur n'est pas plus digne de
    // confiance qu'un visiteur pour ce qui part en HTML.
    const html = corpsEmailSignalement({
      nomGent: '<img src=x onerror="alert(1)">',
      signalement: { ...vide, appreciation: "non" },
    });
    expect(html).not.toContain("<img");
  });

  it("dit sans réponse plutôt que d'inventer", () => {
    const html = corpsEmailSignalement({ nomGent: "Coach", signalement: { ...vide, motif: "resultat" } });
    expect(html).toContain("sans réponse");
    expect(html).toContain("Résultat non pertinent");
  });

  it("annonce que l'auteur n'est pas joignable", () => {
    // Sans cette mention, le créateur cherche un bouton « répondre » qui
    // n'existe pas — le signalement est anonyme par construction.
    const html = corpsEmailSignalement({ nomGent: "Coach", signalement: { ...vide, appreciation: "oui" } });
    expect(html).toMatch(/n'est pas identifié/i);
  });
});

describe("sujetEmailSignalement", () => {
  it("porte le nom du gent", () => {
    // Une boîte qui reçoit dix fois « Signalement » ne permet pas de trier.
    expect(sujetEmailSignalement("Coach voyage")).toContain("Coach voyage");
  });
});

describe("libelleMotif", () => {
  it("ne laisse jamais un identifiant technique fuiter dans l'e-mail", () => {
    expect(libelleMotif("conversation")).toBe("Impossibilité d'utiliser le module conversationnel");
    expect(libelleMotif(null)).toBe("Non précisé");
  });
});
