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
/**
 * Une étape de frise. `state` colore le nœud ; absent, il vaut "done" —
 * un modèle qui l'oublie produit ainsi une frise correcte, pas une frise vide.
 */
export type TimelineState = "done" | "current" | "todo" | "milestone";
export interface TimelineItem {
  /** Optionnelle : une étape non datée reste une étape. */
  date?: string;
  label: string;
  body?: string;
  state: TimelineState;
  tag?: string;
  metric?: string;
}

export interface ChartSeries {
  key: string;
  label: string;
  /** Pour un graphe composé : type de tracé de cette série. */
  type?: "bar" | "line" | "area";
}

/** Un point de carte — mêmes champs que `MapPoint`, validés au parsing. */
export interface PointCarte {
  label: string;
  lat: number;
  lon: number;
  description?: string;
}

export interface ElementChecklist {
  label: string;
  checked: boolean;
}

/**
 * VOCABULAIRE UNIQUE des artefacts.
 *
 * Né pour le tableau de bord, il porte désormais TOUT artefact : une
 * checklist, une frise, une carte ou un rapport ne sont que des compositions
 * de ces blocs. Le « type » affiché n'est plus imposé au modèle mais déduit
 * (voir `formeDeduite`) — c'est ce qui permet une frise avec un encadré, ou
 * une carte suivie de sa checklist, sans code nouveau.
 *
 * Le vocabulaire, lui, reste FERMÉ : aucun HTML ni code libre. C'est ce qui
 * garde les pages publiques à l'abri du XSS stocké, et chaque bloc
 * modifiable isolément.
 *
 * `id` : identifiant STABLE du bloc dans son artefact, socle des retouches
 * ciblées à venir (modifier « le bloc b3 » plutôt que tout régénérer).
 */
type BlocSansId =
  | { type: "stats"; width?: BlockWidth; items: StatItem[] }
  | { type: "heading"; width?: BlockWidth; text: string }
  | { type: "text"; width?: BlockWidth; body: string }
  | { type: "callout"; width?: BlockWidth; tone: CalloutTone; title?: string; body: string }
  | { type: "kv"; width?: BlockWidth; title?: string; items: KvItem[] }
  | {
      type: "timeline";
      width?: BlockWidth;
      title?: string;
      items: TimelineItem[];
      /** Étapes écartées par le plafond — annoncées, jamais coupées en silence. */
      omises?: number;
    }
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
    }
  | { type: "checklist"; width?: BlockWidth; title?: string; items: ElementChecklist[] }
  | { type: "map"; width?: BlockWidth; title?: string; points: PointCarte[] };

export type DashboardBlock = BlocSansId & { id?: string };

export interface DashboardSpec {
  subtitle?: string;
  blocks: DashboardBlock[];
}

/**
 * Les blocs disponibles, décrits UNE fois pour tous les prompts : l'artefact
 * de conversation (`consigneArtefacts`) et l'artefact figé (PINNED).
 */
export const VOCABULAIRE_BLOCS =
  "Chaque bloc a un champ \"type\", un \"id\" court et unique dans l'artefact (\"b1\", \"b2\"…) et, en option, \"width\" (\"full\" pleine largeur ou \"half\" demi-largeur pour juxtaposer deux blocs) :\n" +
  '- {"type":"heading","text":"Titre de section"} ;\n' +
  '- {"type":"text","body":"Paragraphe en markdown"} — texte suivi, synthèse, modèle de document ;\n' +
  '- {"type":"callout","tone":"warning","title":"Point d\'attention","body":"Texte en markdown"} — encadré (tone: info|success|warning|critical|neutral) ;\n' +
  '- {"type":"checklist","title":"Avant le départ","items":["Passeport","Assurance"]} — étapes à cocher, pièces à fournir, tâches (items courts, sans numérotation) ;\n' +
  '- {"type":"stats","items":[{"label":"Prix estimé","value":"685 000 €","delta":"-2,1 %","trend":"down","hint":"vs annonce"}]} — bandeau de 2 à 4 indicateurs clés ;\n' +
  '- {"type":"kv","title":"Critères","items":[{"label":"Surface","value":"153 m²"}]} — grille étiquette/valeur ;\n' +
  '- {"type":"table","title":"...","columns":["Poste","Valeur"],"rows":[["...","..."]]} ;\n' +
  '- {"type":"chart","variant":"bar","title":"...","xKey":"label","series":[{"key":"prix","label":"Prix au m²"}],"data":[{"label":"Bien","prix":4575},{"label":"Marché","prix":3800}]} — variant: bar|line|area|pie|donut|composed ; pour un graphe combiné, variant "composed" avec plusieurs series ayant chacune un "type" (bar/line) ;\n' +
  '- {"type":"timeline","title":"Parcours","items":[{"date":"2018 — 2022","label":"Intitulé de l\'étape","body":"Une ou deux phrases.","state":"done","tag":"En poste","metric":"+40 clients"}]} — FRISE chronologique, pour un PARCOURS ordonné dans le temps (carrière, historique, étapes d\'une procédure). state: done|current|todo|milestone. \"date\" est FACULTATIVE : si tu ignores une date, OMETS-LA plutôt que de l\'inventer. Étapes rendues DANS L\'ORDRE FOURNI, 12 au maximum ;\n' +
  '- {"type":"map","title":"Étapes du séjour","points":[{"label":"Lyon","lat":45.7578,"lon":4.832,"description":"Nuit 1"}]} — lieux, itinéraire, adresses : coordonnées WGS84 précises pour chaque point, 25 au maximum, rendues sur fond IGN (cartes.gouv.fr).\n' +
  "Dans un graphe, n'associe QUE des séries d'échelle comparable : deux mesures d'ordres de grandeur très différents (ex. un nombre de ventes ~10 et un prix ~380 000) vont dans DEUX graphiques séparés. " +
  "N'invente jamais de chiffres : n'utilise que les données de la conversation.";

/** Schéma des blocs sans la ligne d'émission ARTEFACT (artefact figé / PINNED). */
export const DASHBOARD_BLOCKS_SCHEMA =
  "Construis un tableau de bord dense avec des blocs JSON. " +
  VOCABULAIRE_BLOCS +
  "\nCombine au minimum 3 blocs (stats ou heading + text ou kv + chart ou callout). Chaque bloc stats doit avoir label ET value sur chaque item.";

const TONES: CalloutTone[] = ["info", "success", "warning", "critical", "neutral"];
const TIMELINE_STATES: TimelineState[] = ["done", "current", "todo", "milestone"];
/**
 * ARBITRAGE VALIDÉ : au-delà, un modèle bavard produit une frise illisible.
 * Le surplus est ANNONCÉ (`omises`) plutôt que coupé en silence — un état
 * tronqué sans un mot est le piège que ce projet a déjà payé plusieurs fois.
 */
export const TIMELINE_MAX_ITEMS = 12;

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
    case "timeline": {
      const tous = Array.isArray(b.items)
        ? b.items
            .map((it): TimelineItem | null => {
              const o = it as Record<string, unknown>;
              const label = str(o?.label, 120);
              // SEUL `label` est obligatoire. Exiger `date` contredisait notre
              // propre consigne d'exactitude, qui interdit au modèle
              // d'inventer une année : il obéissait, omettait la date, et
              // l'étape disparaissait — jusqu'à vider la frise entière, qui
              // n'était alors même plus rendue. Un parcours comporte
              // légitimement des étapes non datées ; le rail les porte sans
              // gouttière de date.
              if (!label) return null;
              return {
                date: str(o?.date, 40),
                label,
                body: str(o.body, 400),
                state: TIMELINE_STATES.includes(o.state as TimelineState)
                  ? (o.state as TimelineState)
                  : "done",
                tag: str(o.tag, 24),
                metric: str(o.metric, 32),
              };
            })
            .filter((x): x is TimelineItem => x !== null)
        : [];
      if (!tous.length) return null;
      // ARBITRAGE VALIDÉ : aucun tri. Un parcours se lit parfois du plus
      // récent au plus ancien ; réordonner trahirait l'intention du créateur.
      const items = tous.slice(0, TIMELINE_MAX_ITEMS);
      const omises = tous.length - items.length;
      return { type: "timeline", width: w, title: str(b.title, 90), items, ...(omises ? { omises } : {}) };
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
    case "checklist": {
      // Chaînes nues (ce que produit le modèle) ou objets déjà cochés (ce que
      // l'espace réenregistre) : les deux formes sont lues.
      const items = Array.isArray(b.items)
        ? b.items
            .map((it): ElementChecklist | null => {
              if (typeof it === "string") {
                const label = str(it, 200);
                return label ? { label, checked: false } : null;
              }
              const o = it as Record<string, unknown> | null;
              const label = str(o?.label, 200);
              return label ? { label, checked: o?.checked === true } : null;
            })
            .filter((x): x is ElementChecklist => x !== null)
            .slice(0, 30)
        : [];
      return items.length ? { type: "checklist", width: w, title: str(b.title, 90), items } : null;
    }
    case "map": {
      const points = Array.isArray(b.points)
        ? b.points
            .map((pt): PointCarte | null => {
              const o = pt as Record<string, unknown> | null;
              const label = str(o?.label, 120);
              const lat = typeof o?.lat === "number" ? o.lat : NaN;
              const lon = typeof o?.lon === "number" ? o.lon : NaN;
              // Hors de la Terre, un point ferait sauter l'emprise de la carte.
              if (!label || !(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) return null;
              return { label, lat, lon, description: str(o?.description, 200) };
            })
            .filter((x): x is PointCarte => x !== null)
            .slice(0, 25)
        : [];
      return points.length ? { type: "map", width: w, title: str(b.title, 90), points } : null;
    }
    default:
      return null;
  }
}

/** Lit et valide UN bloc — pour les opérations de retouche. */
export function lireBloc(raw: unknown): DashboardBlock | null {
  return parseBlock(raw);
}

export const ID_BLOC = /^[a-z][a-z0-9_-]{0,23}$/i;

/**
 * Identifiants stables : celui que le modèle a donné s'il est propre et
 * unique, sinon le premier `bN` libre. Un bloc sans identifiant ne pourrait
 * pas être visé par une retouche ; deux blocs au même identifiant la
 * rendraient ambiguë.
 */
export function avecIdentifiants(blocs: DashboardBlock[], proposes: unknown[] = []): DashboardBlock[] {
  const pris = new Set<string>();
  const candidats = blocs.map((b, i) => {
    const brut = typeof proposes[i] === "string" ? (proposes[i] as string) : b.id;
    return brut && ID_BLOC.test(brut) && !pris.has(brut) ? (pris.add(brut), brut) : null;
  });
  let n = 1;
  return blocs.map((b, i) => {
    let id = candidats[i];
    if (!id) {
      while (pris.has(`b${n}`)) n += 1;
      id = `b${n}`;
      pris.add(id);
    }
    return { ...b, id };
  });
}

export function parseDashboard(raw: unknown): DashboardSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const bruts = Array.isArray(d.blocks) ? d.blocks : [];
  const lus: { bloc: DashboardBlock; id: unknown }[] = [];
  for (const brut of bruts) {
    const bloc = parseBlock(brut);
    if (bloc) lus.push({ bloc, id: (brut as Record<string, unknown>)?.id });
    if (lus.length === 24) break;
  }
  if (!lus.length) return null;
  const blocks = avecIdentifiants(
    lus.map((l) => l.bloc),
    lus.map((l) => l.id)
  );
  return { subtitle: str(d.subtitle, 200), blocks };
}

/**
 * Le « type » d'un artefact à blocs, DÉDUIT de sa composition au lieu d'être
 * imposé au modèle. Seuls comptent les blocs porteurs (titres, textes et
 * encadrés accompagnent tout) : un seul genre de bloc porteur donne son nom.
 * Un mélange n'est un « Tableau de bord » que s'il porte des chiffres
 * (indicateurs ou graphiques) — une frise suivie d'une carte n'en est pas un.
 */
export function formeDeduite(spec: DashboardSpec): string {
  const porteurs = new Set(
    spec.blocks.map((b) => b.type).filter((t) => t !== "heading" && t !== "text" && t !== "callout")
  );
  if (porteurs.size === 0) return "Rapport";
  if (porteurs.size > 1) return porteurs.has("stats") || porteurs.has("chart") ? "Tableau de bord" : "Document";
  const [seul] = Array.from(porteurs);
  const NOM: Record<string, string> = {
    checklist: "Checklist",
    timeline: "Frise",
    map: "Carte",
    chart: "Graphique",
    table: "Tableau",
    kv: "Fiche",
    stats: "Tableau de bord",
  };
  return NOM[seul] ?? "Tableau de bord";
}

const NOM_BLOC: Record<DashboardBlock["type"], string | null> = {
  heading: null,
  text: "texte",
  callout: "encadré",
  stats: "indicateurs",
  kv: "fiche",
  table: "tableau",
  chart: "graphique",
  timeline: "frise",
  checklist: "checklist",
  map: "carte",
};

/**
 * Ce que contient un artefact à blocs, en clair : « Frise, encadré, carte et
 * checklist ». La carte de proposition annonçait « indicateurs, graphiques,
 * tableaux » pour tout, y compris pour une frise sans un chiffre.
 */
export function resumeComposition(spec: DashboardSpec): string {
  const noms: string[] = [];
  for (const b of spec.blocks) {
    const nom = NOM_BLOC[b.type];
    if (nom && !noms.includes(nom)) noms.push(nom);
  }
  if (!noms.length) return "Titres";
  const phrase = noms.length === 1 ? noms[0] : `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}
