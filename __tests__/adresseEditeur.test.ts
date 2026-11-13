import { choisirAdresseEditeur } from "@/lib/server/adresseEditeur";
import { ADRESSE_DEMANDE_ACCES } from "@/lib/inscriptions";

describe("l'adresse où l'éditeur reçoit ses notifications", () => {
  it("vient de l'hébergeur quand elle y est réglée", () => {
    expect(choisirAdresseEditeur({ ADRESSE_NOTIFICATIONS_EDITEUR: " moi@exemple.fr " })).toEqual({
      adresse: "moi@exemple.fr",
      origine: "reglee",
    });
  });

  it("retombe sur l'adresse de contact quand elle manque ou est mal formée", () => {
    expect(choisirAdresseEditeur({})).toEqual({ adresse: ADRESSE_DEMANDE_ACCES, origine: "defaut" });
    expect(choisirAdresseEditeur({ ADRESSE_NOTIFICATIONS_EDITEUR: "  " }).origine).toBe("defaut");
    expect(choisirAdresseEditeur({ ADRESSE_NOTIFICATIONS_EDITEUR: "pas une adresse" })).toEqual({
      adresse: ADRESSE_DEMANDE_ACCES,
      origine: "invalide",
    });
  });
});
