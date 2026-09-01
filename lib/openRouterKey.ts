/**
 * Clé OpenRouter personnelle — la partie qui ne dépend ni du réseau ni de la
 * base, donc la partie testable.
 *
 * Jusqu'ici la plateforme payait TOUTES les générations de tout le monde.
 * Au moment d'ouvrir les inscriptions, c'est un robinet ouvert. Un builder
 * peut désormais brancher sa propre clé : il paie ses appels, et n'est plus
 * borné par les plafonds destinés à protéger la clé commune.
 *
 * Module PUR.
 */

/** Qui paie l'appel en cours. */
export type SourceDeCle = "personnelle" | "plateforme";

/**
 * Les quatre derniers caractères, pour que le builder reconnaisse SA clé sans
 * qu'on la lui réaffiche. Une clé enregistrée ne ressort jamais de la base :
 * l'indice est tout ce que la page reçoit.
 */
export function indiceDeCle(cle: string): string {
  const propre = cle.trim();
  if (propre.length < 4) return "…";
  return `…${propre.slice(-4)}`;
}

/**
 * Refus immédiat des saisies qui ne peuvent pas être une clé OpenRouter :
 * une adresse e-mail collée par mégarde, un jeton d'un autre service, une
 * valeur tronquée. Volontairement permissif sur la longueur exacte — le
 * format d'OpenRouter peut changer, et c'est l'appel de test qui tranche.
 */
export function cleOpenRouterPlausible(valeur: unknown): valeur is string {
  if (typeof valeur !== "string") return false;
  const v = valeur.trim();
  if (/\s/.test(v)) return false;
  if (!v.startsWith("sk-or-")) return false;
  return v.length >= 20 && v.length <= 400;
}

export interface DiagnosticCle {
  source: SourceDeCle;
  /** Statut HTTP renvoyé par OpenRouter, ou 0 si l'appel n'a pas abouti. */
  status: number;
}

/**
 * Message destiné au BUILDER, pas au développeur.
 *
 * L'ancien message parlait de `.env.local` et de `npm run dev` : sur une
 * plateforme ouverte, la personne qui le lit n'a ni fichier ni terminal. Elle
 * a besoin de savoir quoi faire, et où.
 */
export function messageCleOpenRouter({ source, status }: DiagnosticCle): string {
  if (source === "personnelle") {
    if (status === 401 || status === 403) {
      return (
        "Votre clé OpenRouter a été refusée. Vérifiez-la dans Mon compte : " +
        "elle a peut-être été révoquée depuis openrouter.ai."
      );
    }
    if (status === 402) {
      return (
        "Votre compte OpenRouter n'a plus de crédit. Rechargez-le sur openrouter.ai, " +
        "puis relancez la génération."
      );
    }
    if (status === 429) {
      return "OpenRouter limite momentanément votre compte. Réessayez dans quelques instants.";
    }
    return "La génération a échoué du côté d'OpenRouter. Réessayez dans quelques instants.";
  }

  // Clé plateforme : le détail part dans les journaux, pas à l'écran. Dire
  // « la clé du serveur est invalide » à un visiteur ne lui apprend rien
  // d'utile et renseigne l'inverse de ce qu'on voudrait.
  if (status === 0) {
    return (
      "Le service de génération n'est pas disponible pour le moment. " +
      "Vous pouvez brancher votre propre clé OpenRouter depuis Mon compte."
    );
  }
  return "La génération a échoué. Réessayez dans quelques instants.";
}

/** Message destiné à un VISITEUR d'un gent partagé ou public. */
export const MESSAGE_VISITEUR_INDISPONIBLE =
  "Ce gent est temporairement indisponible. Revenez un peu plus tard.";

/**
 * Le quota ne s'applique qu'à la clé commune. Un builder qui paie ses propres
 * appels n'a aucune raison d'être bridé : le plafond protège une dépense qui
 * n'est plus la nôtre.
 */
export function quotaApplicable(source: SourceDeCle): boolean {
  return source === "plateforme";
}
