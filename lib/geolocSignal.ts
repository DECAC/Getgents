// Demande de géolocalisation par le gent : plutôt qu'un bouton permanent,
// le modèle termine sa réponse par ce marqueur caché quand il a besoin de la
// position de l'utilisateur — on l'extrait pour afficher une carte de
// consentement dans le fil de conversation, à valider comme un artefact.
const GEOLOC_RE = /<!--GEOLOC_REQUEST-->/;

export const GEOLOC_PROMPT_INSTRUCTION =
  "Adapte ta stratégie de localisation à la formulation de l'utilisateur : " +
  "1) S'il se réfère à SA position (« près de moi », « à proximité », « autour de moi », « le plus proche »… sans lieu explicite) et que sa position n'est pas déjà dans le contexte : demande-la dans ta réponse puis termine par le marqueur exact <!--GEOLOC_REQUEST--> sur sa propre ligne — une demande de consentement s'affiche dans la conversation. " +
  "2) S'il indique une ADRESSE ou un LIEU précis (rue, quartier, ville, monument…) : n'émets PAS le marqueur et ne demande pas sa géolocalisation — déduis toi-même les coordonnées WGS84 (lat/lon) de ce lieu et appelle directement l'outil de proximité avec, en précisant dans ta réponse le lieu de référence utilisé. " +
  "3) Si sa position est déjà indiquée dans le contexte, ne redemande jamais et utilise-la directement. " +
  "N'appelle jamais un outil de proximité avec une position devinée quand la demande se réfère à la position de l'utilisateur.";

export function extractGeolocRequest(raw: string): { text: string; geoRequest: boolean } {
  const match = raw.match(GEOLOC_RE);
  if (!match) return { text: raw, geoRequest: false };
  const start = match.index ?? 0;
  return { text: (raw.slice(0, start) + raw.slice(start + match[0].length)).trim(), geoRequest: true };
}
