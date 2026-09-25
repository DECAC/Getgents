import { parseDashboard, type DashboardSpec } from "@/lib/dashboardArtefact";

/**
 * « Garder en note » : une réponse du gent devient un artefact, TELLE QUELLE.
 *
 * Copie fidèle, sans appel au modèle : garder une réponse intéressante, c'est
 * vouloir ce texte-là, pas une réécriture qui coûterait un tour et pourrait
 * résumer ou inventer. La réponse, déjà rendue en HTML par `renderMarkdown`,
 * est redécoupée en blocs du vocabulaire fermé : un titre devient un bloc
 * `heading`, un tableau un bloc `table`, tout le reste du texte en markdown
 * dans des blocs `text`. Jamais de HTML dans l'artefact — c'est la règle qui
 * protège les pages publiques.
 *
 * Module PUR (aucun DOM) : le HTML produit par `renderMarkdown` est régulier,
 * une lecture par expressions suffit et reste testable.
 */

/** Plafond d'un bloc `text` (`parseDashboard` coupe au-delà). */
const TEXTE_MAX = 3800;
const TITRE_MAX = 80;

/**
 * Pour le MARKDOWN d'un bloc texte : `&lt;`, `&gt;` et `&amp;` restent des
 * entités. Décodés, un « <script> » écrit en toutes lettres par le gent
 * redeviendrait une balise, que l'assainissement supprimerait : la note
 * perdrait ce que la réponse affichait.
 */
function decoderPourMarkdown(s: string): string {
  return s.replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'");
}

/** Pour du texte BRUT (titre, cellule) : tout est décodé, React échappe. */
function decoder(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}

/** HTML en ligne → markdown : gras, italique, liens, code ; le reste est ôté. */
function enLigne(html: string): string {
  const md = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*")
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, texte: string) =>
      /^https?:\/\//i.test(href) ? `[${texte}](${href})` : texte
    )
    .replace(/<[^>]+>/g, "");
  return decoderPourMarkdown(md).replace(/[ \t]+\n/g, "\n").trim();
}

function texteBrut(html: string): string {
  return decoder(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function liste(html: string, ordonnee: boolean): string {
  const items = Array.from(html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)).map((m) => enLigne(m[1]).replace(/\n+/g, " "));
  return items.map((t, i) => (ordonnee ? `${i + 1}. ${t}` : `- ${t}`)).join("\n");
}

function tableau(html: string): { columns: string[]; rows: string[][] } | null {
  const lignes = Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)).map((m) =>
    Array.from(m[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)).map((c) => texteBrut(c[1]))
  );
  if (lignes.length < 2 || !lignes[0].length) return null;
  const [columns, ...rows] = lignes;
  return { columns, rows };
}

type Bloc = Record<string, unknown>;

/** Découpe un texte trop long en plusieurs blocs, aux sauts de paragraphe. */
function blocsTexte(md: string): Bloc[] {
  const sortie: Bloc[] = [];
  let courant = "";
  for (const para of md.split(/\n{2,}/)) {
    if (courant && courant.length + para.length + 2 > TEXTE_MAX) {
      sortie.push({ type: "text", body: courant });
      courant = "";
    }
    courant = courant ? `${courant}\n\n${para}` : para.slice(0, TEXTE_MAX);
  }
  if (courant.trim()) sortie.push({ type: "text", body: courant });
  return sortie;
}

function titreDepuis(premierTitre: string | undefined, premierTexte: string): string {
  // Le texte d'un bloc garde ses entités (voir `decoderPourMarkdown`) : le
  // titre, affiché en texte brut, les décode.
  const base = (premierTitre || decoder(premierTexte.replace(/[*_`#>-]/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")))
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return "Note";
  const phrase = base.split(/(?<=[.!?:])\s/)[0];
  const t = phrase.length <= TITRE_MAX ? phrase : `${phrase.slice(0, TITRE_MAX - 1).trimEnd()}…`;
  return t.replace(/[.:]$/, "").trim();
}

export function noteDepuisReponse(html: string): { title: string; dashboard: DashboardSpec } | null {
  if (!html?.trim()) return null;
  const blocs: Bloc[] = [];
  let tampon: string[] = [];
  let premierTitre: string | undefined;

  const viderTampon = () => {
    const md = tampon.filter(Boolean).join("\n\n").trim();
    if (md) blocs.push(...blocsTexte(md));
    tampon = [];
  };

  const ELEMENT = /<(h[1-6]|p|ul|ol|table|blockquote|pre)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let dernier = 0;
  for (const m of Array.from(html.matchAll(ELEMENT))) {
    // Texte hors balise entre deux éléments (réponse non structurée).
    const entre = enLigne(html.slice(dernier, m.index));
    if (entre) tampon.push(entre);
    dernier = (m.index ?? 0) + m[0].length;

    const balise = m[1].toLowerCase();
    const contenu = m[2];
    if (balise.startsWith("h")) {
      const texte = texteBrut(contenu);
      if (!texte) continue;
      viderTampon();
      premierTitre ??= texte;
      blocs.push({ type: "heading", text: texte.slice(0, 120) });
    } else if (balise === "ul" || balise === "ol") {
      tampon.push(liste(contenu, balise === "ol"));
    } else if (balise === "table") {
      const t = tableau(contenu);
      if (t) {
        viderTampon();
        blocs.push({ type: "table", columns: t.columns, rows: t.rows });
      }
    } else if (balise === "blockquote") {
      const cite = enLigne(contenu);
      if (cite) tampon.push(cite.split("\n").map((l) => `> ${l}`).join("\n"));
    } else if (balise === "pre") {
      tampon.push("```\n" + decoderPourMarkdown(contenu.replace(/<[^>]+>/g, "")).trim() + "\n```");
    } else {
      tampon.push(enLigne(contenu));
    }
  }
  const fin = enLigne(html.slice(dernier));
  if (fin) tampon.push(fin);
  viderTampon();

  const dashboard = parseDashboard({ blocks: blocs });
  if (!dashboard || !dashboard.blocks.length) return null;
  const premierTexte = blocs.find((b) => b.type === "text")?.body;
  return { title: titreDepuis(premierTitre, typeof premierTexte === "string" ? premierTexte : ""), dashboard };
}
