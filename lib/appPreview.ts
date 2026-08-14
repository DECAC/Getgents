import { SUGGESTIONS_PROMPT_INSTRUCTION } from "@/lib/suggestions";

/**
 * Aperçu d'application : ce que l'espace du gent affichera à l'usage.
 *
 * L'assistant du builder ne produit pas de HTML ni de JSX (sandbox,
 * cohérence visuelle) : il compose une liste de BLOCS typés, tirés d'un
 * catalogue fermé que l'application sait dessiner. Le créateur voit ainsi,
 * en direct et avec des données simulées, la tête de son application — et la
 * fait évoluer en continuant à discuter avec l'assistant.
 *
 * C'est volontairement le même vocabulaire de blocs pour tous les modules :
 * un « rapport » est une composition de blocs, pas un bloc de markdown libre.
 */

export type AppBlockKind =
  | "heading"
  | "text"
  | "stats"
  | "chart"
  | "table"
  | "callout"
  | "checklist"
  | "profile"
  | "contacts"
  | "cards"
  | "actions";

export type AppModuleSize = "compact" | "standard" | "large" | "full";

export type AppCalloutTone = "info" | "warning" | "success";

export type AppContactStatus = "todo" | "sent" | "replied";

export interface AppCardItem {
  title: string;
  subtitle?: string;
  /** Score de pertinence 0–100 : affiché en barre quand il est fourni. */
  score?: number;
  tags?: string[];
  note?: string;
}

export type AppBlock =
  | { kind: "heading"; text: string }
  | { kind: "text"; text: string }
  | { kind: "stats"; items: { value: string; label: string; delta?: string; dir?: "up" | "down" }[] }
  | { kind: "chart"; caption: string; series: { label: string; value: number }[] }
  | { kind: "table"; columns: string[]; numeric?: number[]; rows: string[][] }
  | { kind: "callout"; tone: AppCalloutTone; title?: string; text: string }
  | { kind: "checklist"; items: { label: string; done: boolean }[] }
  | {
      kind: "profile";
      initials: string;
      name: string;
      headline: string;
      facts: { value: string; label: string }[];
      chips: string[];
      completeness?: number;
    }
  | { kind: "contacts"; items: { name: string; role: string; last?: string; status: AppContactStatus }[] }
  | { kind: "cards"; filters?: string[]; items: AppCardItem[] }
  | { kind: "actions"; items: string[] };

export interface AppModuleSpec {
  id: string;
  title: string;
  /** Onglet dans lequel le module se range (doit figurer dans `themes`). */
  theme: string;
  size: AppModuleSize;
  /** D'où vient la donnée, tel qu'affiché sous le titre (ex. « Powens »). */
  source?: string;
  blocks: AppBlock[];
}

export interface AppPreviewSpec {
  /** Nom de l'application telle que l'utilisateur final la verra. */
  appName?: string;
  /** Onglets, dans l'ordre d'affichage. */
  themes: string[];
  modules: AppModuleSpec[];
  generatedAt?: string;
}

export const APP_PREVIEW_PROMPT_INSTRUCTION =
  "APERÇU DE L'APPLICATION — le créateur dispose d'un onglet « Aperçu » qui montre, avec des DONNÉES SIMULÉES, l'application que son gent produira à l'usage : une barre d'onglets thématiques et des tuiles de contenu. " +
  "Quand on te le demande (bouton « Générer l'aperçu » ou une phrase du créateur), émets le bloc EN PREMIER — avant toute phrase — pour que l'écran se remplisse tout de suite. " +
  "Format, sur sa propre ligne :\n" +
  '<!--APERCU: {"appName":"Nom de l\'app","themes":["Onglet 1","Onglet 2"],"modules":[{"id":"identifiant-stable","title":"Titre du module","theme":"Onglet 1","size":"large","source":"Powens","blocks":[…]}]}-->\n' +
  "Règles : `themes` = 2 à 3 onglets concrets (jamais « Onglet 1 » littéralement) ; `size` vaut compact, standard, large ou full (compte 12 colonnes : compact=3, standard=4, large=6, full=12) ; chaque module a un `id` stable en minuscules-tirets. " +
  "Première génération : 3 onglets, 4 modules, 2 blocs par module — pas plus. Ensuite, un module ré-émis avec le MÊME id le remplace ; un id nouveau l'ajoute. Maximum 8 modules. " +
  "Blocs disponibles (n'en invente aucun autre) :\n" +
  '- {"kind":"heading","text":"Titre de section"}\n' +
  '- {"kind":"text","text":"Un paragraphe court."}\n' +
  '- {"kind":"stats","items":[{"value":"2 340 €","label":"Budget total","delta":"+180 €","dir":"up"}]}\n' +
  '- {"kind":"chart","caption":"Ce que mesure le graphique, avec unité et source","series":[{"label":"Avr","value":210}]}\n' +
  '- {"kind":"table","columns":["Poste","Montant"],"numeric":[1],"rows":[["Hébergement","620 €"]]}\n' +
  '- {"kind":"callout","tone":"warning","title":"Titre court","text":"Le point d\'attention."}\n' +
  '- {"kind":"checklist","items":[{"label":"Passeport","done":true}]}\n' +
  '- {"kind":"profile","initials":"CL","name":"Camille Léaud","headline":"Cheffe de projet · 6 ans","facts":[{"value":"6 ans","label":"Expérience"}],"chips":["Figma","SQL"],"completeness":78}\n' +
  '- {"kind":"contacts","items":[{"name":"Inès Moreau","role":"Head of Product · Alma","last":"échange il y a 3 semaines","status":"todo"}]}\n' +
  '- {"kind":"cards","filters":["Tous","Télétravail"],"items":[{"title":"Product Manager","subtitle":"Alma · Paris","score":92,"tags":["CDI","52–60 k€"],"note":"Pourquoi cette offre sort du lot."}]}\n' +
  '- {"kind":"actions","items":["Préparer ma candidature","Relancer ce contact"]}\n' +
  "N'invente jamais un `kind` : une citation, un extrait ou un verbatim se rend avec `text` (un seul) ou `cards` (plusieurs, le texte allant dans `note`). " +
  "Les données doivent être PLAUSIBLES et propres au sujet du gent — n'écris jamais « Lorem » ni des valeurs à zéro. " +
  "Termine chaque module par un bloc actions (1 ou 2 boutons que l'utilisateur clique pour lancer l'assistant). " +
  "Une seule phrase visible après le bloc. Interdit dans ce tour : bloc GENT_CONFIG, connecteurs, dissertation métier, recherche d'informations réelles. " +
  "N'invente PAS un autre JSON (pas de `app_overview`, pas de `tabs`, pas de `type`, pas de `simulated_data`) : uniquement le commentaire <!--APERCU: {appName, themes, modules avec blocks}-->.";

/* ------------------------------------------------------------- validation */

function str(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Le modèle ne respecte pas toujours le catalogue à la lettre : il écrit
 * « quote », « kpi », « list » là où le catalogue dit text, stats, cards.
 * Un bloc rejeté disparaissait SANS TRACE — et comme un module sans bloc
 * valide est lui aussi rejeté, une modification demandée par le créateur
 * pouvait ne rien changer à l'écran pendant que l'assistant annonçait
 * l'avoir faite. On rattrape donc les synonymes courants plutôt que de
 * jeter la donnée.
 */
const BLOCK_KIND_ALIASES: Record<string, AppBlockKind> = {
  title: "heading",
  header: "heading",
  subheading: "heading",
  section: "heading",
  paragraph: "text",
  quote: "text",
  quotes: "text",
  citation: "text",
  citations: "text",
  excerpt: "text",
  excerpts: "text",
  verbatim: "text",
  markdown: "text",
  body: "text",
  note: "text",
  stat: "stats",
  kpi: "stats",
  kpis: "stats",
  metric: "stats",
  metrics: "stats",
  figures: "stats",
  graph: "chart",
  barchart: "chart",
  "bar-chart": "chart",
  linechart: "chart",
  "line-chart": "chart",
  grid: "table",
  datatable: "table",
  info: "callout",
  warning: "callout",
  alert: "callout",
  tip: "callout",
  highlight: "callout",
  todo: "checklist",
  todos: "checklist",
  tasks: "checklist",
  person: "profile",
  people: "contacts",
  contact: "contacts",
  card: "cards",
  list: "cards",
  items: "cards",
  action: "actions",
  buttons: "actions",
  cta: "actions",
};

const VALID_KINDS = new Set<string>([
  "heading",
  "text",
  "stats",
  "chart",
  "table",
  "callout",
  "checklist",
  "profile",
  "contacts",
  "cards",
  "actions",
]);

/** Première chaîne non vide parmi plusieurs noms de champ possibles. */
function pickStr(b: Record<string, unknown>, keys: string[], max: number): string | undefined {
  for (const k of keys) {
    const v = str(b[k], max);
    if (v) return v;
  }
  return undefined;
}

/**
 * Dernier recours quand le `kind` est absent ou inconnu : on devine d'après
 * la FORME de l'objet. Mieux vaut un bloc approchant que rien du tout.
 */
function inferKind(b: Record<string, unknown>): AppBlockKind | null {
  if (Array.isArray(b.series)) return "chart";
  if (Array.isArray(b.columns) && Array.isArray(b.rows)) return "table";
  if (Array.isArray(b.facts) || Array.isArray(b.chips)) return "profile";

  const items = b.items;
  if (Array.isArray(items) && items.length) {
    const first = items[0];
    // Un bloc de boutons déclare toujours `kind:"actions"`, essayé en premier :
    // une liste de chaînes hors catalogue est donc du contenu, pas des actions.
    if (typeof first === "string") return "cards";
    if (first && typeof first === "object") {
      const o = first as Record<string, unknown>;
      if ("done" in o || "checked" in o) return "checklist";
      if ("status" in o || ("name" in o && "role" in o)) return "contacts";
      if ("value" in o && "label" in o) return "stats";
      if ("title" in o) return "cards";
    }
  }

  if (typeof b.tone === "string") return "callout";
  if (pickStr(b, ["text", "content", "body", "quote", "excerpt", "value"], 1200)) return "text";
  return null;
}

/**
 * Types à essayer, du plus explicite au plus déduit. On ESSAIE plutôt qu'on
 * ne tranche : « citations » ressemble à un synonyme de `text`, mais s'il
 * porte une liste d'objets, c'est en réalité un `cards`. Le premier candidat
 * qui produit un bloc exploitable gagne.
 */
function kindCandidates(b: Record<string, unknown>): AppBlockKind[] {
  const raw = typeof b.kind === "string" ? b.kind.trim().toLowerCase() : "";
  const out: AppBlockKind[] = [];
  if (VALID_KINDS.has(raw)) out.push(raw as AppBlockKind);
  else if (BLOCK_KIND_ALIASES[raw]) out.push(BLOCK_KIND_ALIASES[raw]);
  const inferred = inferKind(b);
  if (inferred && !out.includes(inferred)) out.push(inferred);
  return out;
}

function validateBlock(raw: unknown): AppBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;

  for (const kind of kindCandidates(b)) {
    const block = blockOfKind(kind, b);
    if (block) return block;
  }
  return null;
}

function blockOfKind(kind: AppBlockKind, b: Record<string, unknown>): AppBlock | null {
  switch (kind) {
    case "heading": {
      const text = pickStr(b, ["text", "title", "label"], 120);
      return text ? { kind: "heading", text } : null;
    }

    case "text": {
      const text = pickStr(b, ["text", "content", "body", "quote", "excerpt", "value"], 1200);
      return text ? { kind: "text", text } : null;
    }

    case "stats": {
      const items = arr(b.items)
        .map((i) => {
          const o = (i ?? {}) as Record<string, unknown>;
          const value = str(o.value, 40) ?? (num(o.value) !== undefined ? String(o.value) : undefined);
          const label = pickStr(o, ["label", "title", "name"], 60);
          if (!value || !label) return null;
          return {
            value,
            label,
            delta: str(o.delta, 40),
            dir: o.dir === "down" ? ("down" as const) : o.dir === "up" ? ("up" as const) : undefined,
          };
        })
        .filter((i): i is NonNullable<typeof i> => i !== null)
        .slice(0, 4);
      return items.length ? { kind: "stats", items } : null;
    }

    case "chart": {
      const series = (Array.isArray(b.series) ? arr(b.series) : arr(b.items))
        .map((s) => {
          const o = (s ?? {}) as Record<string, unknown>;
          const label = str(o.label, 24);
          const value = num(o.value);
          return label && value !== undefined ? { label, value } : null;
        })
        .filter((s): s is { label: string; value: number } => s !== null)
        .slice(0, 12);
      if (!series.length) return null;
      return { kind: "chart", caption: str(b.caption, 200) ?? "", series };
    }

    case "table": {
      const columns = arr(b.columns)
        .map((c) => str(c, 60))
        .filter((c): c is string => !!c)
        .slice(0, 6);
      if (!columns.length) return null;
      const rows = arr(b.rows)
        .map((r) =>
          arr(r)
            .map((c) => (typeof c === "string" ? c.slice(0, 160) : typeof c === "number" ? String(c) : ""))
            .slice(0, columns.length)
        )
        .filter((r) => r.length > 0)
        .slice(0, 20);
      if (!rows.length) return null;
      const numeric = arr(b.numeric)
        .map((n) => num(n))
        .filter((n): n is number => n !== undefined && n >= 0 && n < columns.length);
      return { kind: "table", columns, rows, numeric: numeric.length ? numeric : undefined };
    }

    case "callout": {
      const text = pickStr(b, ["text", "content", "body"], 600);
      if (!text) return null;
      const tone: AppCalloutTone =
        b.tone === "warning" ? "warning" : b.tone === "success" ? "success" : "info";
      return { kind: "callout", tone, title: str(b.title, 120), text };
    }

    case "checklist": {
      const items = arr(b.items)
        .map((i) => {
          if (typeof i === "string") {
            const label = str(i, 160);
            return label ? { label, done: false } : null;
          }
          const o = (i ?? {}) as Record<string, unknown>;
          const label = pickStr(o, ["label", "text", "title"], 160);
          return label ? { label, done: !!(o.done ?? o.checked) } : null;
        })
        .filter((i): i is { label: string; done: boolean } => i !== null)
        .slice(0, 20);
      return items.length ? { kind: "checklist", items } : null;
    }

    case "profile": {
      const name = str(b.name, 80);
      if (!name) return null;
      const facts = arr(b.facts)
        .map((f) => {
          const o = (f ?? {}) as Record<string, unknown>;
          const value = str(o.value, 40);
          const label = str(o.label, 40);
          return value && label ? { value, label } : null;
        })
        .filter((f): f is { value: string; label: string } => f !== null)
        .slice(0, 4);
      const chips = arr(b.chips)
        .map((c) => str(c, 40))
        .filter((c): c is string => !!c)
        .slice(0, 12);
      const completeness = num(b.completeness);
      const initials =
        str(b.initials, 3) ??
        name
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
      return {
        kind: "profile",
        initials,
        name,
        headline: str(b.headline, 160) ?? "",
        facts,
        chips,
        completeness:
          completeness === undefined ? undefined : Math.max(0, Math.min(100, Math.round(completeness))),
      };
    }

    case "contacts": {
      const items = arr(b.items)
        .map((i) => {
          const o = (i ?? {}) as Record<string, unknown>;
          const name = pickStr(o, ["name", "title", "label"], 80);
          if (!name) return null;
          const status: AppContactStatus =
            o.status === "sent" ? "sent" : o.status === "replied" ? "replied" : "todo";
          return {
            name,
            role: pickStr(o, ["role", "subtitle", "headline"], 120) ?? "",
            last: pickStr(o, ["last", "note"], 120),
            status,
          };
        })
        .filter((i): i is NonNullable<typeof i> => i !== null)
        .slice(0, 12);
      return items.length ? { kind: "contacts", items } : null;
    }

    case "cards": {
      const items = arr(b.items)
        .map((i): AppCardItem | null => {
          if (typeof i === "string") {
            const title = str(i, 140);
            return title ? { title, tags: [] } : null;
          }
          const o = (i ?? {}) as Record<string, unknown>;
          const title = pickStr(o, ["title", "name", "label", "heading"], 140);
          if (!title) return null;
          const score = num(o.score);
          return {
            title,
            subtitle: pickStr(o, ["subtitle", "source", "role"], 160),
            score: score === undefined ? undefined : Math.max(0, Math.min(100, Math.round(score))),
            tags: arr(o.tags)
              .map((t) => str(t, 40))
              .filter((t): t is string => !!t)
              .slice(0, 6),
            note: pickStr(o, ["note", "text", "quote", "excerpt", "content"], 600),
          };
        })
        .filter((i): i is AppCardItem => i !== null)
        .slice(0, 12);
      if (!items.length) return null;
      const filters = arr(b.filters)
        .map((f) => str(f, 40))
        .filter((f): f is string => !!f)
        .slice(0, 5);
      return { kind: "cards", items, filters: filters.length ? filters : undefined };
    }

    case "actions": {
      const items = arr(b.items)
        .map((i) =>
          typeof i === "string"
            ? str(i, 80)
            : pickStr((i ?? {}) as Record<string, unknown>, ["label", "title", "text"], 80)
        )
        .filter((i): i is string => !!i)
        .slice(0, 5);
      return items.length ? { kind: "actions", items } : null;
    }

    default:
      return null;
  }
}

function slug(raw: string, fallback: number): string {
  const s = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || `module-${fallback}`;
}

function validateModule(raw: unknown, index: number): AppModuleSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const title = str(m.title, 120);
  if (!title) return null;
  const blocks = arr(m.blocks)
    .map(validateBlock)
    .filter((b): b is AppBlock => b !== null)
    .slice(0, 10);
  if (!blocks.length) return null;
  const size = m.size;
  return {
    id: str(m.id, 40) ? slug(str(m.id, 40)!, index) : slug(title, index),
    title,
    theme: str(m.theme, 60) ?? "",
    size:
      size === "compact" || size === "standard" || size === "large" || size === "full"
        ? size
        : "standard",
    source: str(m.source, 60),
    blocks,
  };
}

/**
 * Fusionne une proposition d'aperçu avec celle déjà affichée : un module
 * ré-émis avec le même identifiant remplace le précédent (à sa place),
 * un identifiant nouveau s'ajoute. `replace` repart d'une page blanche.
 */
export function mergeAppPreview(
  current: AppPreviewSpec | undefined,
  incoming: AppPreviewSpec,
  replace: boolean
): AppPreviewSpec {
  if (replace || !current) return incoming;

  const modules = [...current.modules];
  for (const next of incoming.modules) {
    const at = modules.findIndex((m) => m.id === next.id);
    if (at >= 0) modules[at] = next;
    else modules.push(next);
  }

  const themes = [...current.themes];
  for (const t of incoming.themes) if (!themes.includes(t)) themes.push(t);

  // Un onglet sans module n'a pas de raison d'exister dans la barre ; à
  // l'inverse, un onglet portant des modules doit y figurer, sinon ceux-ci
  // deviennent inatteignables.
  const used = new Set(modules.map((m) => m.theme));
  const finalThemes = themes.filter((t) => used.has(t));
  for (const t of Array.from(used)) if (t && !finalThemes.includes(t)) finalThemes.push(t);

  return {
    appName: incoming.appName ?? current.appName,
    themes: finalThemes,
    modules: modules.slice(0, 8),
    generatedAt: incoming.generatedAt,
  };
}

/**
 * Extrait un objet JSON par comptage d'accolades, en ignorant celles
 * qui sont dans une chaîne. Sans ça, un `{…}` imbriqué (chaque module,
 * chaque bloc) faisait échouer une regex non-gourmande — ou un bloc
 * tronqué (pas de `-->`) était simplement ignoré.
 */
function sliceBalancedObject(raw: string, from: number): { json: string; end: number } | null {
  const start = raw.indexOf("{", from);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === "\\") {
        esc = true;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return { json: raw.slice(start, i + 1), end: i + 1 };
    }
  }
  return null;
}

function stripCodeFence(json: string): string {
  return json
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function cardFromLooseItem(raw: unknown): AppCardItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title =
    pickStr(o, ["title", "subject", "label", "action", "name"], 120) ??
    (typeof o.id === "string" ? str(o.id, 80) : undefined);
  if (!title) return null;
  const subtitle = pickStr(o, ["subtitle", "sender", "participants", "from"], 120);
  const note = pickStr(o, ["note", "summary", "description", "text"], 400);
  const tags = [str(o.priority, 40), str(o.last_update, 40), str(o.last, 40)].filter((t): t is string => !!t);
  return { title, subtitle, note, tags: tags.length ? tags : undefined };
}

function blocksFromLooseModule(m: Record<string, unknown>): unknown[] {
  const existing = arr(m.blocks);
  if (existing.length) return existing;
  const blocks: unknown[] = [];
  const heading = str(m.title, 120);
  if (heading) blocks.push({ kind: "heading", text: heading });
  const desc = str(m.description, 400);
  if (desc) blocks.push({ kind: "text", text: desc });
  const data = arr(m.simulated_data).length ? arr(m.simulated_data) : arr(m.data);
  const type = typeof m.type === "string" ? m.type.toLowerCase() : "";
  const looksLikeActions =
    type === "actions" ||
    type === "action" ||
    data.some((item) => !!item && typeof item === "object" && "action" in (item as object));
  if (looksLikeActions && data.length) {
    const items = data
      .map((item) =>
        typeof item === "string"
          ? str(item, 80)
          : pickStr((item ?? {}) as Record<string, unknown>, ["action", "label", "title"], 80)
      )
      .filter((i): i is string => !!i)
      .slice(0, 5);
    if (items.length) blocks.push({ kind: "actions", items });
  } else if (data.length) {
    const items = data.map(cardFromLooseItem).filter((c): c is AppCardItem => !!c).slice(0, 8);
    if (items.length) blocks.push({ kind: "cards", items });
  }
  if (blocks.length <= 2 && heading) {
    const hasActions = blocks.some((b) => !!b && typeof b === "object" && (b as { kind?: string }).kind === "actions");
    if (!hasActions) blocks.push({ kind: "actions", items: ["Ouvrir"] });
  }
  return blocks;
}

function coercePreviewShape(p: Record<string, unknown>): Record<string, unknown> {
  const nested =
    p.app_overview && typeof p.app_overview === "object"
      ? (p.app_overview as Record<string, unknown>)
      : p.appOverview && typeof p.appOverview === "object"
        ? (p.appOverview as Record<string, unknown>)
        : null;
  const root = nested ?? p;
  const appName = str(root.title, 80) ?? str(root.appName, 80) ?? str(p.appName, 80);
  const tabs = arr(root.tabs ?? p.tabs);
  const rootModules = arr(root.modules ?? p.modules);

  if (tabs.length && !rootModules.length) {
    const themes: string[] = [];
    const modules: unknown[] = [];
    for (const tab of tabs) {
      if (!tab || typeof tab !== "object") continue;
      const t = tab as Record<string, unknown>;
      const label = str(t.label, 60) ?? str(t.title, 60) ?? str(t.name, 60);
      if (label && !themes.includes(label)) themes.push(label);
      const theme = label ?? themes[0] ?? "Vue d'ensemble";
      for (const rawMod of arr(t.modules)) {
        if (!rawMod || typeof rawMod !== "object") continue;
        const m = rawMod as Record<string, unknown>;
        modules.push({
          ...m,
          theme: str(m.theme, 60) ?? theme,
          blocks: blocksFromLooseModule(m),
        });
      }
    }
    return { appName, themes, modules, replace: p.replace };
  }

  if (rootModules.length) {
    return {
      ...root,
      appName: appName ?? str(root.appName, 80),
      modules: rootModules.map((raw) => {
        if (!raw || typeof raw !== "object") return raw;
        const m = raw as Record<string, unknown>;
        return { ...m, blocks: blocksFromLooseModule(m) };
      }),
    };
  }

  return nested ? { ...root, appName } : p;
}

function parsePreviewPayload(rawJson: string): { preview: AppPreviewSpec | null; replace: boolean } {
  let preview: AppPreviewSpec | null = null;
  let replace = false;
  try {
    const p = coercePreviewShape(JSON.parse(stripCodeFence(rawJson)) as Record<string, unknown>);
    const modules = arr(p.modules)
      .map((m, i) => validateModule(m, i))
      .filter((m): m is AppModuleSpec => m !== null)
      .slice(0, 8);

    if (modules.length) {
      const themes = arr(p.themes)
        .map((t) => str(t, 60))
        .filter((t): t is string => !!t)
        .slice(0, 5);

      for (const m of modules) {
        if (m.theme && !themes.includes(m.theme)) {
          if (themes.length < 5) themes.push(m.theme);
          else m.theme = themes[0];
        }
        if (!m.theme) {
          if (!themes.length) themes.push("Vue d'ensemble");
          m.theme = themes[0];
        }
      }

      replace = p.replace === true;
      preview = {
        appName: str(p.appName, 80),
        themes,
        modules,
        generatedAt: new Date().toISOString(),
      };
    }
  } catch {
    // JSON incomplet ou malformé — on attend la suite du flux
  }
  return { preview, replace };
}

export function extractAppPreviewSignal(raw: string): {
  text: string;
  preview: AppPreviewSpec | null;
  replace: boolean;
} {
  const tag = raw.search(/<!--\s*APERCU\s*:/i);
  if (tag >= 0) {
    const sliced = sliceBalancedObject(raw, tag);
    if (sliced) {
      const { preview, replace } = parsePreviewPayload(sliced.json);
      const afterObj = raw.slice(sliced.end);
      const closer = afterObj.match(/^\s*-->/);
      const end = sliced.end + (closer ? closer[0].length : 0);
      return {
        text: (raw.slice(0, tag) + raw.slice(end)).trim(),
        preview,
        replace,
      };
    }
    // Commentaire ouvert mais JSON pas encore refermé (flux en cours).
    return { text: raw.slice(0, tag).trim(), preview: null, replace: false };
  }

  // Repli : le modèle a parfois collé un objet JSON dans une clôture markdown
  // sans le commentaire HTML. On ne l'accepte que s'il a bien `modules`.
  const fence = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
  if (fence) {
    const { preview, replace } = parsePreviewPayload(fence[1]);
    if (preview) {
      return {
        text: raw.replace(fence[0], "").trim(),
        preview,
        replace,
      };
    }
  }

  // Repli 2 : JSON nu (souvent collé en premier, hors commentaire APERCU).
  if (/\b(app_overview|appName|"themes"|"modules")\b/.test(raw)) {
    const brace = raw.indexOf("{");
    if (brace >= 0) {
      const sliced = sliceBalancedObject(raw, brace);
      if (sliced) {
        const { preview, replace } = parsePreviewPayload(sliced.json);
        if (preview) {
          return {
            text: (raw.slice(0, brace) + raw.slice(sliced.end)).trim(),
            preview,
            replace,
          };
        }
      }
    }
  }

  return { text: raw, preview: null, replace: false };
}

/** Prompt système réduit : uniquement l'aperçu, sans config ni recherche. */
export function buildAppPreviewSystemPrompt(draft: {
  name: string;
  objective: string;
  connectors: { name: string; detail?: string }[];
  appPreview?: AppPreviewSpec;
}): string {
  const connectorsNote = draft.connectors.length
    ? `Connecteurs déjà prévus (à mentionner en source des modules, sans les reconfigurer) : ${draft.connectors
        .map((c) => c.name)
        .join(", ")}.`
    : "Aucun connecteur configuré — invente des sources plausibles (ex. « données simulées »).";

  const existing = draft.appPreview?.modules.length
    ? `Aperçu déjà affiché — onglets : ${draft.appPreview.themes.join(", ")}. Modules : ${draft.appPreview.modules
        .map((m) => `id="${m.id}" (« ${m.title} », ${m.theme})`)
        .join(" ; ")}. Reprends ces identifiants pour modifier.`
    : "Aucun aperçu n'est encore affiché : première génération.";

  return [
    "Tu génères UNIQUEMENT l'aperçu d'application du gent, avec des données simulées. " +
      "Tu n'es pas en train de configurer le gent, ni de chercher sur le web, ni de répondre en expert métier.",
    `Gent « ${draft.name} ». Objectif : ${draft.objective || "non défini"}. ${connectorsNote} ${existing}`,
    APP_PREVIEW_PROMPT_INSTRUCTION,
    "RAPPEL FINAL : émets d'abord le bloc <!--APERCU: {…}-->, puis une seule phrase. " +
      "Interdit : GENT_CONFIG, connecteurs, dissertation, checklist destinée à l'utilisateur final, JSON `app_overview` / `tabs` / `simulated_data`.",
  ].join("\n\n");
}

/** Demande envoyée à l'assistant quand le créateur clique « Générer l'aperçu ». */
export function buildAppPreviewRequest(objective: string): string {
  const clean = objective.trim();
  return (
    `Génère l'aperçu de l'application${clean ? ` (objectif : « ${clean} »)` : ""}. ` +
    "3 onglets, 4 modules, données simulées. Émets le bloc APERCU en premier, sans GENT_CONFIG ni recherche."
  );
}

/**
 * Clic « Faire évoluer l'aperçu » : on ne régénère pas tout de suite.
 * L'assistant propose des pistes cliquables ; « Autre » est ajouté par l'UI.
 */
export function buildAppPreviewEvolveRequest(preview: AppPreviewSpec): string {
  const modules = preview.modules.map((m) => `« ${m.title} » (${m.theme})`).join(", ");
  return (
    `Propose comment faire évoluer l'aperçu actuel (${preview.themes.join(" · ")} — ${modules}). ` +
    "Pose UNE question avec 3 ou 4 options concrètes et distinctes (nouvel onglet, enrichir un module nommé, changer un type de bloc, écarter un module…). " +
    "N'émet PAS de bloc APERCU dans ce message. Émets le bloc QUESTIONS. N'inclus pas l'option « Autre »."
  );
}

/** Prompt du tour « quelles évolutions ? » — questions seulement. */
export function buildAppPreviewEvolveSystemPrompt(draft: {
  name: string;
  objective: string;
  appPreview?: AppPreviewSpec;
}): string {
  const existing = draft.appPreview?.modules.length
    ? `Aperçu affiché — onglets : ${draft.appPreview.themes.join(", ")}. Modules : ${draft.appPreview.modules
        .map((m) => `« ${m.title} » (id="${m.id}", ${m.theme})`)
        .join(" ; ")}.`
    : "Aucun aperçu n'est encore affiché.";

  return [
    "Tu aides le créateur à FAIRE ÉVOLUER l'aperçu de son application. " +
      "Dans CE message tu ne génères rien : tu proposes des pistes cliquables, contextualisées à l'aperçu déjà affiché. " +
      "Pas de recherche web, pas de GENT_CONFIG, pas de bloc APERCU.",
    `Gent « ${draft.name} ». Objectif : ${draft.objective || "non défini"}. ${existing}`,
    SUGGESTIONS_PROMPT_INSTRUCTION,
    "RAPPEL FINAL : une phrase qui pose la question, puis le bloc <!--QUESTIONS: […]-->. " +
      "3 ou 4 options courtes, chacune une évolution précise de CET aperçu. " +
      "N'inclus PAS « Autre » dans les options — l'interface l'ajoute automatiquement avec un champ libre. " +
      "Interdit : APERCU, GENT_CONFIG, liste à puces des options dans le texte visible.",
  ].join("\n\n");
}
