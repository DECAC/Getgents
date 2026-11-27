import {
  consignePubliciste,
  extraireFiche,
  remplissage,
  validerEtat,
  validerFiche,
  ETAPES_PUBLICISTE,
  MARQUEUR_FICHE,
  MARQUEUR_FICHE_FIN,
  ETAT_MAX_OCTETS,
} from "@/lib/publiciste";

const fiche = (o: object) => `${MARQUEUR_FICHE}\n${JSON.stringify(o)}\n${MARQUEUR_FICHE_FIN}`;

describe("Publiciste : fiche de l'entretien", () => {
  it("retire la fiche de la réponse et la rend validée", () => {
    const r = extraireFiche(`Et plus loin encore ? Un souvenir d'enfance ?\n\n${fiche({ projet: "Le premier couteau", marque: "Le Cadeau Français", fond: { vend: "Des cadeaux d'entreprise" }, forme: {} })}`);
    expect(r.text).toBe("Et plus loin encore ? Un souvenir d'enfance ?");
    expect(r.fiche).toMatchObject({ projet: "Le premier couteau", fond: { vend: "Des cadeaux d'entreprise" }, pret: false, formeDecidee: false });
  });

  it("garde la dernière fiche, retire un bloc illisible ou coupé", () => {
    expect(extraireFiche(`${fiche({ projet: "A" })} puis ${fiche({ projet: "B" })}`).fiche?.projet).toBe("B");
    expect(extraireFiche(`Question ?${MARQUEUR_FICHE}{cassé${MARQUEUR_FICHE_FIN}`)).toEqual({ text: "Question ?" });
    expect(extraireFiche(`Question ?\n${MARQUEUR_FICHE}\n{"projet": "co`)).toEqual({ text: "Question ?" });
  });

  it("n'accepte que les rubriques prévues, jamais une clé inventée", () => {
    const f = validerFiche({ fond: { vend: "x", inconnue: "y" }, forme: { ou: "LinkedIn", pirate: "z" }, pret: "oui" });
    expect(f?.fond).toEqual({ vend: "x" });
    expect(f?.forme).toEqual({ ou: "LinkedIn" });
    expect(f?.pret).toBe(false);
    expect(validerFiche("rien")).toBeNull();
  });

  it("compte l'avancement de l'entretien", () => {
    expect(remplissage(validerFiche({ fond: { vend: "a", coeur: "b" }, forme: { ou: "c" } })!)).toEqual({ remplies: 3, total: 9 });
  });

  it("la consigne nomme les marqueurs, toutes les rubriques, et la première question posée par l'écran", () => {
    const c = consignePubliciste();
    expect(c).toContain(MARQUEUR_FICHE);
    expect(c).toContain(MARQUEUR_FICHE_FIN);
    for (const cle of ["vend", "pourQui", "coeur", "ressenti", "aEviter", "matiere", "ou", "forme", "aMontrer"]) expect(c).toContain(`"${cle}"`);
    expect(c).toContain("qu'est-ce que vous vendez".replace("q", "Q"));
  });
});

describe("Publiciste : état du projet", () => {
  it("suit les huit étapes de la maquette, dans son ordre", () => {
    expect(ETAPES_PUBLICISTE.map((e) => e.id)).toEqual(["entretien", "visuel", "typo", "couleurs", "musique", "voix", "storyboard", "recap"]);
  });

  it("valide un état venu du navigateur : étape connue, choix bornés", () => {
    const e = validerEtat({ etape: "voix", fiche: { projet: "P" }, choix: { visuel: "cahier", inconnu: "x", typo: 3 } });
    expect(e).toMatchObject({ etape: "voix", fiche: { projet: "P" }, choix: { visuel: "cahier" } });
    expect(validerEtat({ etape: "piratage" })?.etape).toBe("entretien");
    expect(validerEtat(null)).toBeNull();
  });

  it("refuse un état trop lourd", () => {
    expect(validerEtat({ etape: "entretien", bourrage: "x".repeat(ETAT_MAX_OCTETS) })).toBeNull();
  });
});
