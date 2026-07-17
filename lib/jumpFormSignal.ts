// « Formulaire jump » proposé par l'assistant du builder : un petit formulaire
// de champs affiché côté utilisateur pour lancer le gent dès la première saisie
// (sans rédiger un prompt). L'assistant l'émet dans un bloc dédié, appliqué au
// draft seulement après validation explicite du créateur.
import type { JumpForm, JumpFormField, JumpFormFieldKind } from "@/lib/types";

const JUMP_FORM_RE = /<!--JUMP_FORM:\s*(\{[\s\S]*?\})\s*-->/;

const VALID_KINDS: JumpFormFieldKind[] = ["text", "textarea", "date", "select"];

export const JUMP_FORM_PROMPT_INSTRUCTION =
  "« Formulaires jump » : quand le cas d'usage du gent est assez précis pour se résumer à quelques informations d'entrée (ex. un assistant vols = aéroport de départ, aéroport d'arrivée, date), tu peux proposer un formulaire léger que l'utilisateur remplira côté gent pour lancer sa demande en un clic, sans rédiger de prompt. " +
  "Propose-le spontanément dès que c'est pertinent, ou quand le créateur le demande. Pour cela, termine ta réponse (sur sa propre ligne) par exactement un bloc " +
  '<!--JUMP_FORM: {"title":"Rechercher un vol","description":"Renseignez votre trajet","submitLabel":"Rechercher","fields":[{"id":"depart","label":"Ville ou aéroport de départ","kind":"text","placeholder":"ex. Paris (CDG)","required":true},{"id":"arrivee","label":"Ville ou aéroport d\'arrivée","kind":"text","required":true},{"id":"date","label":"Date de départ","kind":"date","required":true}],"promptTemplate":"Quels sont les vols de {{depart}} vers {{arrivee}} le {{date}} ?"}--> ' +
  "Règles : 2 à 6 champs maximum, chacun avec un id court en minuscules (lettres/chiffres/underscore), un label clair, un kind parmi text/textarea/date/select (options obligatoire et non vide pour select), et required true/false. " +
  "promptTemplate est le message envoyé au gent, avec des marqueurs {{id}} correspondant aux champs — rédige-le comme une vraie demande utilisateur naturelle. " +
  "Une carte « Ajouter ce formulaire » s'affiche alors : le créateur valide en un clic et le formulaire apparaît côté utilisateur au démarrage d'une conversation. Décris le formulaire en une phrase courte dans le texte visible, sans recopier le JSON.";

function slugId(v: unknown, fallback: string): string {
  const s = typeof v === "string" ? v.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") : "";
  return s || fallback;
}

function validateField(raw: unknown, index: number): JumpFormField | null {
  const p = raw as Partial<JumpFormField> & { options?: unknown };
  if (!p || typeof p.label !== "string" || !p.label.trim()) return null;
  const kind: JumpFormFieldKind = VALID_KINDS.includes(p.kind as JumpFormFieldKind)
    ? (p.kind as JumpFormFieldKind)
    : "text";
  const options =
    kind === "select" && Array.isArray(p.options)
      ? p.options.filter((o): o is string => typeof o === "string" && o.trim() !== "").slice(0, 12)
      : undefined;
  if (kind === "select" && (!options || options.length === 0)) return null;
  return {
    id: slugId(p.id, `champ_${index + 1}`),
    label: p.label.trim().slice(0, 120),
    placeholder: typeof p.placeholder === "string" ? p.placeholder.slice(0, 120) : undefined,
    required: p.required !== false,
    kind,
    options,
  };
}

function validateJumpForm(parsed: unknown): JumpForm | null {
  const p = parsed as Partial<JumpForm>;
  if (!p || !Array.isArray(p.fields)) return null;
  const fields = p.fields
    .map((f, i) => validateField(f, i))
    .filter((f): f is JumpFormField => f !== null)
    .slice(0, 6);
  if (fields.length < 1) return null;

  // Dédoublonne les identifiants pour garantir des marqueurs uniques.
  const seen = new Set<string>();
  for (const f of fields) {
    let id = f.id;
    let n = 2;
    while (seen.has(id)) id = `${f.id}_${n++}`;
    f.id = id;
    seen.add(id);
  }

  return {
    id: `jump-${Date.now()}`,
    title: typeof p.title === "string" && p.title.trim() ? p.title.trim().slice(0, 120) : "Lancer le gent",
    description: typeof p.description === "string" && p.description.trim() ? p.description.slice(0, 300) : undefined,
    submitLabel:
      typeof p.submitLabel === "string" && p.submitLabel.trim() ? p.submitLabel.trim().slice(0, 40) : "Envoyer",
    fields,
    promptTemplate:
      typeof p.promptTemplate === "string" && p.promptTemplate.trim() ? p.promptTemplate.slice(0, 1000) : undefined,
  };
}

export function extractJumpFormSignal(raw: string): { text: string; form: JumpForm | null } {
  const match = raw.match(JUMP_FORM_RE);
  if (!match) return { text: raw, form: null };
  let form: JumpForm | null = null;
  try {
    form = validateJumpForm(JSON.parse(match[1]));
  } catch {
    // bloc malformé — ignoré
  }
  const start = match.index ?? 0;
  return { text: (raw.slice(0, start) + raw.slice(start + match[0].length)).trim(), form };
}

/**
 * Compose le message à envoyer au gent à partir des valeurs saisies.
 * Utilise promptTemplate ({{id}} remplacés) si présent, sinon « Libellé : valeur ».
 */
export function buildJumpFormPrompt(form: JumpForm, values: Record<string, string>): string {
  if (form.promptTemplate) {
    let out = form.promptTemplate;
    for (const f of form.fields) {
      out = out.replaceAll(`{{${f.id}}}`, (values[f.id] ?? "").trim());
    }
    return out.trim();
  }
  return form.fields
    .map((f) => `${f.label} : ${(values[f.id] ?? "").trim()}`)
    .filter((line) => !line.endsWith(": "))
    .join("\n");
}
