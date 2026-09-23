import { libelleOnglet } from "@/lib/libelleOnglet";

describe("intitule d'onglet tire du contexte", () => {
  it("écarte la partie qui nomme une personne, quel que soit l'ordre", () => {
    expect(libelleOnglet("Charles de Cassan — Parcours", "Tableau de bord")).toBe("Parcours");
    expect(libelleOnglet("Charles de Cassan — résumé", "Résumé de profil")).toBe("Résumé");
    // Le cas qui a motivé la règle : la première version gardait la DERNIÈRE
    // partie et nommait l'onglet « Charles de Cassan ».
    expect(libelleOnglet("Parcours professionnel — Charles de Cassan", "Tableau de bord")).toBe(
      "Parcours professionnel"
    );
  });

  it("retient la première partie quand aucune ne nomme une personne", () => {
    expect(libelleOnglet("Synthèse — réunion du 12 mars", "Rapport")).toBe("Synthèse");
  });

  it("écarte la partie qui répète le nom du gent", () => {
    expect(libelleOnglet("Road trip Maroc — Budget", "Rapport", ["Road trip Maroc"])).toBe("Budget");
  });

  it("garde le titre entier quand il n'y a pas de tiret", () => {
    expect(libelleOnglet("Checklist de démarrage", "Checklist")).toBe("Checklist de démarrage");
  });

  it("ne coupe pas sur un tiret de mot compose", () => {
    expect(libelleOnglet("Bilan mi-2026", "Rapport")).toBe("Bilan mi-2026");
    expect(libelleOnglet("Campagne e-mail", "Rapport")).toBe("Campagne e-mail");
  });

  it("borne la longueur pour que la barre d'onglets tienne", () => {
    const long = "Analyse comparative des dispositifs de financement regionaux";
    const out = libelleOnglet(long, "Rapport");
    expect(out.length).toBeLessThanOrEqual(32);
    expect(out.endsWith("…")).toBe(true);
  });

  it("met une majuscule", () => {
    expect(libelleOnglet("parcours — Charles de Cassan", "X")).toBe("Parcours");
  });

  it("retombe sur la categorie quand le titre est vide", () => {
    expect(libelleOnglet("", "Tableau de bord")).toBe("Tableau de bord");
    expect(libelleOnglet(null, "Tableau de bord")).toBe("Tableau de bord");
  });

  it("ignore un fragment d'un seul caractere", () => {
    expect(libelleOnglet("Parcours — A", "X")).toBe("Parcours");
  });
});
