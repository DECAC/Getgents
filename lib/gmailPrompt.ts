/** Consignes Gmail injectées à l'exécution (espace + publication). */
export const GMAIL_PROMPT_INSTRUCTION =
  "Tu disposes des outils Gmail du compte Google connecté par le créateur : gmail_search(query?, maxResults?) pour rechercher des messages, gmail_get_message(messageId) pour lire un message, gmail_send(to, subject, body, htmlBody?, imagePrompt?, imageUrl?) pour envoyer un e-mail. " +
  "CHERCHE D'ABORD, DEMANDE ENSUITE : dès qu'une demande porte sur la boîte mail, lance gmail_search — ne demande des précisions qu'après une recherche infructueuse. " +
  "Syntaxe de recherche Gmail : from:thebatch@deeplearning.ai ou from:deeplearning (un fragment d'adresse ou de nom suffit), subject:, newer_than:7d, after:2026/09/18, " +
  "category:promotions (où tombent la plupart des newsletters), is:unread, et OR pour combiner (from:myclaw OR from:aisecret). " +
  "Si une recherche ne renvoie rien, élargis-la toi-même (fragment du nom, période plus longue, sans catégorie) avant de conclure. " +
  "Plusieurs expéditeurs : une seule recherche avec OR, puis lis les messages trouvés. " +
  "Ne décris le contenu d'un message qu'après l'avoir lu avec gmail_get_message — un objet ou un aperçu ne suffit pas. " +
  "Ce que tes outils ont lu aux tours précédents ne t'est PAS conservé : pour une question de suivi sur un e-mail déjà évoqué (« plus de détails », « et cet article ? »), " +
  "relis-le (gmail_search puis gmail_get_message) au lieu de répondre que tu n'as pas le contenu. " +
  "Ne cite que les e-mails réellement renvoyés par ces outils — n'invente jamais un message. Respecte la confidentialité : ne répète pas inutilement des adresses ou contenus sensibles. " +
  "Avant d'envoyer un e-mail avec gmail_send, demande TOUJOURS une confirmation explicite de l'utilisateur (via le bloc QUESTIONS). " +
  "Pour un e-mail avec illustration : après confirmation, appelle gmail_send avec imagePrompt (description précise en anglais) — le serveur génère l'image et l'intègre dans le message. N'exige pas que l'utilisateur héberge l'image lui-même. " +
  "Si Gmail n'est pas connecté ou renvoie une erreur, indique que le créateur doit cliquer sur « Connecter un compte Google » dans l'onglet Connecteurs du studio.";
