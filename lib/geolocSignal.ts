// Demande de géolocalisation par le gent : plutôt qu'un bouton permanent,
// le modèle termine sa réponse par ce marqueur caché quand il a besoin de la
// position de l'utilisateur — on l'extrait pour afficher une carte de
// consentement dans le fil de conversation, à valider comme un artefact.
const GEOLOC_RE = /<!--GEOLOC_REQUEST-->/;

export const GEOLOC_PROMPT_INSTRUCTION =
  "Quand tu as besoin de la position de l'utilisateur pour répondre (recherche du lieu le plus proche), demande-la dans ta réponse puis termine par le marqueur exact <!--GEOLOC_REQUEST--> sur sa propre ligne : une demande de consentement s'affiche alors dans la conversation. " +
  "N'appelle jamais un outil de proximité avec une position devinée. Si la position est déjà indiquée dans le contexte, ne redemande pas et utilise-la directement.";

export function extractGeolocRequest(raw: string): { text: string; geoRequest: boolean } {
  const match = raw.match(GEOLOC_RE);
  if (!match) return { text: raw, geoRequest: false };
  const start = match.index ?? 0;
  return { text: (raw.slice(0, start) + raw.slice(start + match[0].length)).trim(), geoRequest: true };
}
