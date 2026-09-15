/**
 * Signalement d'incident par un utilisateur d'un gent partagé ou publié.
 *
 * Un gent diffusé est utilisé par des gens qui n'ont aucun moyen de joindre
 * son créateur : ni compte, ni adresse, ni bouton. Quand la réponse est à côté
 * de la plaque ou que la conversation refuse de fonctionner, ils partent, et
 * le créateur ne l'apprend jamais. Ce module donne le chemin de retour.
 *
 * Deux questions seulement, et c'est délibéré : un formulaire long ne se
 * remplit pas au moment où l'on est agacé, c'est-à-dire précisément le moment
 * où l'on aurait quelque chose à dire.
 *
 * Module PUR — testable.
 */

export const APPRECIATION = ["oui", "non"] as const;
export type Appreciation = (typeof APPRECIATION)[number];

export const MOTIFS = [
  { id: "resultat", label: "Résultat non pertinent" },
  { id: "conversation", label: "Impossibilité d'utiliser le module conversationnel" },
  { id: "anomalie", label: "Signalement d'un bug ou d'une anomalie" },
] as const;

export type MotifId = (typeof MOTIFS)[number]["id"];

/** Le motif « anomalie » attend une description : sans elle il n'est pas exploitable. */
export const MOTIF_EXIGEANT_PRECISION: MotifId = "anomalie";

export const PRECISION_MAX = 1000;

export interface Signalement {
  appreciation: Appreciation | null;
  motif: MotifId | null;
  precision: string;
}

export type SignalementErreur = "vide" | "precision-manquante" | "precision-trop-longue";

/**
 * Valide un signalement. `null` = recevable.
 *
 * Un signalement entièrement vide est refusé : il n'apprend rien et
 * encombrerait la boîte du créateur, qui cesserait alors de les lire.
 * Répondre à UNE des deux questions suffit en revanche — exiger les deux
 * ferait perdre les retours de qui ne veut répondre qu'à l'une.
 */
export function validerSignalement(s: Signalement): SignalementErreur | null {
  const precision = s.precision.trim();

  if (!s.appreciation && !s.motif && !precision) return "vide";

  // « Bug ou anomalie » sans description est inexploitable : le créateur
  // recevrait « il y a un bug » sans savoir lequel, ni quoi en faire.
  if (s.motif === MOTIF_EXIGEANT_PRECISION && !precision) return "precision-manquante";

  if (precision.length > PRECISION_MAX) return "precision-trop-longue";

  return null;
}

export const MESSAGE_SIGNALEMENT: Record<SignalementErreur, string> = {
  vide: "Répondez à au moins une question, ou décrivez ce qui s'est passé.",
  "precision-manquante":
    "Décrivez l'anomalie en quelques mots : sans cela, elle ne pourra pas être corrigée.",
  "precision-trop-longue": `Votre description dépasse ${PRECISION_MAX} caractères.`,
};

export function libelleMotif(id: MotifId | null): string {
  return MOTIFS.find((m) => m.id === id)?.label ?? "Non précisé";
}

/**
 * Corps de l'e-mail envoyé au créateur.
 *
 * Le sujet porte le nom du gent : une boîte de réception qui reçoit
 * « Signalement » dix fois ne permet pas de trier. Le texte libre est échappé —
 * il vient d'un inconnu et atterrit dans un e-mail HTML.
 */
export function corpsEmailSignalement(input: {
  nomGent: string;
  signalement: Signalement;
  lien?: string | null;
}): string {
  const s = input.signalement;
  const lignes = [
    `<p>Un utilisateur de <b>${echapper(input.nomGent)}</b> vous signale quelque chose.</p>`,
    "<ul>",
    `<li><b>Apprécie ce service</b> : ${s.appreciation ? s.appreciation.toUpperCase() : "sans réponse"}</li>`,
    `<li><b>Problème rencontré</b> : ${echapper(libelleMotif(s.motif))}</li>`,
    "</ul>",
  ];

  const precision = s.precision.trim();
  if (precision) {
    lignes.push(`<p><b>Précisions</b></p><blockquote>${echapper(precision)}</blockquote>`);
  }

  if (input.lien) {
    lignes.push(`<p><a href="${echapper(input.lien)}">Ouvrir le gent</a></p>`);
  }

  lignes.push(
    "<p style=\"color:#666;font-size:12px\">Ce message est envoyé automatiquement " +
      "par Getgents. L'auteur du signalement n'est pas identifié : il n'a pas de compte, " +
      "et rien ne permet de lui répondre.</p>"
  );

  return lignes.join("\n");
}

export function sujetEmailSignalement(nomGent: string): string {
  return `Signalement sur « ${nomGent} »`;
}

/** Échappement HTML. Le texte vient d'un inconnu et part dans un e-mail. */
function echapper(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
