import {
  langueDeclaree,
  langueDeLaPage,
  langueDuTexte,
  langueEffective,
  messageLecteur,
  TEXTES,
  amorcesParDefaut,
} from "@/lib/langueLecteur";
import { mailCode } from "@/lib/accesCode";
import { modeleMail } from "@/lib/mcpPartage";
import { messageRappel, messageRelance, messageWhatsApp } from "@/lib/groupesPages";
import { enteteVignette, etiquetteVignette } from "@/lib/vignetteLien";
import { apercuDuLien } from "@/lib/apercuLien";

const EN = "<p>Thank you for your interest. This proposal is for you and your team, with the plan we discussed and the price we agreed on. We will start in January and you can reply to this page.</p>";
const FR = "<p>Merci pour votre intérêt. Cette proposition est pour vous et votre équipe, avec le plan dont nous avons parlé et le prix que nous avons convenu. Nous commençons en janvier et vous pouvez répondre sur cette page.</p>";

describe("langue des lecteurs : détection", () => {
  it("lit la langue déclarée par la page, région comprise", () => {
    expect(langueDeclaree('<!doctype html><html lang="en-GB"><body>')).toBe("en");
    expect(langueDeclaree("<html lang='fr'>")).toBe("fr");
    expect(langueDeclaree('<html lang="de">')).toBeNull();
    expect(langueDeclaree("<div>pas de html</div>")).toBeNull();
  });

  it("reconnaît le texte anglais et le texte français, sans se fier aux scripts", () => {
    expect(langueDuTexte(EN)).toBe("en");
    expect(langueDuTexte(FR)).toBe("fr");
    expect(langueDuTexte("<script>the the the and and and is is is for for for you you you</script><p>Bonjour</p>")).toBeNull();
    expect(langueDuTexte("<p>Trop court</p>")).toBeNull();
  });

  it("la déclaration prime sur le texte, et le français est le défaut", () => {
    expect(langueDeLaPage(`<html lang="fr"><body>${EN}</body></html>`)).toBe("fr");
    expect(langueDeLaPage(EN)).toBe("en");
    expect(langueDeLaPage("<p>?</p>")).toBe("fr");
  });

  it("ordre : choix du lecteur, réglage de l'auteur, puis la page", () => {
    expect(langueEffective({ choix: "fr", reglage: "en", contenu: EN })).toBe("fr");
    expect(langueEffective({ choix: undefined, reglage: "fr", contenu: EN })).toBe("fr");
    expect(langueEffective({ choix: "de", reglage: "auto", contenu: EN })).toBe("en");
  });
});

describe("langue des lecteurs : textes", () => {
  it("les deux langues ont exactement les mêmes clés", () => {
    expect(Object.keys(TEXTES.en).sort()).toEqual(Object.keys(TEXTES.fr).sort());
  });

  it("aucun texte anglais ne contient de français oublié", () => {
    const valeurs = Object.values(TEXTES.en).map((v) => (typeof v === "function" ? (v as (...a: unknown[]) => string)("X", "Y", true) : v));
    for (const v of valeurs) expect(v).not.toMatch(/\b(votre|vous|nous|le document|l'auteur|réessayez)\b/i);
  });

  it("mention de réponse en anglais", () => {
    expect(TEXTES.en.mention("Sarah", true, true)).toBe(
      "Your reply will be sent to the author, with your name (Sarah), the choices ticked above and your reading of the page. Nothing else is sent."
    );
  });

  it("traduit les messages des routes, garde le français inconnu", () => {
    expect(messageLecteur("Vous avez déjà répondu sur ce lien.", "en")).toBe("You have already replied on this link.");
    expect(messageLecteur("Un code vient de partir. Attendez 42 s avant d'en redemander un.", "en")).toBe("A code was just sent. Wait 42 s before asking for another.");
    expect(messageLecteur("Paul a déjà répondu.", "en")).toBe("Paul has already replied.");
    expect(messageLecteur("Message inconnu.", "en")).toBe("Message inconnu.");
    expect(messageLecteur("Vous avez déjà répondu sur ce lien.", "fr")).toBe("Vous avez déjà répondu sur ce lien.");
  });

  it("questions suggérées par défaut en anglais", () => {
    expect(amorcesParDefaut(false, "en")[0]).toBe("Summarise this document");
  });
});

describe("langue des lecteurs : e-mails, messages et aperçu", () => {
  it("e-mail du code en anglais, titre échappé", () => {
    const m = mailCode("Q3 <proposal>", "481273", "en");
    expect(m.objet).toBe("Your code to open “Q3 <proposal>”");
    expect(m.html).toContain("Here is your code to open <b>Q3 &lt;proposal&gt;</b>:");
    expect(m.html).toContain("valid for 10 minutes");
    expect(mailCode("Devis", "1", "fr").objet).toBe("Votre code pour ouvrir « Devis »");
  });

  it("modèle de mail du connecteur dans la langue des lecteurs", () => {
    const d = { titre: "Q3", contenu: "x", format: "html" as const, destinataire: "Sarah" };
    expect(modeleMail(d, "L", "en").corps).toBe("Hi Sarah,\n\nAs discussed, here is the document prepared for you:\nL\n\nBest regards,");
    expect(modeleMail({ ...d, destinataire: "s@x.com" }, "L", "en").corps).toMatch(/^Hello,/);
    expect(modeleMail(d, "L").corps).toMatch(/^Bonjour Sarah,/);
  });

  it("messages WhatsApp en anglais", () => {
    expect(messageWhatsApp({ prenom: "Sarah", titre: "Q3", lien: "L", langue: "en" })).toBe("Hi Sarah, here is “Q3”: L");
    expect(messageRelance({ titre: "Q3", lien: "L", attente: ["Emma", "Noah"], langue: "en" })).toBe(
      "Quick reminder for “Q3”: we're still waiting for Emma and Noah. Reply here: L"
    );
    expect(messageRappel({ prenom: "Sarah", titre: "Q3", lien: "L", langue: "en" })).toBe("Quick reminder: Hi Sarah, here is “Q3”: L");
    expect(messageRappel({ prenom: "Marie", titre: "Q3", lien: "L" })).toBe("Petit rappel : Bonjour Marie, voici « Q3 » : L");
  });

  it("aperçu du lien et vignette en anglais", () => {
    const a = apercuDuLien({ titre: "Q3", contenu: "", destinataire: "Sarah", protegee: false, action: "I'm in", assistant: true, langue: "en" });
    expect(a.langue).toBe("en");
    expect(a.description).toBe("A page shared with you through a private link. You can reply in one click. A question? An assistant answers from the page.");
    expect(apercuDuLien({ titre: "Q3", contenu: "", destinataire: "Sarah", protegee: true, action: null, assistant: false, langue: "en" }).description).toMatch(
      /^Private page/
    );
    expect(enteteVignette("Sarah", false, "en")).toBe("A PAGE FOR SARAH");
    expect(etiquetteVignette("prive", "en")).toBe("psst, it's private!");
    expect(etiquetteVignette("prive")).toBe("psst, c'est privé !");
  });
});
