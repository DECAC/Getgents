// Exécution serveur des routines planifiées : le pipeline de veille tourne
// sans navigateur ouvert. Un appel externe (cron) frappe /api/routines/run,
// qui sélectionne les gents dont la routine est due, fait produire la note
// par le modèle (recherche web incluse si activée), et écrit le résultat
// (artefact + messages de conversation) directement dans l'espace en base.
import type { Espace, Routine, Artefact, ConversationMessage } from "@/lib/types";
export { isRoutineDue } from "@/lib/routineSchedule";
import { extractArtefactSignal } from "@/lib/artefactSignal";
import { ARTEFACT_PROMPT_INSTRUCTION } from "@/lib/artefactSignal";
import { profileContextNote } from "@/lib/profileSignal";
import { renderMarkdown } from "@/lib/markdown";

const OPENROUTER_API = process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";

const ARTEFACT_KIND_META: Record<string, { type: string; icon: string }> = {
  report: { type: "Rapport", icon: "📄" },
  checklist: { type: "Checklist", icon: "✅" },
  chart: { type: "Graphique", icon: "📊" },
  visual: { type: "Aperçu visuel", icon: "🖼️" },
  map: { type: "Carte", icon: "🗺️" },
  dashboard: { type: "Tableau de bord", icon: "📈" },
};

function nowTimeParis(): string {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
}

export interface RoutineRunResult {
  ok: boolean;
  note: string;
  espace: Espace;
}

/**
 * Exécute la mission de la routine pour un gent et renvoie l'espace mis à
 * jour (artefact + messages + trace de run) — l'appelant persiste.
 */
export async function runRoutine(espace: Espace, routine: Routine): Promise<RoutineRunResult> {
  const key = process.env.OPENROUTER_API_KEY;
  const stamp = new Date().toISOString();
  if (!key) {
    return {
      ok: false,
      note: "OPENROUTER_API_KEY absente côté serveur",
      espace: { ...espace, routine: { ...routine, lastRunAt: stamp, lastRunNote: "échec : clé API absente" } },
    };
  }

  const dateNote = `Date et heure actuelles : ${new Date().toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "full",
    timeStyle: "short",
  })} (heure de Paris).`;
  const profileNote = espace.profile ? `\n\n${profileContextNote(espace.profile)}` : "";
  const systemPrompt =
    `${espace.systemPrompt?.trim() || `Tu es le gent « ${espace.name} » de Getgents.`}\n\n${dateNote}${profileNote}` +
    `\n\nCONTEXTE D'EXÉCUTION : tu tournes en tâche de fond planifiée, SANS utilisateur en ligne — ne pose aucune question, ne demande aucune confirmation, produis directement le résultat demandé. ` +
    (espace.webSearch
      ? "Appuie-toi sur la recherche web pour des informations récentes et cite tes sources. "
      : "Tu n'as pas accès au web : indique clairement que la note repose sur des connaissances générales non vérifiées. ") +
    `\n\n${ARTEFACT_PROMPT_INSTRUCTION}`;

  let raw: string;
  try {
    const res = await fetch(OPENROUTER_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: espace.chatModelId ?? "anthropic/claude-sonnet-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: routine.mission },
        ],
        max_tokens: 4000,
        ...(espace.webSearch ? { plugins: [{ id: "web" }] } : {}),
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      return {
        ok: false,
        note: `échec LLM (${res.status})`,
        espace: { ...espace, routine: { ...routine, lastRunAt: stamp, lastRunNote: `échec LLM ${res.status} : ${detail}` } },
      };
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    raw = data.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    // Réseau/proxy indisponible : on trace l'échec sur la routine sans casser
    // le run (important en mode cron : un gent en échec ne doit pas empêcher
    // les autres de tourner).
    const msg = (err as Error).message ?? "erreur réseau";
    return {
      ok: false,
      note: `échec réseau : ${msg}`,
      espace: { ...espace, routine: { ...routine, lastRunAt: stamp, lastRunNote: `échec réseau : ${msg.slice(0, 160)}` } },
    };
  }
  const { text, artefact: sig } = extractArtefactSignal(raw);

  const t = nowTimeParis();
  const newMessages: ConversationMessage[] = [
    {
      role: "agent",
      text: renderMarkdown(text || "Note de veille générée."),
      t,
    },
  ];

  let artefacts = espace.artefacts;
  if (sig) {
    const meta = ARTEFACT_KIND_META[sig.kind] ?? { type: "Artefact", icon: "📄" };
    const artefactId = `artef-${Date.now()}`;
    const artefact: Artefact = {
      id: artefactId,
      title: sig.title,
      type: meta.type,
      icon: meta.icon,
      date: new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }),
      body: sig.body ? renderMarkdown(sig.body) : undefined,
      chartData: sig.chartData,
      checklistItems: sig.items?.map((label) => ({ label, checked: false })),
      mapPoints: sig.mapPoints,
      dashboard: sig.dashboard,
    };
    artefacts = [artefact, ...espace.artefacts];
    newMessages.push({ role: "artef-new", ref: artefactId, icon: meta.icon, title: sig.title, t });
  }

  // La note arrive dans la conversation active — l'utilisateur la retrouve
  // dans le fil ET dans l'espace (artefact) à sa prochaine visite.
  const threadId = espace.activeConversationId;
  const conversations = espace.conversations.map((c) =>
    c.id === threadId ? { ...c, messages: [...c.messages, ...newMessages] } : c
  );

  return {
    ok: true,
    note: sig ? `ok — artefact « ${sig.title} »` : "ok — note texte (sans artefact)",
    espace: {
      ...espace,
      artefacts,
      conversations,
      routine: { ...routine, lastRunAt: stamp, lastRunNote: sig ? `ok — ${sig.title}` : "ok — note texte" },
    },
  };
}
