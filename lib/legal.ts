/**
 * Identité de l'éditeur, et sous-traitants réellement utilisés.
 *
 * Ces informations existent pour deux raisons, et la seconde est la moins
 * évidente :
 *
 *   1. la loi — un service en ligne doit dire qui l'édite et qui l'héberge ;
 *   2. la RÉPUTATION RÉSEAU. Un domaine récent, sans page d'éditeur ni
 *      politique de confidentialité, mais avec un formulaire de connexion,
 *      correspond au profil que les filtres d'entreprise et de wifi public
 *      bloquent par défaut. C'est ce qui est arrivé à getgents.ai sur le
 *      réseau d'un train. Les catégoriseurs (Talos, Zscaler, Fortinet…)
 *      regardent précisément ces pages quand on leur soumet un domaine.
 *
 * Un seul endroit pour tout : ces mentions apparaissent sur quatre pages, et
 * trois versions divergentes valent moins que pas de mention du tout.
 *
 * Module PUR — testable.
 */

export const EDITEUR = {
  /**
   * Getgents est édité par une PERSONNE PHYSIQUE, à titre non professionnel.
   *
   * Ces pages ont d'abord annoncé « Raison sociale : The G Company ». C'était
   * inexact : la société n'existe pas. Une mention légale fausse est pire
   * qu'une mention incomplète — elle est vérifiable, et un service de
   * catégorisation qui cherche une société introuvable au registre en tire la
   * conclusion inverse de celle qu'on recherchait.
   *
   * L'article 6 III de la LCEN prévoit ce cas : un éditeur non professionnel
   * peut ne rendre publique que l'identité de son hébergeur, à condition de
   * lui avoir communiqué la sienne. C'est le régime retenu ici — d'où une
   * identité d'éditeur donnée, mais pas d'adresse postale privée.
   *
   * À REVOIR le jour où une société est immatriculée, ou dès que le service
   * encaisse des paiements : le régime professionnel s'applique alors, et
   * exige l'adresse du siège et le numéro d'immatriculation.
   */
  nom: "Charles de Cassan",
  /** Nature de l'édition, dite explicitement plutôt que laissée à deviner. */
  qualite: "Éditeur personne physique — projet personnel, édition non professionnelle",
  directeurPublication: "Charles de Cassan",
  /**
   * Contact public. `getgents.ai` et non `.com` : c'est le domaine dont vous
   * êtes propriétaire, dont le DNS porte les enregistrements de messagerie
   * (MX, SPF, DKIM, DMARC), et celui déjà annoncé sur l'écran d'accès
   * restreint. Un `.com` non configuré donnerait des mentions légales
   * pointant vers une boîte morte.
   */
  contact: "ceo@getgents.ai",
  /**
   * Adresse postale : volontairement absente, et c'est LÉGAL ici.
   *
   * Sous le régime non professionnel, elle est communiquée à l'hébergeur et
   * non au public. Ce n'est donc plus un trou à combler, comme ce l'était
   * tant que ces pages annonçaient une société.
   */
  adressePostale: null as string | null,
  /** Immatriculation : aucune, il n'y a pas de société. */
  immatriculation: null as string | null,
} as const;

export const HEBERGEURS = [
  {
    nom: "Vercel Inc.",
    role: "Hébergement de l'application",
    adresse: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
    site: "https://vercel.com",
  },
  {
    nom: "Supabase Inc.",
    role: "Base de données, comptes et authentification",
    adresse: "970 Toa Payoh North, Singapour",
    site: "https://supabase.com",
  },
] as const;

export interface SousTraitant {
  nom: string;
  role: string;
  /** Ce qui lui est réellement transmis — pas une catégorie vague. */
  donnees: string;
  /** `true` si le service n'intervient que sur choix explicite du créateur. */
  optionnel: boolean;
}

/**
 * Sous-traitants CONSTATÉS dans le code, pas supposés.
 *
 * Une politique de confidentialité qui liste des services qu'on n'utilise pas,
 * ou qui en tait un, est fausse dans les deux sens. Chaque entrée correspond à
 * un appel réel : lib/server/*.ts.
 */
export const SOUS_TRAITANTS: readonly SousTraitant[] = [
  {
    nom: "OpenRouter",
    role: "Accès aux modèles de langage",
    donnees: "Le contenu des conversations et des documents soumis au gent.",
    optionnel: false,
  },
  {
    nom: "Brevo",
    role: "Envoi des e-mails de partage et de notification",
    donnees: "Adresse e-mail du destinataire et contenu du message.",
    optionnel: false,
  },
  {
    nom: "Cloudflare Turnstile",
    role: "Vérification anti-robot sur le formulaire de téléchargement",
    donnees: "Signaux techniques du navigateur, sans identification.",
    optionnel: true,
  },
  {
    nom: "Google",
    role: "Connecteur Gmail",
    donnees: "Jetons d'accès à la boîte mail, si le créateur connecte un compte.",
    optionnel: true,
  },
  {
    nom: "Meta (WhatsApp Business)",
    role: "Diffusion d'un gent par messagerie",
    donnees: "Numéro de téléphone et contenu des messages échangés.",
    optionnel: true,
  },
  {
    nom: "Powens",
    role: "Connecteur bancaire, en environnement de test",
    donnees: "Données de comptes de démonstration uniquement.",
    optionnel: true,
  },
] as const;

/** Date de dernière révision des textes légaux, affichée en pied de page. */
export const DERNIERE_REVISION = "8 septembre 2026";

/**
 * Contenu de `/.well-known/security.txt` (RFC 9116).
 *
 * Peu de gens le lisent, mais les outils de catégorisation et les chercheurs
 * en sécurité le cherchent : sa présence distingue un service tenu par
 * quelqu'un d'un domaine abandonné.
 */
export function securityTxt(base: string, expiration: string): string {
  return [
    `Contact: mailto:${EDITEUR.contact}`,
    `Expires: ${expiration}`,
    "Preferred-Languages: fr, en",
    `Canonical: ${base.replace(/\/+$/, "")}/.well-known/security.txt`,
    "",
  ].join("\n");
}
