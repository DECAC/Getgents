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

/**
 * INSCRIPTION LIBRE PLAFONNÉE (18/11, décision de l'éditeur) — distincte du
 * drapeau ci-dessus, qui reste FAUX : Supabase garde les inscriptions
 * publiques FERMÉES, et c'est le SERVEUR qui crée le compte
 * (`/api/inscription`, clé de service) après avoir vérifié le plafond. Ouvrir
 * Supabase laisserait créer des comptes par son API sans passer par lui.
 *
 * `INSCRIPTIONS_PLAFOND` (Vercel) : nombre de comptes créables par ce
 * formulaire. Absente, vide ou 0 = fermé, retour à la demande d'accès.
 */
export type EtatInscriptions =
  | { genre: "fermees" }
  | { genre: "ouvertes"; restantes: number; plafond: number }
  | { genre: "completes"; plafond: number };

export function lirePlafondInscriptions(brut: string | undefined | null): number | null {
  const n = Number.parseInt((brut ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100_000) : null;
}

export function etatDesInscriptions(plafond: number | null, comptesCrees: number): EtatInscriptions {
  if (!plafond) return { genre: "fermees" };
  if (comptesCrees >= plafond) return { genre: "completes", plafond };
  return { genre: "ouvertes", restantes: plafond - comptesCrees, plafond };
}

/** Où demander un accès. Une seule occurrence : elle changera un jour. */
export const ADRESSE_DEMANDE_ACCES = "CEO@getgents.ai";

export const TITRE_ACCES_RESTREINT = "Getgents Pages ouvre sur invitation";

export const MESSAGE_ACCES_RESTREINT =
  "La création de compte n'est pas ouverte pour le moment : nous accueillons les " +
  "premiers utilisateurs un par un, gratuitement, le temps de faire mûrir le service.";

export const INVITATION_DEMANDE_ACCES =
  "Demandez un accès en nous disant en deux lignes avec qui vous voulez partager, et quoi : " +
  "nous vous répondons par e-mail.";

/**
 * Lien `mailto` prérempli — SECOURS seulement (page Contact) : la demande
 * se fait par le formulaire de /inscription.
 *
 * L'objet est fixé pour que les demandes se retrouvent d'un coup d'œil dans
 * une boîte de réception, et le corps amorce la réponse à la seule question
 * qui compte — sans quoi la plupart des messages arrivent vides.
 */
export function lienDemandeAcces(): string {
  const objet = encodeURIComponent("Demande d'accès à Getgents");
  const corps = encodeURIComponent(
    "Bonjour,\n\nJ'aimerais accéder à Getgents.\n\n" +
      "Ce que je souhaite partager, et avec qui :\n\n"
  );
  return `mailto:${ADRESSE_DEMANDE_ACCES}?subject=${objet}&body=${corps}`;
}

/** Libellé des boutons qui menaient vers la création de compte. */
export function libelleAppelAction(etat: EtatInscriptions = { genre: "fermees" }): string {
  return INSCRIPTIONS_OUVERTES || etat.genre === "ouvertes" ? "Créer un compte" : "Demander un accès";
}

export const POUR_QUOI_MAX = 1500;

export interface DemandeInscription {
  email: string;
  motDePasse: string;
  /** Facultatif : « avec qui voulez-vous partager, et quoi ? ». */
  pourQuoi: string;
  /** Champ piège, invisible pour un humain. */
  piege: string;
}

/** Le premier problème d'une inscription, ou null. `robot` : accepter en silence. */
export function validerInscription(d: DemandeInscription, emailValide: RegExp, verifierMotDePasse: (m: string) => string | null): string | "robot" | null {
  if (d.piege.trim()) return "robot";
  if (!emailValide.test(d.email.trim())) return "Cette adresse e-mail ne semble pas valide.";
  const mdp = verifierMotDePasse(d.motDePasse);
  if (mdp) return mdp;
  if (d.pourQuoi.length > POUR_QUOI_MAX) return `Votre réponse dépasse ${POUR_QUOI_MAX} caractères : resserrez-la un peu.`;
  return null;
}

export const MESSAGE_INSCRIPTIONS_COMPLETES =
  "Les inscriptions sont momentanément fermées. Laissez votre adresse : nous vous écrirons dès qu'elles rouvrent.";
