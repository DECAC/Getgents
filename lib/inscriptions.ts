/**
 * Ouverture des inscriptions.
 *
 * Getgents fonctionne en accès restreint : on n'ouvre pas la création de
 * compte au tout-venant tant que la plateforme n'est pas prête à l'absorber.
 *
 * ATTENTION — ce drapeau ne FERME rien à lui seul. La création de compte passe
 * par `supabase.auth.signUp`, appelé depuis le navigateur avec la clé
 * publiable : n'importe qui peut l'appeler depuis une console, sans jamais
 * voir notre formulaire. Ce que ce module fait, c'est rendre l'interface
 * honnête — expliquer plutôt que présenter un formulaire qui échouerait.
 *
 * La fermeture RÉELLE se règle chez Supabase :
 *   Authentication → Providers → Email → « Allow new users to sign up » décoché.
 *
 * Les deux vont ensemble. Le drapeau sans le réglage laisse la porte ouverte ;
 * le réglage sans le drapeau affiche un formulaire qui refuse sans expliquer.
 *
 * Module PUR — testable.
 */

export const INSCRIPTIONS_OUVERTES = false;

/** Où demander un accès. Une seule occurrence : elle changera un jour. */
export const ADRESSE_DEMANDE_ACCES = "CEO@getgents.ai";

export const TITRE_ACCES_RESTREINT = "Getgents est en accès restreint";

export const MESSAGE_ACCES_RESTREINT =
  "La création de compte n'est pas ouverte pour le moment : nous accueillons les " +
  "premiers créateurs un par un, le temps de faire mûrir la plateforme.";

export const INVITATION_DEMANDE_ACCES =
  "Écrivez-nous pour demander un accès, en disant en deux lignes ce que vous " +
  "aimeriez construire.";

/**
 * Lien `mailto` prérempli.
 *
 * L'objet est fixé pour que les demandes se retrouvent d'un coup d'œil dans
 * une boîte de réception, et le corps amorce la réponse à la seule question
 * qui compte — sans quoi la plupart des messages arrivent vides.
 */
export function lienDemandeAcces(): string {
  const objet = encodeURIComponent("Demande d'accès à Getgents");
  const corps = encodeURIComponent(
    "Bonjour,\n\nJ'aimerais accéder à Getgents.\n\n" +
      "Ce que je souhaite construire :\n\n"
  );
  return `mailto:${ADRESSE_DEMANDE_ACCES}?subject=${objet}&body=${corps}`;
}

/** Libellé des boutons qui menaient vers la création de compte. */
export function libelleAppelAction(): string {
  return INSCRIPTIONS_OUVERTES ? "Créer un compte" : "Demander un accès";
}
