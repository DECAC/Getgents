import { accesValide, codeSaisi, empreinteCode, mailCode, masquerEmail, nouveauCode, peutRecevoirCode, signerAcces } from "@/lib/accesCode";

describe("accès protégé par code", () => {
  it("un code a toujours 6 chiffres", () => {
    for (let i = 0; i < 200; i++) expect(nouveauCode()).toMatch(/^\d{6}$/);
  });

  it("la saisie tolère espaces et tirets, rien d'autre", () => {
    expect(codeSaisi(" 482 931 ")).toBe("482931");
    expect(codeSaisi("482-931")).toBe("482931");
    expect(codeSaisi("48293")).toBeNull();
    expect(codeSaisi("48293a")).toBeNull();
    expect(codeSaisi(482931)).toBeNull();
  });

  it("l'empreinte est liée au lien : le code d'un lien ne vaut rien pour un autre", () => {
    expect(empreinteCode("A", "123456")).not.toBe(empreinteCode("B", "123456"));
    expect(empreinteCode("A", "123456")).toBe(empreinteCode("A", "123456"));
  });

  it("l'adresse est masquée sans rien révéler d'autre que l'initiale et le domaine", () => {
    expect(masquerEmail("marie.dupont@acme.fr")).toBe("m•••@acme.fr");
    expect(masquerEmail("pas-une-adresse")).toBe("•••");
  });

  it("seul un lien adressé à une ADRESSE peut recevoir un code", () => {
    expect(peutRecevoirCode("marie@acme.fr")).toBe(true);
    expect(peutRecevoirCode("Marie Dupont")).toBe(false);
  });

  it("le cookie d'accès : signé, lié au lien, borné dans le temps", () => {
    const maintenant = 1_000_000;
    const v = signerAcces("cle", "JETON", maintenant + 1000);
    expect(accesValide("cle", "JETON", v, maintenant)).toBe(true);
    expect(accesValide("cle", "AUTRE", v, maintenant)).toBe(false);
    expect(accesValide("autre-cle", "JETON", v, maintenant)).toBe(false);
    expect(accesValide("cle", "JETON", v, maintenant + 2000)).toBe(false);
    expect(accesValide("cle", "JETON", v.replace(/.$/, (c) => (c === "A" ? "B" : "A")), maintenant)).toBe(false);
    expect(accesValide("", "JETON", v, maintenant)).toBe(false);
    expect(accesValide("cle", "JETON", undefined, maintenant)).toBe(false);
  });

  it("le mail du code ne contient aucun lien, et échappe le titre", () => {
    const m = mailCode("<script>Offre</script>", "482931");
    expect(m.html).toMatch(/482931/);
    expect(m.html).not.toMatch(/<a /);
    expect(m.html).not.toMatch(/<script>/);
  });
});
