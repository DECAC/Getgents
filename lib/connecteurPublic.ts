/**
 * Ce que Getgents dit PUBLIQUEMENT de son connecteur MCP : page `/aide/connecteur`,
 * `llms.txt`, fiche du registre (`server.json`) et fiches d'annuaires
 * (`docs/annuaires.md`). Une seule source, pour que l'annuaire, la page d'aide
 * et ce que lit une IA ne se contredisent pas. Module PUR.
 *
 * Positionnement (23/11) : pas « publier » — Claude publie déjà un artefact
 * par lien public. Getgents se place sur ce que la publication intégrée ne
 * fait pas : un lien PRIVÉ par destinataire, la réponse du lecteur, un
 * assistant sur la page, savoir qui a répondu.
 */

export const ADRESSE_MCP = "https://getgents.ai/api/mcp";

/** Nom dans le registre MCP officiel : domaine getgents.ai à l'envers (preuve HTTP). */
export const NOM_REGISTRE = "ai.getgents/pages";

/** 100 caractères au plus (schéma du registre). */
export const DESCRIPTION_REGISTRE =
  "Send an AI artifact privately: one link per recipient, their reply and choices, a Q&A assistant.";

export const RESUME_FR =
  "Envoyez un artefact Claude (ou un canvas) à un client, une équipe ou un groupe par un lien privé : " +
  "chaque destinataire a son lien, peut vous répondre en un clic et poser ses questions à un assistant qui lit la page.";

export const RESUME_EN =
  "Send a Claude artifact (or a canvas) to a client, a team or a group through a private link: " +
  "each recipient gets their own link, can reply in one click and ask questions to an assistant that reads the page.";

export interface OutilPublic {
  nom: string;
  titre: string;
  role: string;
  nature: "écrit" | "lecture seule" | "destructeur";
}

export const OUTILS_PUBLICS: readonly OutilPublic[] = [
  {
    nom: "partager_page",
    titre: "Partager une page avec un client",
    role: "Enregistre la page et rend un lien privé pour un destinataire, avec le mail à envoyer. Getgents n'envoie aucun e-mail.",
    nature: "écrit",
  },
  {
    nom: "mettre_a_jour_page",
    titre: "Mettre à jour une page partagée",
    role: "Remplace le contenu d'une page : tous ses liens montrent la nouvelle version, l'ancienne reste restaurable. Claude demande confirmation.",
    nature: "destructeur",
  },
  {
    nom: "lister_partages",
    titre: "Lister mes partages",
    role: "Liste vos liens : titre, destinataire, date, statut.",
    nature: "lecture seule",
  },
  {
    nom: "revoquer_partage",
    titre: "Révoquer un partage",
    role: "Coupe un lien : son destinataire ne peut plus ouvrir la page. Irréversible.",
    nature: "destructeur",
  },
];

/** Exemples de demandes, tels qu'on les écrit à Claude. */
export const EXEMPLES_DEMANDES = [
  "Partage cette page à marie@acme.fr",
  "Envoie ce devis à Paul, avec l'assistant pour qu'il pose ses questions",
  "Mets à jour la page envoyée à Marie avec cette nouvelle version",
  "Quels liens ai-je envoyés cette semaine ?",
  "Coupe le lien envoyé à Paul",
];
