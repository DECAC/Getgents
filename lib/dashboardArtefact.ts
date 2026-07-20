// Artefact « tableau de bord » : le modèle ne peut pas nous envoyer du JSX
// (sandbox/sécurité), il émet donc un SCHÉMA JSON structuré que l'app rend
// avec de vrais composants (Recharts + cartes). Objectif : des rapports
// aboutis combinant plusieurs éléments graphiques, en plein espace.

// Palette catégorielle Okabe-Ito — référence sûre pour le daltonisme, validée
// par le script dataviz (clair, sur fond blanc). Toujours accompagnée d'une
// légende + labels directs (encodage secondaire obligatoire).
export const CHART_CATEGORICAL = ["#0072b2", "#e69f00", "#009e73", "#cc79a7", "#d55e00"];
// Rampe séquentielle mono-teinte (indigo du brand) pour l'encodage de magnitude.
export const CHART_SEQUENTIAL = ["#c7d2fe", "#a5b4fc", "#818cf8", "#4f46e5", "#3730a3"];

export type CalloutTone = "info" | "success" | "warning" | "critical" | "neutral";
export type ChartVariant = "bar" | "line" | "area" | "pie" | "donut" | "radial" | "composed";
export type BlockWidth = "full" | "half";

export interface StatItem {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
  hint?: string;
}
export interface KvItem {
  label: string;
  value: string;
}
export interface ChartSeries {
  key: string;
  label: string;
  /** Pour un graphe composé : type de tracé de cette série. */
  type?: "bar" | "line" | "area";
}

export type DashboardBlock =
  | { type: "stats"; width?: BlockWidth; items: StatItem[] }
  | { type: "heading"; width?: BlockWidth; text: string }
  | { type: "text"; width?: BlockWidth; body: string }
  | { type: "callout"; width?: BlockWidth; tone: CalloutTone; title?: string; body: string }
  | { type: "kv"; width?: BlockWidth; title?: string; items: KvItem[] }
  | { type: "table"; width?: BlockWidth; title?: string; columns: string[]; rows: string[][] }
  | {
      type: "chart";
      width?: BlockWidth;
      variant: ChartVariant;
      title?: string;
      xKey?: string;
      unit?: string;
      stacked?: boolean;
      data: Record<string, string | number>[];
      series: ChartSeries[];
    };

export interface DashboardSpec {
  subtitle?: string;
  blocks: DashboardBlock[];
}

export const DASHBOARD_PROMPT_INSTRUCTION =
  "Pour une ANALYSE RICHE (rapport d'estimation, scoring, comparaison de marché, synthèse chiffrée combinant plusieurs angles), privilégie SYSTÉMATIQUEMENT l'artefact « dashboard » plutôt qu'un simple report markdown : il est rendu en plein espace avec de vrais graphiques et cartes, et met en avant les KPI en un coup d'œil au lieu de les noyer dans du texte. " +
  "Dès que ta réponse contient un score global, une décomposition pondérée par catégories, une estimation de prix avec écart, ou plusieurs métriques comparables (ex. bien vs marché), traduis-les en blocs \"stats\" (les chiffres clés) et \"chart\" (la comparaison ou la décomposition) — n'écris jamais un score ou un écart de prix uniquement en prose quand un artefact est proposé : ce sont des candidats naturels pour un bloc chart (bar pour une comparaison, composed pour scoring par catégorie). Le texte narratif (contexte, arguments, tactiques) reste en blocs \"text\"/\"callout\"/\"kv\" à l'intérieur du même dashboard, pas dans un report séparé. " +
  "Émets le bloc : <!--ARTEFACT: {\"kind\":\"dashboard\",\"title\":\"Titre court\",\"dashboard\":{\"subtitle\":\"Sous-titre optionnel\",\"blocks\":[...]}}--> " +
  "où blocks est une liste ordonnée d'éléments, chacun avec un champ \"type\" et un champ optionnel \"width\" (\"full\" pleine largeur ou \"half\" demi-largeur pour juxtaposer deux graphiques) :\n" +
  '- {"type":"stats","items":[{"label":"Prix estimé","value":"685 000 €","delta":"-2,1 %","trend":"down","hint":"vs annonce"}]} — bandeau de 2 à 4 indicateurs clés ;\n' +
  '- {"type":"heading","text":"Titre de section"} ;\n' +
  '- {"type":"kv","title":"Critères","items":[{"label":"Surface","value":"153 m²"}]} — grille étiquette/valeur ;\n' +
  '- {"type":"callout","tone":"warning","title":"Point d\'attention","body":"Texte en markdown"} — encadré (tone: info|success|warning|critical|neutral) ;\n' +
  '- {"type":"chart","variant":"bar","title":"...","xKey":"label","series":[{"key":"prix","label":"Prix au m²"}],"data":[{"label":"Bien","prix":4575},{"label":"Marché","prix":3800}]} — variant: bar|line|area|pie|donut|composed ; pour un graphe combiné utilise variant "composed" avec plusieurs series ayant chacune un "type" (bar/line) ;\n' +
  '- {"type":"table","columns":["Poste","Valeur"],"rows":[["...","..."]]} ;\n' +
  '- {"type":"text","body":"Paragraphe en markdown"}.\n' +
  "Combine plusieurs blocs (indicateurs + 2 graphiques côte à côte + tableau + encadrés) pour un rendu abouti. " +
  "Dans un graphe (y compris composé), n'associe QUE des séries d'échelle comparable : deux mesures d'ordres de grandeur très différents (ex. un nombre de ventes ~10 et un prix ~380 000) doivent aller dans DEUX graphiques séparés, jamais sur le même axe. " +
  "N'invente jamais de chiffres : n'utilise que les données de la conversation. Un seul artefact par réponse.";

const TONES: CalloutTone[] = ["info", "success", "warning", "critical", "neutral"];
const VARIANTS: ChartVariant[] = ["bar", "line", "area", "pie", "donut", "radial", "composed"];

function str(v: unknown, max = 400): string | undefined {
  return typeof v === "string" && v.trim() ? v.slice(0, max) : undefined;
}
function width(v: unknown): BlockWidth | undefined {
  return v === "full" || v === "half" ? v : undefined;
}

function parseBlock(raw: unknown): DashboardBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const w = width(b.width);
  switch (b.type) {
    case "stats": {
      const items = Array.isArray(b.items)
        ? b.items
            .map((it): StatItem | null => {
              const o = it as Record<string, unknown>;
              const label = str(o?.label, 60);
              const value = str(o?.value, 40);
              if (!label || !value) return null;
              return {
                label,
                value,
                delta: str(o.delta, 24),
                trend: o.trend === "up" || o.trend === "down" || o.trend === "flat" ? o.trend : undefined,
                hint: str(o.hint, 60),
              };
            })
            .filter((x): x is StatItem => x !== null)
            .slice(0, 4)
        : [];
      return items.length ? { type: "stats", width: w, items } : null;
    }
    case "heading": {
      const text = str(b.text, 120);
      return text ? { type: "heading", width: w, text } : null;
    }
    case "text": {
      const body = str(b.body, 4000);
      return body ? { type: "text", width: w, body } : null;
    }
    case "callout": {
      const body = str(b.body, 1500);
      if (!body) return null;
      const tone = TONES.includes(b.tone as CalloutTone) ? (b.tone as CalloutTone) : "info";
      return { type: "callout", width: w, tone, title: str(b.title, 90), body };
    }
    case "kv": {
      const items = Array.isArray(b.items)
        ? b.items
            .map((it): KvItem | null => {
              const o = it as Record<string, unknown>;
              const label = str(o?.label, 80);
              const value = str(o?.value, 300);
              return label && value ? { label, value } : null;
            })
            .filter((x): x is KvItem => x !== null)
            .slice(0, 24)
        : [];
      return items.length ? { type: "kv", width: w, title: str(b.title, 90), items } : null;
    }
    case "table": {
      const columns = Array.isArray(b.columns)
        ? b.columns.map((c) => str(c, 60) ?? "").slice(0, 8)
        : [];
      const rows = Array.isArray(b.rows)
        ? b.rows
            .filter((r): r is unknown[] => Array.isArray(r))
            .map((r) => r.map((c) => str(c, 200) ?? "").slice(0, 8))
            .slice(0, 40)
        : [];
      return columns.length && rows.length ? { type: "table", width: w, title: str(b.title, 90), columns, rows } : null;
    }
    case "chart": {
      const variant = VARIANTS.includes(b.variant as ChartVariant) ? (b.variant as ChartVariant) : "bar";
      const series = Array.isArray(b.series)
        ? b.series
            .map((s): ChartSeries | null => {
              const o = s as Record<string, unknown>;
              const key = str(o?.key, 40);
              const label = str(o?.label, 60) ?? key;
              if (!key) return null;
              return { key, label: label!, type: o.type === "line" || o.type === "area" || o.type === "bar" ? o.type : undefined };
            })
            .filter((x): x is ChartSeries => x !== null)
            .slice(0, 5)
        : [];
      const data = Array.isArray(b.data)
        ? b.data
            .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
            .map((d) => {
              const row: Record<string, string | number> = {};
              for (const [k, v] of Object.entries(d)) {
                if (typeof v === "number" && Number.isFinite(v)) row[k] = v;
                else if (typeof v === "string") row[k] = v.slice(0, 60);
              }
              return row;
            })
            .slice(0, 60)
        : [];
      if (!series.length || !data.length) return null;
      return {
        type: "chart",
        width: w,
        variant,
        title: str(b.title, 90),
        xKey: str(b.xKey, 40) ?? "label",
        unit: str(b.unit, 12),
        stacked: b.stacked === true,
        series,
        data,
      };
    }
    default:
      return null;
  }
}

export function parseDashboard(raw: unknown): DashboardSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const blocks = Array.isArray(d.blocks)
    ? d.blocks.map(parseBlock).filter((b): b is DashboardBlock => b !== null).slice(0, 24)
    : [];
  if (!blocks.length) return null;
  return { subtitle: str(d.subtitle, 200), blocks };
}
