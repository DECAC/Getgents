import { consigneDeLangue, langueDeLEnTete, nomDeLangue } from "@/lib/langue";

describe("langueDeLEnTete", () => {
  it("lit une préférence simple", () => {
    expect(langueDeLEnTete("es")).toBe("es");
    expect(langueDeLEnTete("en-US")).toBe("en");
  });

  it("respecte les pondérations, pas l'ordre d'écriture", () => {
    // `q=` est la seule chose qui fait foi. Prendre le premier élément écrit
    // donnerait « en » là où le navigateur demande d'abord l'espagnol.
    expect(langueDeLEnTete("en;q=0.5,es;q=0.9")).toBe("es");
  });

  it("ignore la région", () => {
    // Un Québécois et un Belge veulent tous deux du français : distinguer les
    // variantes n'apporte rien à une consigne de langue.
    expect(langueDeLEnTete("fr-CA,fr;q=0.9,en;q=0.8")).toBe("fr");
  });

  it("écarte le joker et les poids nuls", () => {
    // `*` veut dire « n'importe laquelle » : ce n'est pas une langue, et la
    // retenir ferait dire au modèle de répondre en « * ».
    expect(langueDeLEnTete("*")).toBeNull();
    expect(langueDeLEnTete("de;q=0,fr;q=0.4")).toBe("fr");
  });

  it("survit à un en-tête absent ou illisible", () => {
    // L'en-tête vient du réseau : il peut manquer, ou être n'importe quoi.
    for (const v of [null, undefined, "", "   ", ";;;", "12345"]) {
      expect(langueDeLEnTete(v as string | null)).toBeNull();
    }
  });
});

describe("nomDeLangue", () => {
  it("nomme les langues connues", () => {
    expect(nomDeLangue("es")).toBe("espagnol");
    expect(nomDeLangue("EN")).toBe("anglais");
  });

  it("rend null plutôt qu'un code brut", () => {
    // Écrire « réponds en xh » dans un prompt vaut moins que ne rien dire :
    // le modèle suivra alors la langue du message, ce qui est correct.
    expect(nomDeLangue("xh")).toBeNull();
    expect(nomDeLangue(null)).toBeNull();
  });
});

describe("consigneDeLangue", () => {
  it("fait primer la langue du message sur celle du navigateur", () => {
    // Le cas courant : un francophone dont le système est en anglais. Se fier
    // au navigateur seul le basculerait dans une langue qu'il n'a pas choisie.
    const c = consigneDeLangue("en");
    expect(c).toMatch(/dernier message\s+fait foi/i);
    expect(c).toMatch(/anglais/);
    expect(c).toMatch(/tant qu'il n'a rien écrit/i);
  });

  it("reste utilisable sans indication de navigateur", () => {
    const c = consigneDeLangue(null);
    expect(c).toMatch(/langue de ton interlocuteur/i);
    expect(c).not.toMatch(/navigateur/i);
  });

  it("ne nomme jamais une langue inconnue", () => {
    expect(consigneDeLangue("xh")).not.toMatch(/xh/);
  });

  it("protège les citations", () => {
    // « Tout dire dans la langue de l'utilisateur » pousse les modèles à
    // traduire une citation en la présentant comme l'original — c'est-à-dire
    // à la falsifier.
    expect(consigneDeLangue("es")).toMatch(/CITATIONS.*langue d'origine/is);
  });
});
