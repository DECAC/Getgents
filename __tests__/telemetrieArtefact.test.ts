import { creerPlafond, validerMesureArtefact } from "@/lib/telemetrieArtefact";

describe("mesure des propositions d'artefact", () => {
  it("accepte un événement complet et valide", () => {
    expect(
      validerMesureArtefact({
        evenement: "jete",
        mode: "lien",
        forme: "dashboard",
        modele: "anthropic/claude-sonnet-5",
        frequence: "equilibre",
        gent: "Talk to Charles",
      })
    ).toEqual({
      evenement: "jete",
      mode: "lien",
      forme: "dashboard",
      modele: "anthropic/claude-sonnet-5",
      frequence: "equilibre",
      gent: "Talk to Charles",
    });
  });

  it("refuse un événement ou un mode inconnu", () => {
    expect(validerMesureArtefact({ evenement: "clic", mode: "lien" })).toBeNull();
    expect(validerMesureArtefact({ evenement: "garde", mode: "admin" })).toBeNull();
    expect(validerMesureArtefact(null)).toBeNull();
  });

  it("écarte ce qui n'est pas énuméré plutôt que de le journaliser", () => {
    const m = validerMesureArtefact({
      evenement: "propose",
      mode: "espace",
      forme: "<script>",
      modele: "modèle avec espaces; rm -rf",
      frequence: "toujours",
      titre: "une donnée personnelle",
    });
    expect(m).toEqual({ evenement: "propose", mode: "espace" });
  });

  it("borne le nom du gent et retire les caractères de contrôle", () => {
    const m = validerMesureArtefact({ evenement: "garde", mode: "espace", gent: "A\nB" + "x".repeat(200) });
    expect(m?.gent).not.toContain("\n");
    expect(m!.gent!.length).toBeLessThanOrEqual(80);
  });
});

describe("plafond de la route de mesure", () => {
  it("laisse passer jusqu'au plafond, puis refuse jusqu'à la fenêtre suivante", () => {
    const autoriser = creerPlafond(3, 60_000);
    expect([1, 2, 3].map(() => autoriser("ip", 0))).toEqual([true, true, true]);
    expect(autoriser("ip", 1_000)).toBe(false);
    expect(autoriser("autre-ip", 1_000)).toBe(true);
    expect(autoriser("ip", 61_000)).toBe(true);
  });
});
