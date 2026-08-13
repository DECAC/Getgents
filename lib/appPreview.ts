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
  "Les données doivent être PLAUSIBLES et propres au sujet du gent — n'écris jamais « Lorem » ni des valeurs à zéro. " +
  "Une seule phrase visible après le bloc. Interdit dans ce tour : bloc GENT_CONFIG, connecteurs, dissertation métier, recherche d'informations réelles.";

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

function validateBlock(raw: unknown): AppBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;

  switch (b.kind) {
    case "heading": {
      const text = str(b.text, 120);
      return text ? { kind: "heading", text } : null;
    }

    case "text": {
      const text = str(b.text, 1200);
      return text ? { kind: "text", text } : null;
    }

    case "stats": {
      const items = arr(b.items)
        .map((i) => {
          const o = (i ?? {}) as Record<string, unknown>;
          const value = str(o.value, 40);
          const label = str(o.label, 60);
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
      const series = arr(b.series)
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
      const text = str(b.text, 600);
      if (!text) return null;
      const tone: AppCalloutTone =
        b.tone === "warning" ? "warning" : b.tone === "success" ? "success" : "info";
      return { kind: "callout", tone, title: str(b.title, 120), text };
    }

    case "checklist": {
      const items = arr(b.items)
        .map((i) => {
          const o = (i ?? {}) as Record<string, unknown>;
          const label = str(o.label, 160);
          return label ? { label, done: !!o.done } : null;
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
          const name = str(o.name, 80);
          if (!name) return null;
          const status: AppContactStatus =
            o.status === "sent" ? "sent" : o.status === "replied" ? "replied" : "todo";
          return { name, role: str(o.role, 120) ?? "", last: str(o.last, 120), status };
        })
        .filter((i): i is NonNullable<typeof i> => i !== null)
        .slice(0, 12);
      return items.length ? { kind: "contacts", items } : null;
    }

    case "cards": {
      const items = arr(b.items)
        .map((i): AppCardItem | null => {
          const o = (i ?? {}) as Record<string, unknown>;
          const title = str(o.title, 140);
          if (!title) return null;
          const score = num(o.score);
          return {
            title,
            subtitle: str(o.subtitle, 160),
            score: score === undefined ? undefined : Math.max(0, Math.min(100, Math.round(score))),
            tags: arr(o.tags)
              .map((t) => str(t, 40))
              .filter((t): t is string => !!t)
              .slice(0, 6),
            note: str(o.note, 600),
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
        .map((i) => str(i, 80))
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

function parsePreviewPayload(rawJson: string): { preview: AppPreviewSpec | null; replace: boolean } {
  let preview: AppPreviewSpec | null = null;
  let replace = false;
  try {
    const p = JSON.parse(stripCodeFence(rawJson)) as Record<string, unknown>;
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
      "Interdit : GENT_CONFIG, connecteurs, dissertation, checklist destinée à l'utilisateur final.",
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
