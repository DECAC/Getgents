/**
 * Langue de ce que voit le LECTEUR d'une page partagée (lot anglais 1, 23/11).
 * Module PUR.
 *
 * Règle : la langue suit la PAGE, pas l'auteur ni Getgents. Dans l'ordre :
 * le choix explicite du lecteur (FR | EN du bandeau, cookie), le réglage de
 * l'auteur dans la fiche, la langue que la page déclare (`<html lang>`),
 * la langue de son texte (mots courants, sans modèle), et à défaut le
 * français. Deux langues seulement : une page en allemand garde le français.
 *
 * Ce que l'auteur écrit lui-même (intitulé du bouton, questions suggérées)
 * n'est JAMAIS traduit.
 */

export type Langue = "fr" | "en";
export type ReglageLangue = "auto" | Langue;

export const LANGUES: readonly Langue[] = ["fr", "en"];
/** Cookie du choix explicite du lecteur (bouton FR | EN). */
export const COOKIE_LANGUE = "gg_langue";

export function estLangue(v: unknown): v is Langue {
  return v === "fr" || v === "en";
}

export function reglageValide(v: unknown): ReglageLangue | null {
  return v === "auto" || estLangue(v) ? v : null;
}

/** `<html lang="en-GB">` → "en". Null si absente ou hors fr / en. */
export function langueDeclaree(contenu: string): Langue | null {
  const m = /<html\b[^>]*\blang\s*=\s*["']?([a-zA-Z]{2})/i.exec(contenu.slice(0, 5000));
  const l = m?.[1].toLowerCase();
  return estLangue(l) ? l : null;
}

const MOTS_FR = ["le", "la", "les", "des", "est", "et", "une", "pour", "vous", "avec", "dans", "sur", "pas", "que", "qui", "du", "au", "votre", "nous", "sont"];
const MOTS_EN = ["the", "and", "is", "are", "for", "you", "with", "your", "this", "that", "of", "to", "in", "on", "we", "our", "be", "will", "it", "from"];

/** Langue du TEXTE (balises, scripts et styles retirés), par les mots les plus courants. Null si indécidable. */
export function langueDuTexte(contenu: string): Langue | null {
  const texte = contenu
    .slice(0, 200_000)
    .replace(/<(script|style|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase();
  const mots = texte.match(/[a-zàâçéèêëîïôûùüÿœ']+/g) ?? [];
  if (mots.length < 20) return null;
  const fr = new Set(MOTS_FR);
  const en = new Set(MOTS_EN);
  let nFr = 0;
  let nEn = 0;
  for (const m of mots.slice(0, 4000)) {
    if (fr.has(m)) nFr++;
    else if (en.has(m)) nEn++;
  }
  if (nFr + nEn < 8) return null;
  if (nEn >= nFr * 1.5) return "en";
  if (nFr >= nEn * 1.5) return "fr";
  return null;
}

/** Langue détectée de la page : déclarée, sinon celle du texte, sinon le français. */
export function langueDeLaPage(contenu: string): Langue {
  return langueDeclaree(contenu) ?? langueDuTexte(contenu) ?? "fr";
}

/** Langue montrée au lecteur. */
export function langueEffective(p: { choix?: unknown; reglage?: ReglageLangue | null; contenu: string }): Langue {
  if (estLangue(p.choix)) return p.choix;
  if (p.reglage && p.reglage !== "auto") return p.reglage;
  return langueDeLaPage(p.contenu);
}

/** Date lisible, fuseau de Paris (comme avant), dans la langue du lecteur. */
export function dateLisible(iso: string, langue: Langue): string {
  return new Date(iso).toLocaleDateString(langue === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
}
export function heureLisible(iso: string, langue: Langue): string {
  return new Date(iso).toLocaleTimeString(langue === "en" ? "en-GB" : "fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
}

const listeFr = (p: string[]) => (p.length === 1 ? p[0] : `${p.slice(0, -1).join(", ")} et ${p[p.length - 1]}`);
const listeEn = (p: string[]) => (p.length === 1 ? p[0] : `${p.slice(0, -1).join(", ")} and ${p[p.length - 1]}`);

/** Tous les textes de l'habillage du lecteur. Les deux langues ont les MÊMES clés (un test le garde). */
export const TEXTES = {
  fr: {
    // Bandeau
    pour: (d: string) => `Pour ${d}`,
    misAJourA: (h: string) => `mis à jour à ${h}`,
    misAJourLe: (d: string) => `mis à jour le ${d}`,
    lienPrive: "Lien privé · Getgents",
    confidentialite: "Confidentialité",
    vous: "Vous :",
    changer: "Changer",
    choisirLangue: "Langue de la page",
    // Boutons flottants et bulle
    poserQuestion: "Poser une question",
    ouvrirAssistant: "Ouvrir l'assistant du document",
    bulleTitre: "Une question sur ce document ?",
    bulleTexte: "L'assistant y répond à partir du document.",
    masquer: "Masquer",
    fermer: "Fermer",
    // Réponse
    reponseEnvoyee: "✓ Réponse envoyée à l'auteur",
    merci: "Merci, votre réponse a été transmise à l'auteur.",
    vosChoix: "Vos choix dans la page",
    decochez: "Décochez ce que vous ne souhaitez pas transmettre.",
    unMot: "Un mot pour l'auteur (facultatif)",
    joindreTitre: "Joindre ma lecture de la page",
    joindreTexte: "Quand je l'ai ouverte, combien de temps, jusqu'où, sur quel appareil. Pour ce lien seulement.",
    annuler: "Annuler",
    envoyer: "Envoyer",
    envoi: "Envoi…",
    reponseEchec: "Votre réponse n'a pas pu être envoyée. Réessayez.",
    connexionImpossible: "Connexion impossible. Réessayez.",
    mention: (destinataire: string | null, avecChoix: boolean, avecLecture: boolean) => {
      const p = [destinataire ? `votre nom (${destinataire})` : "votre nom"];
      if (avecChoix) p.push("les choix cochés ci-dessus");
      if (avecLecture) p.push("votre lecture de la page");
      return `Votre réponse sera transmise à l'auteur, avec ${listeFr(p)}. Rien d'autre n'est envoyé.`;
    },
    // Qui êtes-vous ?
    quiTitre: "Qui êtes-vous ?",
    quiTexte: "Choisissez votre prénom : votre réponse sera transmise à l'auteur sous ce nom.",
    dejaRepondu: "a déjà répondu",
    quiPied: "Vous n'êtes pas dans la liste ? Demandez à l'auteur de vous ajouter. Votre choix est retenu sur cet appareil ; « Changer » dans le bandeau.",
    // Assistant
    assistantNom: "Assistant du document",
    assistantSous: "Vos questions sur ce document",
    assistantBonjour: "Bonjour, je peux vous aider à lire ce document : posez-moi une question.",
    assistantSaisie: "Poser une question sur ce document…",
    assistantVide: "L'assistant n'a rien répondu. Reformulez votre question.",
    assistantEchec: "L'assistant n'a pas pu répondre.",
    assistantMention: "Réponses d'une IA : elles peuvent se tromper et n'engagent pas l'auteur.",
    agrandir: "Agrandir",
    reduire: "Réduire",
    fermerAssistant: "Fermer l'assistant",
    // Code
    porteSansAdresseTitre: "Cette page est protégée",
    porteSansAdresseTexte: "Ce lien n'est rattaché à aucune adresse e-mail : impossible de vous envoyer un code. Demandez un nouveau lien à la personne qui vous l'a envoyé.",
    porteIndispoTitre: "Page momentanément indisponible",
    porteIndispoTexte: "Le contrôle d'accès ne répond pas. Réessayez dans quelques minutes.",
    porteTitre: "Cette page vous est réservée",
    porteTexte: (masque: string) => `Pour l'ouvrir, confirmez que vous êtes bien son destinataire : nous envoyons un code à ${masque}.`,
    recevoirCode: "Recevoir mon code",
    pasVotreAdresse: "Ce n'est pas votre adresse ? Demandez un nouveau lien à la personne qui vous l'a envoyé.",
    saisirTitre: "Saisissez votre code",
    envoyeA: (masque: string) => `Envoyé à ${masque}. Il est valable 10 minutes.`,
    codeSixChiffres: "Code à 6 chiffres",
    verification: "Vérification…",
    ouvrirPage: "Ouvrir la page",
    rienRecu: "Rien reçu ? Regardez vos indésirables, ou",
    renvoyer: "renvoyer le code",
    souvenir: "Une fois validé, ce navigateur s'en souvient 30 jours.",
    codeNonEnvoye: "Le code n'a pas pu être envoyé.",
    codeRefuse: "Code refusé.",
    reference: "réf.",
    // Confidentialité
    confTitre: "Vos données sur cette page",
    confSousAuteur: (titre: string, auteur: string) => `« ${titre} » · auteur : ${auteur}, qui vous l'a envoyée via Getgents.`,
    confSous: (titre: string) => `« ${titre} », envoyée via Getgents.`,
    confToujours: "Toujours, sans votre nom",
    confOuvertures: "Le nombre d'ouvertures de la page, sans dire par qui.",
    confQuestions: "Les questions posées à l'assistant, sans votre nom ni votre lien, datées du jour seulement. L'auteur s'en sert pour améliorer la page.",
    confSiReponse: "Seulement si vous répondez",
    confReponse: "Si l'auteur propose un bouton de réponse et que vous le cliquez : votre nom, les choix que vous laissez cochés et votre mot, montrés avant l'envoi.",
    confLecture: "Votre lecture de cette visite (quand, combien de temps, jusqu'où, ordinateur ou téléphone), seulement si vous cochez « Joindre ma lecture de la page ». Elle est mesurée dans la page et n'en sort pas autrement.",
    confJamais: "Jamais",
    confLocalisation: "Aucune localisation.",
    confHors: "Rien de ce que vous faites hors de cette page.",
    confPrenom: "Sur un lien de groupe, le prénom que vous choisissez reste sur cet appareil ; il ne part qu'avec votre réponse.",
    confPub: "Aucune publicité, aucune revente.",
    confIaTitre: "Les réponses de l'assistant",
    confIa: "Elles sont produites par une IA, à partir du contenu de cette page. Elles peuvent se tromper et n'engagent pas l'auteur.",
    confQuiTitre: "Qui traite ces données",
    confQui: "Getgents héberge la page et l'assistant. Pour répondre, votre question et le texte de la page sont envoyés à un fournisseur de modèles d'IA.",
    confCodeTitre: "Page protégée par code",
    confCode: "L'auteur voit que le code envoyé à votre adresse a été validé, et quand : c'est ce qui protège la page.",
    confDureeTitre: "Durée et effacement",
    confDuree: "Tout est effacé 90 jours après l'expiration du lien. Pour un effacement immédiat :",
    confEcrire: "nous écrire",
    confMentions: "Mentions légales",
    confPolitique: "Politique de confidentialité",
  },
  en: {
    pour: (d: string) => `For ${d}`,
    misAJourA: (h: string) => `updated at ${h}`,
    misAJourLe: (d: string) => `updated on ${d}`,
    lienPrive: "Private link · Getgents",
    confidentialite: "Privacy",
    vous: "You:",
    changer: "Change",
    choisirLangue: "Page language",
    poserQuestion: "Ask a question",
    ouvrirAssistant: "Open the document assistant",
    bulleTitre: "A question about this document?",
    bulleTexte: "The assistant answers from the document.",
    masquer: "Hide",
    fermer: "Close",
    reponseEnvoyee: "✓ Reply sent to the author",
    merci: "Thank you, your reply has been sent to the author.",
    vosChoix: "Your choices in the page",
    decochez: "Untick anything you don't want to send.",
    unMot: "A note for the author (optional)",
    joindreTitre: "Attach my reading of the page",
    joindreTexte: "When I opened it, for how long, how far, on which device. For this link only.",
    annuler: "Cancel",
    envoyer: "Send",
    envoi: "Sending…",
    reponseEchec: "Your reply couldn't be sent. Try again.",
    connexionImpossible: "Connection failed. Try again.",
    mention: (destinataire: string | null, avecChoix: boolean, avecLecture: boolean) => {
      const p = [destinataire ? `your name (${destinataire})` : "your name"];
      if (avecChoix) p.push("the choices ticked above");
      if (avecLecture) p.push("your reading of the page");
      return `Your reply will be sent to the author, with ${listeEn(p)}. Nothing else is sent.`;
    },
    quiTitre: "Who are you?",
    quiTexte: "Pick your name: your reply will be sent to the author under this name.",
    dejaRepondu: "has replied",
    quiPied: "Not on the list? Ask the author to add you. Your choice is remembered on this device; “Change” in the top bar.",
    assistantNom: "Document assistant",
    assistantSous: "Your questions about this document",
    assistantBonjour: "Hello, I can help you read this document: ask me a question.",
    assistantSaisie: "Ask a question about this document…",
    assistantVide: "The assistant gave no answer. Try rephrasing your question.",
    assistantEchec: "The assistant couldn't answer.",
    assistantMention: "AI-generated answers: they can be wrong and don't commit the author.",
    agrandir: "Expand",
    reduire: "Shrink",
    fermerAssistant: "Close the assistant",
    porteSansAdresseTitre: "This page is protected",
    porteSansAdresseTexte: "This link isn't tied to any e-mail address, so we can't send you a code. Ask the person who sent it for a new link.",
    porteIndispoTitre: "Page temporarily unavailable",
    porteIndispoTexte: "The access check isn't responding. Try again in a few minutes.",
    porteTitre: "This page is for you",
    porteTexte: (masque: string) => `To open it, confirm you are its recipient: we'll send a code to ${masque}.`,
    recevoirCode: "Get my code",
    pasVotreAdresse: "Not your address? Ask the person who sent you this link for a new one.",
    saisirTitre: "Enter your code",
    envoyeA: (masque: string) => `Sent to ${masque}. It's valid for 10 minutes.`,
    codeSixChiffres: "6-digit code",
    verification: "Checking…",
    ouvrirPage: "Open the page",
    rienRecu: "Nothing received? Check your spam, or",
    renvoyer: "resend the code",
    souvenir: "Once verified, this browser remembers it for 30 days.",
    codeNonEnvoye: "The code couldn't be sent.",
    codeRefuse: "Code rejected.",
    reference: "ref.",
    confTitre: "Your data on this page",
    confSousAuteur: (titre: string, auteur: string) => `“${titre}” · author: ${auteur}, who sent it to you through Getgents.`,
    confSous: (titre: string) => `“${titre}”, sent through Getgents.`,
    confToujours: "Always, without your name",
    confOuvertures: "How many times the page was opened, without saying by whom.",
    confQuestions: "Questions asked to the assistant, without your name or your link, dated by day only. The author uses them to improve the page.",
    confSiReponse: "Only if you reply",
    confReponse: "If the author offers a reply button and you click it: your name, the choices you leave ticked and your note, shown before sending.",
    confLecture: "Your reading of this visit (when, for how long, how far, computer or phone), only if you tick “Attach my reading of the page”. It is measured in the page and leaves it in no other way.",
    confJamais: "Never",
    confLocalisation: "No location.",
    confHors: "Nothing you do outside this page.",
    confPrenom: "On a group link, the name you pick stays on this device; it is only sent with your reply.",
    confPub: "No advertising, no reselling.",
    confIaTitre: "The assistant's answers",
    confIa: "They are generated by AI from the content of this page. They can be wrong and don't commit the author.",
    confQuiTitre: "Who processes this data",
    confQui: "Getgents hosts the page and the assistant. To answer, your question and the page text are sent to an AI model provider.",
    confCodeTitre: "Code-protected page",
    confCode: "The author sees that the code sent to your address was verified, and when: that's what protects the page.",
    confDureeTitre: "Retention and deletion",
    confDuree: "Everything is deleted 90 days after the link expires. For immediate deletion:",
    confEcrire: "write to us",
    confMentions: "Legal notice (in French)",
    confPolitique: "Privacy policy (in French)",
  },
} as const;

export type TextesLecteur = (typeof TEXTES)["fr"];

export function textes(langue: Langue): TextesLecteur {
  return TEXTES[langue] as unknown as TextesLecteur;
}

/**
 * Messages que les routes du lecteur renvoient en français : leur version
 * anglaise. Un message absent de la table reste en français (jamais vide).
 */
const MESSAGES_EN: Record<string, string> = {
  "Ce lien n'existe pas ou a expiré.": "This link doesn't exist or has expired.",
  "Accès protégé : validez votre code.": "Protected page: verify your code.",
  "Accès protégé : validez votre code sur la page du lien.": "Protected page: verify your code on the link's page.",
  "Cette page n'est pas protégée.": "This page isn't protected.",
  "Code incorrect. Demandez un nouveau code.": "Wrong code. Ask for a new one.",
  "Ce code a expiré : demandez-en un nouveau.": "This code has expired: ask for a new one.",
  "Ce lien n'a pas d'adresse e-mail : demandez-en un nouveau.": "This link has no e-mail address: ask for a new one.",
  "Demandez d'abord un code.": "Ask for a code first.",
  "Le code n'a pas pu être envoyé. Réessayez dans un instant.": "The code couldn't be sent. Try again in a moment.",
  "Le code n'a pas pu être envoyé. Réessayez.": "The code couldn't be sent. Try again.",
  "Trop d'essais : demandez un nouveau code.": "Too many attempts: ask for a new code.",
  "Trop de codes demandés pour ce lien. Demandez-en un nouveau à la personne qui vous l'a envoyé.":
    "Too many codes requested for this link. Ask the person who sent it for a new one.",
  "Le code compte 6 chiffres.": "The code has 6 digits.",
  "La vérification a échoué. Réessayez.": "Verification failed. Try again.",
  "Service momentanément indisponible.": "Service temporarily unavailable.",
  "Service momentanément indisponible. Réessayez.": "Service temporarily unavailable. Try again.",
  "Choisissez votre prénom dans la liste.": "Pick your name from the list.",
  "L'auteur ne propose pas de réponse sur cette page.": "The author doesn't offer a reply on this page.",
  "Votre mot est trop long (500 caractères au plus).": "Your note is too long (500 characters at most).",
  "Votre réponse n'a pas pu être envoyée. Réessayez.": "Your reply couldn't be sent. Try again.",
  "Vous avez déjà répondu sur ce lien.": "You have already replied on this link.",
  "Vous êtes l'auteur de cette page : votre réponse n'est pas enregistrée. Ouvrez le lien en navigation privée pour essayer.":
    "You are the author of this page: your reply isn't recorded. Open the link in a private window to try it.",
  "L'assistant n'est pas activé sur ce document.": "The assistant isn't enabled on this document.",
  "Question vide.": "Empty question.",
  "L'assistant a répondu au nombre maximal de questions pour ce document. Posez vos questions à la personne qui vous l'a partagé.":
    "The assistant has answered the maximum number of questions for this document. Ask the person who shared it with you.",
  "L'assistant de cette page fait une pause jusqu'au début du mois prochain. Le document reste consultable.":
    "This page's assistant is taking a break until the start of next month. The document is still readable.",
  "L'assistant de cette page fait une pause. Le document reste consultable ; pour vos questions, adressez-vous à la personne qui vous l'a partagé.":
    "This page's assistant is taking a break. The document is still readable; for your questions, ask the person who shared it with you.",
  "L'assistant est momentanément indisponible. Le document reste consultable ; réessayez plus tard.":
    "The assistant is temporarily unavailable. The document is still readable; try again later.",
  "L'assistant n'a pas pu répondre. Réessayez dans un instant.": "The assistant couldn't answer. Try again in a moment.",
  "L'assistant reçoit trop de demandes en même temps. Réessayez dans quelques instants.":
    "The assistant is receiving too many requests at once. Try again in a few moments.",
};

const MOTIFS_EN: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^Un code vient de partir\. Attendez (\d+) s avant d'en redemander un\.$/, (m) => `A code was just sent. Wait ${m[1]} s before asking for another.`],
  [/^(.+) a déjà répondu\.$/, (m) => `${m[1]} has already replied.`],
];

/** Un message d'une route du lecteur, dans sa langue. */
export function messageLecteur(fr: string, langue: Langue): string {
  if (langue === "fr") return fr;
  if (MESSAGES_EN[fr]) return MESSAGES_EN[fr];
  for (const [re, f] of MOTIFS_EN) {
    const m = re.exec(fr);
    if (m) return f(m);
  }
  return fr;
}

/** Questions suggérées par défaut (sans choix de l'auteur). */
export function amorcesParDefaut(svg: boolean, langue: Langue): string[] {
  if (langue === "en")
    return svg ? ["What does this diagram show?", "What are the main elements?"] : ["Summarise this document", "What are the key points?", "What is being asked of me?"];
  return svg ? ["Que représente ce schéma ?", "Quels sont les éléments principaux ?"] : ["Résume ce document", "Quels sont les points clés ?", "Qu'est-ce qui m'est demandé ?"];
}

/** E-mail du code d'accès, dans la langue du lecteur. */
export function mailCodeTextes(langue: Langue): { objet: (titre: string) => string; intro: string; validite: string } {
  return langue === "en"
    ? {
        objet: (titre) => `Your code to open “${titre}”`,
        intro: "Here is your code to open",
        validite: "It's valid for 10 minutes. If you didn't ask for it, just ignore this e-mail.",
      }
    : {
        objet: (titre) => `Votre code pour ouvrir « ${titre} »`,
        intro: "Voici votre code pour ouvrir",
        validite: "Il est valable 10 minutes. Si vous n'avez rien demandé, ignorez simplement cet e-mail.",
      };
}

/** Modèle de mail que rend le connecteur : bonjour, phrase, signature. */
export function modeleMailTextes(langue: Langue): { bonjour: (nom: string | null) => string; phrase: string; signature: string } {
  return langue === "en"
    ? { bonjour: (n) => (n ? `Hi ${n},` : "Hello,"), phrase: "As discussed, here is the document prepared for you:", signature: "Best regards," }
    : { bonjour: (n) => (n ? `Bonjour ${n},` : "Bonjour,"), phrase: "Comme convenu, voici le document préparé pour vous :", signature: "Bonne lecture," };
}

/** Intitulés suggérés du bouton de réponse, dans la langue des lecteurs de la page. */
export const INTITULES_SUGGERES_EN = ["Confirm my choices", "I'm interested", "Book a call", "I'd like to proceed", "I'm in"];
