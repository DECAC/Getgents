import { choixValides, intituleValide, ligneChoix, mentionReponse, motValide, reglageValide } from "@/lib/engagement";
import { AMORCE_ARTEFACT } from "@/lib/documentArtefact";

describe("bouton d'engagement", () => {
  test("intitulé : nettoyé, borné à 30, jamais vide", () => {
    expect(intituleValide("  Je   suis intéressé ")).toBe("Je suis intéressé");
    expect(intituleValide("a".repeat(31))).toBeNull();
    expect(intituleValide("   ")).toBeNull();
    expect(intituleValide(42)).toBeNull();
  });

  test("réglage : les trois champs exigés", () => {
    expect(reglageValide({ actif: true, intitule: "Je viens", mot: false })).toEqual({ actif: true, intitule: "Je viens", mot: false });
    expect(reglageValide({ actif: "oui", intitule: "Je viens", mot: false })).toBeNull();
  });

  test("mot : facultatif, 500 caractères au plus", () => {
    expect(motValide("")).toEqual({ ok: true, mot: null });
    expect(motValide("Bonjour\r\nà demain")).toEqual({ ok: true, mot: "Bonjour\nà demain" });
    expect(motValide("x".repeat(501))).toEqual({ ok: false });
  });

  test("choix : revalidés, bornés, dédoublonnés, 20 au plus", () => {
    const c = choixValides([
      { groupe: "À vous de choisir : douche ou baignoire", valeur: "Baignoire avec pare-bain", modifie: true },
      { groupe: "À vous de choisir : douche ou baignoire", valeur: "Baignoire avec pare-bain", modifie: true },
      { groupe: "Le carrelage", valeur: "Prestige" },
      { valeur: 3 },
      "<script>",
      { groupe: "x", valeur: "   " },
    ]);
    expect(c).toEqual([
      { groupe: "À vous de choisir : douche ou baignoire", valeur: "Baignoire avec pare-bain", modifie: true },
      { groupe: "Le carrelage", valeur: "Prestige", modifie: false },
    ]);
    expect(choixValides(Array.from({ length: 40 }, (_, i) => ({ valeur: `v${i}` })))).toHaveLength(20);
    expect(choixValides([{ valeur: "a".repeat(200) }])[0].valeur.length).toBeLessThanOrEqual(80);
    expect(choixValides("pas une liste")).toEqual([]);
    expect(ligneChoix({ groupe: "", valeur: "Prestige", modifie: false })).toBe("Prestige");
  });

  test("la mention dit ce qui part, et seulement ça", () => {
    expect(mentionReponse("Marie", false)).toBe("Votre réponse sera transmise à l'auteur, avec votre nom (Marie). Rien d'autre n'est envoyé.");
    expect(mentionReponse("Marie", true)).toContain("et les choix cochés ci-dessus");
  });

  test("l'amorce ne relève JAMAIS un champ de saisie libre", () => {
    expect(AMORCE_ARTEFACT).toContain('querySelectorAll("input,select,output")');
    expect(AMORCE_ARTEFACT).toMatch(/t==="radio"\|\|t==="checkbox"/);
    expect(AMORCE_ARTEFACT).toMatch(/t==="range"\|\|t==="number"/);
    // Aucune branche pour text, email, tel, password, textarea.
    expect(AMORCE_ARTEFACT).not.toMatch(/textarea|"text"|"email"|"tel"|"password"/);
  });
});
