import { destinationDuLien, lireFragment, messageLienInvalide, typeLienValide } from "@/lib/invitation";

describe("lien d'invitation", () => {
  it("lit la session d'une invitation dans le fragment", () => {
    expect(lireFragment("#access_token=a.b.c&expires_in=3600&refresh_token=r1&token_type=bearer&type=invite")).toEqual({
      genre: "session",
      accessToken: "a.b.c",
      refreshToken: "r1",
      type: "invite",
    });
    expect(lireFragment("#access_token=a&refresh_token=r&type=recovery")?.genre).toBe("session");
  });

  it("n'ouvre AUCUNE session pour un autre type de lien (pas de connexion forcée par un lien piégé)", () => {
    expect(lireFragment("#access_token=a&refresh_token=r&type=signup")).toBeNull();
    expect(lireFragment("#access_token=a&refresh_token=r")).toBeNull();
    expect(lireFragment("#access_token=a&type=invite")).toBeNull();
    expect(lireFragment("")).toBeNull();
    expect(lireFragment("#section-2")).toBeNull();
  });

  it("rapporte un lien expiré", () => {
    expect(lireFragment("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid")).toEqual({ genre: "erreur", code: "otp_expired" });
    expect(messageLienInvalide("otp_expired")).toMatch(/expiré/);
    expect(messageLienInvalide(null)).toMatch(/Mot de passe oublié/);
  });

  it("mène l'invité à son mot de passe, la réinitialisation à la sienne", () => {
    expect(destinationDuLien("invite")).toBe("/bienvenue");
    expect(destinationDuLien("recovery")).toBe("/nouveau-mot-de-passe");
    expect(destinationDuLien("signup")).toBe("/accueil");
    expect(typeLienValide("invite")).toBe(true);
    expect(typeLienValide("admin")).toBe(false);
  });
});
