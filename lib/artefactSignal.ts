// Format demandé au modèle : terminer sa réponse par un bloc caché
// <!--ARTEFACT: {"kind":"report","title":"...","body":"...markdown..."}-->
// (ou "kind":"chart" avec "chartData":[{"label":"...","value":1}]) quand un
// artefact concret peut être produit à partir de l'échange. On l'extrait pour
// créer un vrai artefact dans l'espace, affiché immédiatement au centre.
const ARTEFACT_RE = /<!--ARTEFACT:\s*(\{[\s\S]*?\})\s*-->/;
const TRUNCATED_MARKER_RE = /<!--ARTEFACT:[\s\S]*$/;

export type ArtefactKind = "report" | "checklist" | "chart" | "visual";

export interface ArtefactSignal {
  kind: ArtefactKind;
  title: string;
  body?: string;
  chartData?: { label: string; value: number }[];
}

export const ARTEFACT_PROMPT_INSTRUCTION =
  "Quand l'échange permet de produire un artefact concret et utile (une synthèse, une checklist, un graphique de données chiffrées, ou un point à ce stade), termine ta réponse (après le texte visible et après un éventuel bloc QUESTIONS, sur sa propre ligne) par un bloc : " +
  '<!--ARTEFACT: {"kind":"report","title":"Titre court","body":"Contenu en markdown"}--> ' +
  'pour une synthèse ou un point ; ' +
  '<!--ARTEFACT: {"kind":"checklist","title":"Titre court","body":"- élément 1\\n- élément 2"}--> ' +
  "pour une liste de tâches (en markdown, une case par ligne) ; ou " +
  '<!--ARTEFACT: {"kind":"chart","title":"Titre court","chartData":[{"label":"Catégorie A","value":120},{"label":"Catégorie B","value":80}]}--> ' +
  "pour un graphique de données chiffrées. N'ajoute ce bloc que si un artefact a vraiment du sens à ce stade de la conversation ; sinon ne l'ajoute pas, et n'en ajoute jamais plus d'un par réponse.";

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
      ["report", "checklist", "chart", "visual"].includes(parsed.kind)
    ) {
      artefact = {
        kind: parsed.kind,
        title: parsed.title,
        body: typeof parsed.body === "string" ? parsed.body : undefined,
        chartData: Array.isArray(parsed.chartData)
          ? parsed.chartData
              .filter((d: unknown): d is { label: string; value: number } =>
                !!d && typeof (d as { label?: unknown }).label === "string" && typeof (d as { value?: unknown }).value === "number"
              )
              .slice(0, 12)
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
