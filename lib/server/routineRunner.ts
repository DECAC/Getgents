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
import { sendWhatsAppText } from "@/lib/server/whatsapp";
import { sendBrevoEmail } from "@/lib/server/brevo";

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

/** Texte brut condensé d'une réponse markdown, pour un message de messagerie. */
function plainExcerpt(markdown: string, max = 500): string {
  const plain = markdown
    .replace(/[#*_>`]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{2,}/g, "\n")
    .trim();
  return plain.length > max ? plain.slice(0, max).trimEnd() + "…" : plain;
}

/**
 * Compose le message court livré sur le canal externe : titre, extrait de la
 * note, et lien vers la note complète dans l'espace (si l'URL publique est
 * configurée via NEXT_PUBLIC_APP_URL).
 */
function spaceUrl(gentId: string): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  return base ? `${base}/espace/${gentId}` : null;
}

/** Message court pour WhatsApp : titre, extrait texte brut, lien. */
function buildWhatsAppSummary(gentId: string, title: string, noteText: string): string {
  const url = spaceUrl(gentId);
  const link = url ? `\n\n👉 Note complète : ${url}` : "";
  return `📊 ${title}\n\n${plainExcerpt(noteText)}${link}`;
}

/** Corps HTML pour l'e-mail : la note complète rendue + lien vers l'espace. */
function buildEmailHtml(gentId: string, title: string, noteHtml: string): string {
  const url = spaceUrl(gentId);
  const link = url
    ? `<p style="margin-top:24px"><a href="${url}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Ouvrir la note complète</a></p>`
    : "";
  return (
    `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:#1a1a2e;line-height:1.6">` +
    `<h2 style="letter-spacing:-0.02em">${title}</h2>${noteHtml}${link}` +
    `<p style="margin-top:28px;font-size:12px;color:#8888a0">Note générée automatiquement par votre gent Getgents.</p></div>`
  );
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
export async function runRoutine(espace: Espace, routine: Routine, gentId = ""): Promise<RoutineRunResult> {
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

  // Diffusion externe (WhatsApp) : un résumé + lien est poussé au destinataire
  // qui a donné son consentement. L'échec de livraison ne remet pas en cause
  // le run (la note reste dans l'espace) — il est juste tracé.
  let channel = espace.channel;
  let deliveryNote = "";
  const title = sig ? sig.title : espace.name;
  const noteText = text || "Note de veille du jour.";
  const label = channel?.kind === "email" ? "E-mail" : "WhatsApp";
  if (channel?.enabled && channel.optInAt && channel.to.trim()) {
    const delivery =
      channel.kind === "email"
        ? await sendBrevoEmail(channel.to, title, buildEmailHtml(gentId, title, renderMarkdown(noteText)))
        : await sendWhatsAppText(channel.to, buildWhatsAppSummary(gentId, title, noteText));
    channel = { ...channel, lastDeliveryNote: `${nowTimeParis()} — ${delivery.note}` };
    deliveryNote = delivery.ok ? ` · ${label} livré` : ` · ${label} : ${delivery.note}`;
  } else if (channel?.enabled && !channel.optInAt) {
    channel = { ...channel, lastDeliveryNote: "non livré — consentement manquant" };
    deliveryNote = ` · ${label} non livré (opt-in manquant)`;
  }

  const runNote = (sig ? `ok — ${sig.title}` : "ok — note texte") + deliveryNote;
  return {
    ok: true,
    note: (sig ? `ok — artefact « ${sig.title} »` : "ok — note texte (sans artefact)") + deliveryNote,
    espace: {
      ...espace,
      artefacts,
      conversations,
      channel,
      routine: { ...routine, lastRunAt: stamp, lastRunNote: runNote },
    },
  };
}
