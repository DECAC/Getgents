// Format demandé au modèle : terminer sa réponse par un bloc caché
// <!--ARTEFACT: {"kind":"report","title":"...","body":"...markdown..."}-->
// (ou "kind":"checklist" avec "items":["...","..."], ou "kind":"chart" avec
// "chartData":[{"label":"...","value":1}]) quand un artefact concret peut
// être produit à partir de l'échange. On l'extrait pour proposer à
// l'utilisateur de l'ajouter à son espace — jamais ajouté automatiquement.
const ARTEFACT_RE = /<!--ARTEFACT:\s*(\{[\s\S]*?\})\s*-->/;
const TRUNCATED_MARKER_RE = /<!--ARTEFACT:[\s\S]*$/;

export type ArtefactKind = "report" | "checklist" | "chart" | "visual" | "map";

export interface ArtefactSignal {
  kind: ArtefactKind;
  title: string;
  body?: string;
  items?: string[];
  chartData?: { label: string; value: number }[];
  mapPoints?: { label: string; lat: number; lon: number }[];
}

export const ARTEFACT_PROMPT_INSTRUCTION =
  "Propose systématiquement un artefact sauvegardable dès que ta réponse contient du contenu structuré exploitable — ne te limite pas aux seuls cas « parfaits ». " +
  "Dès qu'il y a des étapes, une liste de documents, un modèle de lettre/contrat, des chiffres ou un récapitulatif, termine ta réponse (après le texte visible et après un éventuel bloc QUESTIONS, sur sa propre ligne) par exactement un bloc : " +
  '<!--ARTEFACT: {"kind":"report","title":"Titre court","body":"Contenu en markdown"}--> ' +
  "pour une synthèse, un modèle de document, une procédure détaillée ou un texte à réutiliser ; " +
  '<!--ARTEFACT: {"kind":"checklist","title":"Titre court","items":["Élément 1","Élément 2","Élément 3"]}--> ' +
  "pour des étapes à cocher, une liste de pièces ou de tâches (items courts, un par élément, sans numérotation) ; ou " +
  '<!--ARTEFACT: {"kind":"chart","title":"Titre court","chartData":[{"label":"Catégorie A","value":120},{"label":"Catégorie B","value":80}]}--> ' +
  "dès qu'il y a des montants, pourcentages ou comparaisons chiffrées ; ou " +
  '<!--ARTEFACT: {"kind":"map","title":"Titre court","points":[{"label":"Lyon","lat":45.7578,"lon":4.832},{"label":"Annecy","lat":45.8992,"lon":6.1294}]}--> ' +
  "dès que la réponse mentionne des lieux, un itinéraire, des adresses ou des zones géographiques — fournis des coordonnées WGS84 (lat/lon) précises pour chaque point, la carte est rendue sur fond IGN (cartes.gouv.fr). " +
  "Choisis le kind le plus utile : si plusieurs formats conviennent, privilégie checklist pour l'actionnable et report pour les textes longs. " +
  "Invite brièvement l'utilisateur à l'ajouter à son espace (bouton dans le chat) — ne dis jamais qu'il est déjà ajouté. " +
  "Vise à proposer un artefact dans la majorité des réponses substantielles (guides, listes, modèles, budgets). N'en ajoute jamais plus d'un par réponse.";

export function extractArtefactSignal(raw: string): { text: string; artefact: ArtefactSignal | null } {
  const match = raw.match(ARTEFACT_RE);
  if (!match) {
    const truncated = raw.match(TRUNCATED_MARKER_RE);
    if (truncated) return { text: raw.slice(0, truncated.index).trim(), artefact: null };
    return { text: raw, artefact: null };
  }

  let artefact: ArtefactSignal | null = null;
  try {
    const parsed = JSON.parse(match[1]);
    if (
      parsed &&
      typeof parsed.title === "string" &&
      ["report", "checklist", "chart", "visual", "map"].includes(parsed.kind)
    ) {
      artefact = {
        kind: parsed.kind,
        title: parsed.title,
        body: typeof parsed.body === "string" ? parsed.body : undefined,
        items: Array.isArray(parsed.items)
          ? parsed.items.filter((s: unknown): s is string => typeof s === "string").slice(0, 30)
          : undefined,
        chartData: Array.isArray(parsed.chartData)
          ? parsed.chartData
              .filter((d: unknown): d is { label: string; value: number } =>
                !!d && typeof (d as { label?: unknown }).label === "string" && typeof (d as { value?: unknown }).value === "number"
              )
              .slice(0, 12)
          : undefined,
        mapPoints: Array.isArray(parsed.points)
          ? parsed.points
              .filter((pt: unknown): pt is { label: string; lat: number; lon: number } => {
                const o = pt as { label?: unknown; lat?: unknown; lon?: unknown };
                return !!o && typeof o.label === "string" && typeof o.lat === "number" && typeof o.lon === "number";
              })
              .slice(0, 25)
          : undefined,
      };
    }
  } catch {
    // ignore malformed block
  }

  const start = match.index ?? 0;
  const text = (raw.slice(0, start) + raw.slice(start + match[0].length)).trim();
  return { text, artefact };
}
