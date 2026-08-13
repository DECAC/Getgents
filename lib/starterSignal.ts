import type { Espace } from "@/lib/types";

/**
 * « Déclencheurs » : 5 questions d'amorce affichées dans l'espace de travail
 * vierge d'un gent conversationnel. Elles ne sont pas rédigées par le
 * créateur — le gent les choisit lui-même à partir de sa propre configuration,
 * de façon à donner à voir l'étendue de ce qu'on peut lui demander.
 *
 * Un espace vide ne dit rien de ce que le gent sait faire : l'utilisateur doit
 * deviner par où commencer. Ces bulles remplacent la devinette par l'exemple.
 */
export const STARTER_COUNT = 5;
const MAX_STARTER_CHARS = 110;

export const STARTER_PROMPT_INSTRUCTION =
  `Propose exactement ${STARTER_COUNT} questions d'amorce qu'un utilisateur pourrait te poser, ` +
  "chacune illustrant une CAPACITÉ DIFFÉRENTE de ce gent — couvre des angles variés (analyse, " +
  "recherche d'information, production d'un document, conseil pratique, exploration d'un cas précis) " +
  "plutôt que cinq variantes d'une même demande.\n" +
  "Règles : rédige-les à la première personne de l'utilisateur (« Peux-tu… », « Comment… », « Quelles sont… ») ; " +
  `chacune fait au maximum ${MAX_STARTER_CHARS} caractères ; elles doivent être immédiatement compréhensibles ` +
  "hors contexte, concrètes, et fidèles à ce que ce gent sait réellement faire d'après sa configuration. " +
  "N'invente aucune capacité qu'il n'a pas.\n" +
  'Réponds UNIQUEMENT par un tableau JSON de chaînes, sans texte autour : ["question 1","question 2",...]';

/**
 * Décrit au modèle ce dont le gent dispose réellement, pour que les
 * déclencheurs collent à ses capacités effectives plutôt qu'à une idée
 * générique de ce que fait un assistant.
 */
export function describeGentForStarters(espace: Espace): string {
  const lines: string[] = [];
  lines.push(`Nom du gent : ${espace.gent || espace.name || "sans nom"}`);

  const prompt = (espace.systemPrompt ?? "").trim();
  if (prompt) {
    // Le prompt système porte déjà la base de connaissance intégrale : on le
    // borne, sinon la requête d'amorce coûterait autant qu'une vraie réponse.
    lines.push(`\nInstructions système du gent (extrait) :\n${prompt.slice(0, 4000)}`);
  }

  const capabilities: string[] = [];
  if (espace.webSearch) capabilities.push("recherche web en temps réel");
  if (espace.datasets?.length) {
    capabilities.push(`jeux de données ouvertes : ${espace.datasets.map((d) => d.name).join(", ")}`);
  }
  if (espace.mcpServers?.length) {
    capabilities.push(`serveurs d'outils MCP : ${espace.mcpServers.map((s) => s.name).join(", ")}`);
  }
  if (espace.restApis?.length) {
    capabilities.push(`API métier : ${espace.restApis.map((r) => r.name).join(", ")}`);
  }
  if (espace.prim) capabilities.push("transports Île-de-France en temps réel (PRIM)");
  if (espace.powens) capabilities.push("agrégation bancaire (Powens)");
  if (espace.routine?.enabled) capabilities.push("routine planifiée produisant une note automatique");
  if (capabilities.length) {
    lines.push(`\nCapacités actives : ${capabilities.join(" ; ")}.`);
  }

  const docs = (espace.files ?? []).map((f) => f.name).filter(Boolean);
  if (docs.length) {
    lines.push(`\nDocuments dans sa base de connaissance : ${docs.slice(0, 12).join(", ")}.`);
  }

  const preview = espace.appPreview;
  if (preview?.modules.length) {
    const themes = preview.themes.length ? preview.themes.join(", ") : "non nommés";
    const modules = preview.modules.map((m) => `« ${m.title} » (${m.theme})`).join(" ; ");
    lines.push(`\nAperçu de l'application — onglets : ${themes}. Modules : ${modules}.`);
  }

  return lines.join("\n");
}

/**
 * Extraction tolérante : les modèles enrobent volontiers le JSON demandé dans
 * une phrase d'introduction ou un bloc de code. On tente le tableau brut, puis
 * le contenu d'une clôture ```…```, puis le premier `[...]` de la réponse.
 */
export function parseStarters(raw: string): string[] {
  const candidates: string[] = [];
  const trimmed = raw.trim();
  candidates.push(trimmed);

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidates.push(fenced[1].trim());

  const bracket = trimmed.match(/\[[\s\S]*\]/);
  if (bracket) candidates.push(bracket[0]);

  for (const candidate of candidates) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }
    const list = normalizeStarterList(parsed);
    if (list.length) return list;
  }
  return [];
}

function normalizeStarterList(parsed: unknown): string[] {
  // Certains modèles renvoient {"questions": [...]} malgré la consigne.
  const array = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { questions?: unknown })?.questions)
      ? (parsed as { questions: unknown[] }).questions
      : null;
  if (!array) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of array) {
    // Tolère aussi [{ "question": "…" }] plutôt que des chaînes nues.
    const text =
      typeof item === "string"
        ? item
        : typeof (item as { question?: unknown })?.question === "string"
          ? (item as { question: string }).question
          : null;
    if (!text) continue;
    const clean = text.replace(/\s+/g, " ").trim().slice(0, MAX_STARTER_CHARS);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length === STARTER_COUNT) break;
  }
  return out;
}

/**
 * Un gent en mode mini-application ne converse pas : lui proposer des amorces
 * de conversation n'aurait aucun sens. Un espace déjà peuplé n'en a pas besoin
 * non plus — les déclencheurs servent à franchir la page blanche.
 *
 * `moduleCount` compte les artefacts de l'ancien canevas. L'aperçu d'application
 * (appPreview) n'en fait pas partie : il remplit le canevas sans pour autant
 * remplacer les amorces de conversation.
 */
export function shouldShowStarters(espace: Espace, moduleCount: number): boolean {
  if (espace.pinnedArtefact?.enabled) return false;
  if (moduleCount > 0) return false;
  return true;
}

/**
 * Amorces à l'ouverture de la conversation, à côté d'un aperçu d'application :
 * le canevas n'est plus vide, mais le fil l'est encore. Un formulaire jump
 * tient déjà lieu de premier geste — on ne double pas.
 */
export function shouldShowConversationStarters(espace: Espace, messageCount: number): boolean {
  if (espace.pinnedArtefact?.enabled) return false;
  if (espace.jumpForm) return false;
  if (!espace.appPreview?.modules.length) return false;
  return messageCount === 0;
}

export function activeConversationMessageCount(espace: Espace): number {
  const thread =
    espace.conversations.find((c) => c.id === espace.activeConversationId) ?? espace.conversations[0];
  return thread?.messages.length ?? 0;
}

/**
 * Questions de repli tant que le gent n'a pas encore choisi ses déclencheurs :
 * on s'appuie sur les onglets et modules de l'aperçu, puis sur le nom du gent,
 * pour qu'un Preview tout neuf n'ouvre pas sur une page muette.
 */
export function fallbackStarters(espace: Espace): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (raw: string) => {
    const clean = raw.replace(/\s+/g, " ").trim().slice(0, MAX_STARTER_CHARS);
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(clean);
  };

  for (const theme of espace.appPreview?.themes ?? []) {
    push(`Peux-tu m'aider sur « ${theme} » ?`);
    if (out.length >= STARTER_COUNT) return out;
  }

  for (const module of espace.appPreview?.modules ?? []) {
    push(`Que me recommandes-tu à propos de « ${module.title} » ?`);
    if (out.length >= STARTER_COUNT) return out;
  }

  const name = (espace.gent || espace.name || "").trim();
  if (name) push(`Par où commencer avec ${name} ?`);
  push("Que peux-tu faire pour moi ?");
  push("Quelles sont tes recommandations en ce moment ?");
  push("Peux-tu me faire un point de situation ?");

  return out.slice(0, STARTER_COUNT);
}

/** Déclencheurs persistés s'ils existent, sinon le repli d'accueil. */
export function displayedStarters(espace: Espace): string[] {
  return espace.starters?.length ? espace.starters : fallbackStarters(espace);
}
