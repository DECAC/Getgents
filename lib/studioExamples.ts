/**
 * Exemples de gents proposés sur l'accueil du Gent' studio.
 *
 * Chaque exemple est une DESCRIPTION DE RÔLE, écrite comme un créateur
 * l'écrirait dans le champ unique : la cliquer revient à l'avoir tapée. Le
 * catalogue existe surtout pour montrer ce que la plateforme sait déjà faire —
 * un créateur qui ouvre le studio pour la première fois ne peut pas deviner
 * qu'un gent peut lire une boîte Gmail, tourner chaque matin ou diffuser sur
 * WhatsApp. Toute capacité livrée doit donc apparaître dans au moins un
 * exemple (garanti par __tests__/studioExamples.test.ts).
 */

/** Capacités déjà implémentées, telles qu'un créateur les perçoit. */
export type StudioCapability =
  | "connexion"
  | "planification"
  | "diffusion"
  | "connaissances"
  | "web"
  | "image"
  | "video"
  | "artefacts"
  | "carte"
  | "miniapp"
  | "visionneuse"
  | "formulaire";

export const STUDIO_CAPABILITY_LABEL: Record<StudioCapability, string> = {
  connexion: "Connexion",
  planification: "Planification",
  diffusion: "Diffusion",
  connaissances: "Connaissances",
  web: "Recherche web",
  image: "Image",
  video: "Vidéo",
  artefacts: "Artefacts",
  carte: "Carte",
  miniapp: "Mini-app",
  visionneuse: "Visionneuse",
  formulaire: "Formulaire",
};

export const STUDIO_CAPABILITIES = Object.keys(STUDIO_CAPABILITY_LABEL) as StudioCapability[];

/** Onglets du studio où l'on peut atterrir depuis l'accueil. */
export type StudioCreationTab = "conversationnel" | "miniapp" | "visionneuse";

export interface StudioExample {
  id: string;
  icon: string;
  title: string;
  /** Description du rôle, injectée telle quelle dans l'échange avec l'assistant. */
  prompt: string;
  capabilities: StudioCapability[];
  /** Onglet le mieux adapté à ce type de gent (conversationnel par défaut). */
  tab?: StudioCreationTab;
}

export const STUDIO_EXAMPLES: StudioExample[] = [
  {
    id: "email",
    icon: "📧",
    title: "Assistant email prudent",
    prompt:
      "Un gent connecté à ma boîte Gmail : il repère les emails importants, me prépare des brouillons de réponse et n'envoie jamais rien sans ma validation explicite.",
    capabilities: ["connexion", "diffusion"],
  },
  {
    id: "veille",
    icon: "🗞️",
    title: "Veille de 8 h",
    prompt:
      "Un gent qui fait chaque matin à 8 h une veille web sur mon secteur d'activité et m'envoie une synthèse courte sur WhatsApp.",
    capabilities: ["planification", "web", "diffusion"],
  },
  {
    id: "video",
    icon: "🎬",
    title: "Analyste de vidéos",
    prompt:
      "Un gent à qui j'envoie une vidéo : il l'analyse image par image, me décrit ce qu'elle montre et en tire un compte rendu écrit.",
    capabilities: ["video", "artefacts"],
  },
  {
    id: "transports",
    icon: "🚇",
    title: "Copilote transports",
    prompt:
      "Un gent qui connaît les transports en Île-de-France : il trouve les arrêts autour de moi, donne les prochains départs et les situe sur une carte.",
    capabilities: ["connexion", "carte"],
  },
  {
    id: "budget",
    icon: "💳",
    title: "Suivi de budget",
    prompt:
      "Un gent connecté à mes comptes bancaires qui classe mes dépenses par poste et m'affiche un tableau de bord mensuel avec des graphiques.",
    capabilities: ["connexion", "artefacts", "miniapp"],
  },
  {
    id: "documents",
    icon: "📚",
    title: "Expert de mes documents",
    prompt:
      "Un gent qui connaît mes documents internes — procédures, contrats, notes — et répond aux questions de mon équipe en citant ses sources.",
    capabilities: ["connaissances", "diffusion"],
  },
  {
    id: "lecteur",
    icon: "📖",
    title: "Lecteur de document",
    prompt:
      "Un gent construit autour d'un seul document long, lu en plein écran, avec un assistant qui l'explique section par section.",
    capabilities: ["visionneuse", "connaissances"],
    tab: "visionneuse",
  },
  {
    id: "opendata",
    icon: "📊",
    title: "Tableau de bord open data",
    prompt:
      "Un gent branché sur un jeu de données ouvert, qui affiche dès l'ouverture un tableau de bord que l'utilisateur peut relancer avec ses propres critères.",
    capabilities: ["connexion", "miniapp", "artefacts"],
    tab: "miniapp",
  },
  {
    id: "accueil-client",
    icon: "🎯",
    title: "Guide d'accueil client",
    prompt:
      "Un gent que je diffuse par lien à mes clients : il commence par un court formulaire de trois questions, puis les guide pas à pas en illustrant ses réponses avec des images.",
    capabilities: ["formulaire", "diffusion", "image"],
  },
  {
    id: "api-metier",
    icon: "🔌",
    title: "Assistant métier sur mesure",
    prompt:
      "Un gent branché sur l'API interne de mon entreprise, via un connecteur REST ou un serveur MCP, pour interroger nos données métier en langage naturel.",
    capabilities: ["connexion", "artefacts"],
  },
];

/** Capacités effectivement illustrées par au moins un exemple. */
export function illustratedCapabilities(examples: StudioExample[] = STUDIO_EXAMPLES): StudioCapability[] {
  const seen = new Set<StudioCapability>();
  for (const example of examples) {
    for (const capability of example.capabilities) seen.add(capability);
  }
  return STUDIO_CAPABILITIES.filter((c) => seen.has(c));
}

/** Onglet d'atterrissage d'un exemple. */
export function exampleTab(example: StudioExample): StudioCreationTab {
  return example.tab ?? "conversationnel";
}
