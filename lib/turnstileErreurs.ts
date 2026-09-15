/**
 * Codes d'erreur du widget Turnstile, traduits pour un humain.
 *
 * L'échec était muet : le `error-callback` effaçait le jeton et rien d'autre.
 * Le visiteur voyait un formulaire qui refusait de partir sans dire pourquoi,
 * et nous n'avions aucun moyen de distinguer un widget mal configuré d'un
 * réseau coupé — deux pannes qui ne se réparent pas au même endroit.
 *
 * Le code le plus important est `110200` : il signifie que le domaine d'où
 * vient la page ne figure pas dans la liste autorisée de la clé de site. C'est
 * exactement ce qui arrive après un changement de domaine — la clé était
 * déclarée pour l'ancien.
 *
 * Référence : developers.cloudflare.com/turnstile/troubleshooting/client-side-errors
 *
 * Module PUR — testable.
 */

export interface DiagnosticTurnstile {
  /** Ce qu'on montre au visiteur : jamais un code brut. */
  message: string;
  /** Vrai si le problème vient de NOTRE configuration, pas du visiteur. */
  cotePlateforme: boolean;
}

const MESSAGE_GENERIQUE =
  "La vérification anti-robot n'a pas pu se charger. Réessayez, ou écrivez-nous si cela persiste.";

export function diagnostiquerTurnstile(code: unknown): DiagnosticTurnstile {
  const brut = typeof code === "string" ? code.trim() : "";

  // 110200 : domaine non autorisé pour cette clé de site. Le visiteur n'y peut
  // strictement rien, et lui demander de réessayer serait le faire tourner en
  // rond — la clé doit être corrigée chez Cloudflare.
  if (brut.startsWith("110200")) {
    return {
      message:
        "La vérification anti-robot n'est pas configurée pour ce domaine. " +
        "Le problème est de notre côté — écrivez-nous et nous vous enverrons le document.",
      cotePlateforme: true,
    };
  }

  // 1101xx : clé de site invalide ou absente. Également notre faute.
  if (/^1101\d\d/.test(brut)) {
    return {
      message:
        "La vérification anti-robot est mal configurée. Le problème est de notre côté — " +
        "écrivez-nous et nous vous enverrons le document.",
      cotePlateforme: true,
    };
  }

  // 300xxx / 600xxx : échec interne ou défi non résolu. Un nouvel essai a de
  // vraies chances d'aboutir.
  return { message: MESSAGE_GENERIQUE, cotePlateforme: false };
}

/**
 * Message quand le script lui-même n'arrive jamais.
 *
 * Distinct d'une erreur du widget : ici Cloudflare n'a pas répondu du tout —
 * réseau d'entreprise qui filtre, bloqueur de publicité, ou panne. Le dire
 * permet au visiteur de comprendre, plutôt que d'attendre devant un cadre vide.
 */
export const MESSAGE_SCRIPT_ABSENT =
  "La vérification anti-robot n'a pas pu être chargée depuis Cloudflare. " +
  "Un bloqueur ou un filtre réseau peut en être la cause.";

/** Au-delà, on cesse d'attendre le script et on le dit. */
export const DELAI_CHARGEMENT_MS = 12000;
