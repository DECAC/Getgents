import { corpsDuMessage, reponseRecherche, texteDepuisHtml, TEXTE_BRUT_SUFFISANT } from "@/lib/gmailContenu";
import { GMAIL_PROMPT_INSTRUCTION } from "@/lib/gmailPrompt";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");

const NEWSLETTER_HTML =
  "<html><head><style>.x{color:red}</style><title>MyClaw</title></head><body>" +
  "<h1>AI Influencers Target FIFO Workers</h1><p>Des mineurs d&rsquo;Australie-Occidentale suivent des influenceurs&nbsp;générés par IA.</p>" +
  "<ul><li>Recrutement</li><li>Santé mentale</li></ul><!-- pixel --><script>track()</script>" +
  "<a href=\"https://track.example.com/abc\">Lire la suite</a></body></html>";

describe("corps d'un e-mail", () => {
  it("convertit le HTML en texte, sans style, script ni commentaire", () => {
    const t = texteDepuisHtml(NEWSLETTER_HTML);
    expect(t).toContain("AI Influencers Target FIFO Workers");
    expect(t).toContain("Des mineurs d’Australie-Occidentale suivent des influenceurs générés par IA.");
    expect(t).toContain("- Recrutement\n- Santé mentale");
    expect(t).toContain("Lire la suite");
    expect(t).not.toMatch(/color:red|track\(\)|pixel|track\.example|<|MyClaw/);
  });

  it("lit une newsletter HTML seulement (le corps arrivait vide)", () => {
    const payload = { mimeType: "text/html", body: { data: b64(NEWSLETTER_HTML) } };
    expect(corpsDuMessage(payload)).toContain("influenceurs générés par IA");
  });

  it("préfère le HTML quand la partie texte n'est qu'un renvoi « voir en ligne »", () => {
    const payload = {
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/plain", body: { data: b64("Voir dans le navigateur : https://x.io") } },
        { mimeType: "text/html", body: { data: b64(NEWSLETTER_HTML) } },
      ],
    };
    expect(corpsDuMessage(payload)).toContain("Santé mentale");
  });

  it("garde une partie texte qui dit vraiment quelque chose", () => {
    const texte = "Bonjour,\n" + "Voici le compte rendu. ".repeat(TEXTE_BRUT_SUFFISANT / 10);
    const payload = {
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/plain", body: { data: b64(texte) } },
        { mimeType: "text/html", body: { data: b64("<p>autre</p>") } },
      ],
    };
    expect(corpsDuMessage(payload)).toBe(texte.trim());
  });

  it("sans charge utile, rien", () => {
    expect(corpsDuMessage(undefined)).toBe("");
  });
});

describe("réponse de gmail_search", () => {
  it("vide : dit au modèle d'élargir lui-même", () => {
    const r = JSON.parse(reponseRecherche('subject:"The Batch" category:promotions', []));
    expect(r.resultats).toEqual([]);
    expect(r.conseil).toMatch(/élargis TOI-MÊME/);
    expect(r.conseil).toContain("from:");
  });

  it("porte expéditeur et objet de chaque message, et rappelle de lire avant de décrire", () => {
    const r = JSON.parse(
      reponseRecherche("from:myclaw", [{ id: "a1", from: "MyClaw <news@myclaw.ai>", subject: "AI Influencers", date: "x", snippet: "…" }])
    );
    expect(r.resultats[0]).toMatchObject({ id: "a1", from: "MyClaw <news@myclaw.ai>", subject: "AI Influencers" });
    expect(r.suite).toContain("gmail_get_message");
  });

  it("la consigne impose de relire un e-mail pour une question de suivi", () => {
    expect(GMAIL_PROMPT_INSTRUCTION).toContain("ne t'est PAS conservé");
    expect(GMAIL_PROMPT_INSTRUCTION).toContain("relis-le");
  });
});

import { demandePorteSurLaBoite, requetesElargies } from "@/lib/gmailContenu";
import { dernierTexteUtilisateur } from "@/lib/boucleOutils";

describe("question sur la boîte mail : recherche imposée au premier tour", () => {
  it("reconnaît les questions vécues", () => {
    expect(demandePorteSurLaBoite("Quel est le sujet principal de la newsletter The Batch de cette semaine ?")).toBe(true);
    expect(demandePorteSurLaBoite("Résume mes mails non lus")).toBe(true);
    expect(demandePorteSurLaBoite("Qu'ai-je reçu dans ma boîte de réception ?")).toBe(true);
    expect(demandePorteSurLaBoite("Quels expéditeurs m'écrivent le plus ?")).toBe(true);
  });

  it("n'impose rien sur une question sans rapport", () => {
    expect(demandePorteSurLaBoite("merci")).toBe(false);
    expect(demandePorteSurLaBoite("Explique-moi le Build on Buy")).toBe(false);
    expect(demandePorteSurLaBoite("")).toBe(false);
  });

  it("ignore les titres de notes du bloc [ESPACE]", () => {
    expect(demandePorteSurLaBoite("merci\n\n[ESPACE]\n- Newsletters IA de la semaine (id a1)\n[/ESPACE]")).toBe(false);
  });

  it("lit le dernier message utilisateur, contenu multimodal compris", () => {
    expect(
      dernierTexteUtilisateur([
        { role: "system", content: "S" },
        { role: "user", content: "vieux" },
        { role: "assistant", content: "A" },
        { role: "user", content: [{ type: "text", text: "la newsletter" }, { type: "image_url", image_url: { url: "x" } }] },
      ])
    ).toBe("la newsletter");
    expect(dernierTexteUtilisateur([])).toBe("");
  });
});

describe("élargissement d'une recherche vide, par le serveur", () => {
  it("retire les filtres, libère les champs, puis retire les dates", () => {
    expect(requetesElargies('subject:"The Batch" category:promotions newer_than:7d')).toEqual([
      '"The Batch" newer_than:7d',
      '"The Batch"',
    ]);
  });

  it("from: devient du texte libre", () => {
    expect(requetesElargies("from:thebatch is:unread")).toEqual(["thebatch"]);
  });

  it("rien à élargir : aucune requête de repli", () => {
    expect(requetesElargies("The Batch")).toEqual([]);
    expect(requetesElargies("")).toEqual([]);
    expect(requetesElargies(undefined)).toEqual([]);
  });

  it("la réponse dit quand les résultats viennent de la requête élargie", () => {
    const r = JSON.parse(reponseRecherche("subject:x", [{ id: "a" }], "x"));
    expect(r.requeteElargie).toBe("x");
    expect(r.note).toMatch(/requête élargie/);
  });
});
