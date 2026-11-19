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

describe("lecture jointe à une réponse", () => {
  const { lectureValide, pastillesLecture, mentionReponse } = jest.requireActual("@/lib/engagement") as typeof import("@/lib/engagement");
  const maintenant = Date.parse("2026-11-19T18:00:00Z");
  it("n'accepte que la visite EN COURS, bornée", () => {
    expect(lectureValide({ debut: "2026-11-19T17:50:00Z", duree: 240.4, profondeur: 130 }, maintenant)).toEqual({
      debut: "2026-11-19T17:50:00.000Z",
      duree: 240,
      profondeur: 100,
      appareil: null,
    });
    expect(lectureValide({ debut: "2026-11-10T10:00:00Z", duree: 10 }, maintenant)).toBeNull();
    expect(lectureValide({ debut: "2026-11-20T10:00:00Z", duree: 10 }, maintenant)).toBeNull();
    expect(lectureValide("oui", maintenant)).toBeNull();
  });
  it("se lit en pastilles pour l'auteur", () => {
    expect(pastillesLecture({ debut: "x", duree: 240, profondeur: 97, appareil: "telephone" })).toEqual(["4 min", "Lue jusqu'en bas", "Téléphone"]);
    expect(pastillesLecture({ debut: "x", duree: 20, profondeur: null })).toEqual(["20 s"]);
  });
  it("la mention nomme la lecture seulement quand elle part", () => {
    expect(mentionReponse("Marie", true, true)).toBe(
      "Votre réponse sera transmise à l'auteur, avec votre nom (Marie), les choix cochés ci-dessus et votre lecture de la page. Rien d'autre n'est envoyé."
    );
    expect(mentionReponse("Marie", false, false)).not.toMatch(/lecture/);
  });
});

describe("choix repérés dans le code de la page", () => {
  const { compterChoix, INTITULES_SUGGERES } = jest.requireActual("@/lib/engagement") as typeof import("@/lib/engagement");
  it("compte cases, radios, listes et sorties, en HTML comme en JSX", () => {
    expect(compterChoix('<label><input type="checkbox"> A</label><input type=radio name=x><select></select><output>8</output>')).toBe(4);
    expect(compterChoix('<input type={"checkbox"} checked={x} />')).toBe(1);
    expect(compterChoix('<input type="text"><textarea></textarea>')).toBe(0);
  });
  it("propose « Valider mes choix » en premier", () => {
    expect(INTITULES_SUGGERES[0]).toBe("Valider mes choix");
  });
});
