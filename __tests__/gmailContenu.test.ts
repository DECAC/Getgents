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
  it("retire les filtres, libère les champs, puis les dates, puis la ponctuation", () => {
    expect(requetesElargies('subject:"The Batch" category:promotions newer_than:7d')).toEqual([
      '"The Batch" newer_than:7d',
      '"The Batch"',
      "The Batch",
      "Batch",
    ]);
  });

  it("une phrase exacte finit par tomber sur ses mots distinctifs", () => {
    /*
     * Le cas qui a motivé les deux derniers barreaux (01/10). Les deux
     * premiers ne retirent que des OPÉRATEURS : la requête de repli gardait
     * guillemets, crochets, dièse et barre verticale, et restait donc aussi
     * introuvable que l'originale. Le gent concluait « je n'ai pas trouvé »
     * sur un message qu'il avait lui-même affiché au tour précédent.
     */
    const q =
      'subject:"[TEST] Décibels #7 | L\'IA a-t-elle franchi le mur du son ?" from:"Conseil de l\'IA et du numérique"';
    const replis = requetesElargies(q);
    expect(replis[replis.length - 1]).toBe("Décibels Conseil");
    // Et la phrase exacte n'est jamais le DERNIER recours.
    expect(replis[replis.length - 1]).not.toContain('"');
  });

  it("from: devient du texte libre", () => {
    expect(requetesElargies("from:thebatch is:unread")).toEqual(["thebatch"]);
  });

  it("rien à chercher : aucune requête de repli", () => {
    expect(requetesElargies("")).toEqual([]);
    expect(requetesElargies(undefined)).toEqual([]);
  });

  it("une requête déjà nue s'élargit quand même, par ses mots distinctifs", () => {
    // Gmail joint les termes par ET : retirer un mot ÉLARGIT réellement.
    expect(requetesElargies("The Batch")).toEqual(["Batch"]);
  });

  it("un seul résultat : la consigne interdit de demander confirmation", () => {
    /*
     * Vécu (01/10). Une recherche rend UN message ; le gent demande « est-ce
     * celui-ci ? ». L'utilisateur confirme, et le gent ne le retrouve plus :
     * les résultats d'outils ne voyagent pas d'un tour à l'autre, donc
     * l'identifiant avait disparu. La question lui a fait PERDRE le message
     * qu'il tenait déjà.
     */
    const r = JSON.parse(reponseRecherche("Décibels", [{ id: "a", subject: "Décibels #7" }]));
    expect(r.suite).toContain("gmail_get_message");
    expect(r.suite).toMatch(/ne demande pas confirmation/i);
  });

  it("plusieurs résultats : lire le plus probable reste exigé dans le même tour", () => {
    const r = JSON.parse(reponseRecherche("x", [{ id: "a" }, { id: "b" }]));
    expect(r.suite).toContain("ce même tour");
    expect(r.suite).toMatch(/identifiants ci-dessus auront disparu/i);
  });

  it("la réponse dit quand les résultats viennent de la requête élargie", () => {
    const r = JSON.parse(reponseRecherche("subject:x", [{ id: "a" }], "x"));
    expect(r.requeteElargie).toBe("x");
    expect(r.note).toMatch(/requête élargie/);
  });
});

import { doitImposerRechercheMail, simplePolitesse } from "@/lib/gmailContenu";

describe("recherche imposée sur un gent dont Gmail est le seul outil", () => {
  it("toute question, même sans mot-clé (vécu : les VERBATIM de Dialange)", () => {
    for (const q of [
      "Résume-moi les deux VERBATIM de Dialange.",
      "Qu'a publié MyClaw ce matin ?",
      "Quoi de neuf aujourd'hui ?",
      "Qu'est-ce qui demande une action de ma part ?",
      "Y a-t-il des factures à payer ?",
    ]) {
      expect(doitImposerRechercheMail(q, true)).toBe(true);
    }
  });

  it("pas sur une politesse", () => {
    for (const q of ["merci", "Merci beaucoup !", "ok", "Super 👍", "d'accord.", "Bonne journée"]) {
      expect(simplePolitesse(q)).toBe(true);
      expect(doitImposerRechercheMail(q, true)).toBe(false);
    }
  });

  it("un gent qui a d'autres outils garde le filtre par mots-clés", () => {
    expect(doitImposerRechercheMail("Résume-moi les deux VERBATIM de Dialange.", false)).toBe(false);
    expect(doitImposerRechercheMail("Résume mes mails de Dialange", false)).toBe(true);
  });
});
