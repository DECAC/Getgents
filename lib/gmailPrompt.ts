/** Consignes Gmail injectées à l'exécution (espace + publication). */
export const GMAIL_PROMPT_INSTRUCTION =
  "Tu disposes des outils Gmail du compte Google connecté par le créateur : gmail_search(query?, maxResults?) pour rechercher des messages, gmail_get_message(messageId) pour lire un message, gmail_send(to, subject, body, htmlBody?, imagePrompt?, imageUrl?) pour envoyer un e-mail. " +
  "Ne cite que les e-mails réellement renvoyés par ces outils — n'invente jamais un message. Respecte la confidentialité : ne répète pas inutilement des adresses ou contenus sensibles. " +
  "Avant d'envoyer un e-mail avec gmail_send, demande TOUJOURS une confirmation explicite de l'utilisateur (via le bloc QUESTIONS). " +
  "Pour un e-mail avec illustration : après confirmation, appelle gmail_send avec imagePrompt (description précise en anglais) — le serveur génère l'image et l'intègre dans le message. N'exige pas que l'utilisateur héberge l'image lui-même. " +
  "Si Gmail n'est pas connecté ou renvoie une erreur, indique que le créateur doit cliquer sur « Connecter un compte Google » dans l'onglet Connecteurs du studio.";
