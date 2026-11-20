import { corpsEmailContact, CONTACT_MAX, objetContact, validerMessage } from "@/lib/contact";

const de = { email: "sophie@exemple.fr", nomAffiche: "Sophie", userId: "u-1", offre: "pages" };

describe("Nous contacter", () => {
  it("refuse un message vide, trop court ou trop long", () => {
    expect(validerMessage("   ")).toBe("vide");
    expect(validerMessage("ok")).toBe("court");
    expect(validerMessage("x".repeat(CONTACT_MAX + 1))).toBe("long");
    expect(validerMessage("Pouvoir dupliquer une page")).toBeNull();
  });

  it("échappe tout ce qu'a écrit l'utilisateur, nom affiché compris", () => {
    const corps = corpsEmailContact("<script>alert(1)</script>", { ...de, nomAffiche: "<b>x</b>" });
    expect(corps).not.toContain("<script>");
    expect(corps).not.toContain("<b>x</b>");
    expect(corps).toContain("&lt;script&gt;");
  });

  it("garde les retours à la ligne et prévient quand l'adresse n'est pas confirmée", () => {
    expect(corpsEmailContact("a\nb c d", de)).toContain("a<br>b c d");
    expect(corpsEmailContact("bonjour", { ...de, email: null })).toContain("non confirmée");
  });

  it("préfixe l'objet et le coupe sur une ligne", () => {
    const objet = objetContact("Une\nidée  " + "x".repeat(100));
    expect(objet.startsWith("[Getgents · Contact] Une idée ")).toBe(true);
    expect(objet.endsWith("…")).toBe(true);
    expect(objet).not.toContain("\n");
  });
});
