import { adressePolices, consigneDirection, coutDirection, nomFichierPlanche, validerProposition, POLICES } from "@/lib/publicisteDirection";
import { validerEtat, FICHE_VIDE, ETAT_VIDE } from "@/lib/publiciste";

const visuel = (n = 3) => ({
  bulle: ["J'ai relevé votre univers.", "Je recommande la deuxième."],
  recommandee: "cahier",
  pistes: Array.from({ length: n }, (_, i) => ({ id: ["marque", "cahier", "atelier"][i] ?? `x${i}`, nom: `Piste ${i}`, desc: "d", pour: "+", contre: "-", prompt: "un collage" })),
});

describe("Publiciste, lot 2 : pistes de direction", () => {
  it("valide trois pistes visuelles et la recommandation", () => {
    const p = validerProposition("visuel", visuel());
    expect(p?.visuel?.map((x) => x.id)).toEqual(["marque", "cahier", "atelier"]);
    expect(p?.recommandee).toBe("cahier");
    expect(validerProposition("visuel", visuel(2))).toBeNull();
    expect(validerProposition("visuel", { ...visuel(), bulle: [] })).toBeNull();
  });

  it("ne garde qu'un nom de planche bien formé", () => {
    const b = visuel();
    (b.pistes[0] as Record<string, unknown>).image = "visuel-marque-abc";
    (b.pistes[1] as Record<string, unknown>).image = "../../secret";
    const p = validerProposition("visuel", b)!;
    expect(p.visuel![0].image).toBe("visuel-marque-abc");
    expect(p.visuel![1].image).toBeUndefined();
    expect(nomFichierPlanche("cahier", 1000)).toMatch(/^visuel-cahier-[a-z0-9]+$/);
  });

  it("n'accepte que des polices de la liste fermée, sans doublon", () => {
    const ok = { bulle: ["a"], recommandee: "fraunces-inter", pistes: [{ id: "montserrat-ecolier" }, { id: "fraunces-inter" }, { id: "abril-lora" }], specimen: { titre: "Un titre" } };
    expect(validerProposition("typo", ok)?.typo?.map((t) => t.id)).toEqual(["montserrat-ecolier", "fraunces-inter", "abril-lora"]);
    expect(validerProposition("typo", { ...ok, pistes: [{ id: "comic-sans" }, { id: "fraunces-inter" }, { id: "abril-lora" }] })).toBeNull();
    expect(validerProposition("typo", { ...ok, pistes: [{ id: "abril-lora" }, { id: "fraunces-inter" }, { id: "abril-lora" }] })).toBeNull();
  });

  it("valide cinq couleurs hexadécimales par palette, et leurs rôles", () => {
    const pal = (id: string) => ({ id, nom: id, couleurs: ["#29377d", "#C54538", "#fff", "#f8f6ef", "#9db0d6"].map((hex) => ({ nom: hex, hex })), fond: "#f8f6ef", encre: "#29377d", accent: "pas-une-couleur" });
    const p = validerProposition("couleurs", { bulle: ["a"], recommandee: "b", pistes: [pal("a"), pal("b"), pal("c")] })!;
    expect(p.couleurs![0].couleurs[1].hex).toBe("#c54538");
    expect(p.couleurs![0].couleurs[2].hex).toBe("#ffffff");
    expect(p.couleurs![0].accent).toBe("#c54538");
    expect(validerProposition("couleurs", { bulle: ["a"], pistes: [pal("a"), pal("b"), { ...pal("c"), couleurs: [] }] })).toBeNull();
  });

  it("charge les polices en une adresse Google Fonts, graisses regroupées par famille", () => {
    const u = adressePolices(["montserrat-ecolier", "bricolage-montserrat"])!;
    expect(u.match(/family=Montserrat:/g)).toHaveLength(1);
    expect(u).toContain("family=Montserrat:wght@400;600;700;800");
    expect(adressePolices(["inconnue"])).toBeNull();
    expect(POLICES).toHaveLength(10);
  });

  it("la consigne porte la fiche, les choix précédents et la remarque", () => {
    const c = consigneDirection("couleurs", { ...FICHE_VIDE, marque: "Le Cadeau Français" }, { visuel: { nom: "Cahier", desc: "encre bleue" } }, "plus chaud");
    expect(c).toContain("Le Cadeau Français");
    expect(c).toContain("Univers choisi : Cahier");
    expect(c).toContain("plus chaud");
  });

  it("additionne ce qu'a coûté la direction", () => {
    const p = validerProposition("visuel", visuel())!;
    p.visuel![0].cout = 0.14;
    p.visuel![1].cout = 0.15;
    expect(coutDirection({ visuel: p }, 0.05)).toEqual({ texte: 0.05, planches: 0.29, total: 0.34 });
  });

  it("l'état enregistré garde les propositions, planches comprises, à l'aller-retour", () => {
    const p = validerProposition("visuel", visuel())!;
    p.visuel![0].image = "visuel-marque-abc";
    p.visuel![0].cout = 0.14;
    const e = validerEtat(JSON.parse(JSON.stringify({ ...ETAT_VIDE, etape: "visuel", direction: { visuel: p }, depenseTexte: 0.05, choix: { visuel: "cahier" } })))!;
    expect(e.direction?.visuel?.visuel?.[0]).toMatchObject({ image: "visuel-marque-abc", cout: 0.14 });
    expect(e.direction?.visuel?.recommandee).toBe("cahier");
    expect(e.depenseTexte).toBe(0.05);
  });
});
