// Rapport de test exportable en markdown : capture fidèle d'une session
// (builder ou espace) — configuration, transcript, appels d'outils,
// propositions et décisions — pour analyse a posteriori des tests.
import type { Espace, ConversationMessage } from "@/lib/types";
import type { GentDraft } from "@/lib/types/builder";
import { MODEL_CATALOG } from "@/lib/mock-data/builder";
import { parseDatasetUrl } from "@/lib/opendatasoft";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+\n/g, "\n").trim();
}

function modelLabel(id?: string | null): string {
  if (!id) return "—";
  return MODEL_CATALOG.find((m) => m.id === id)?.label ?? id;
}

function connectorBadge(toolKind: string, detail?: string): string {
  if (toolKind === "mcp" && detail && /^https?:\/\//.test(detail)) return "● réel";
  if (toolKind === "dataset" && detail && parseDatasetUrl(detail)) return "● réel";
  return "○ simulé";
}

/** Ligne lisible décrivant un message quel que soit son rôle (réutilisée par l'onglet Audit). */
export function describeMessage(m: ConversationMessage): string {
  const t = m.t ? ` (${m.t})` : "";
  switch (m.role) {
    case "user":
      return `**Utilisateur**${t} : ${stripHtml(m.text ?? "")}`;
    case "agent":
      return `**Assistant**${t} : ${stripHtml(m.text ?? "")}${m.reasoning ? `\n  - _raisonnement_ : ${m.reasoning.slice(0, 400)}` : ""}`;
    case "tool":
      return `🔧 **Appel d'outil**${t} : [${m.kind}] ${m.what} → ${m.ok === false ? "ÉCHEC" : "OK"}`;
    case "geo-request":
      return `📍 **Demande de position**${t} → statut : ${m.geoRequestStatus ?? "?"}`;
    case "artef-proposal":
      return `📄 **Proposition d'artefact**${t} : ${m.proposal?.kind ?? "?"} « ${m.proposal?.title ?? "?"} » → ${m.proposalStatus ?? "pending"}`;
    case "theme-proposal":
      return `🗂️ **Proposition d'onglet**${t} : ${JSON.stringify(m.themeProposal)} → ${m.themeProposalStatus ?? "pending"}`;
    case "connector-proposal":
      if (m.connectorSuggestions?.length) {
        const list = m.connectorSuggestions
          .map((s) => `    - [${s.kind}] ${s.name} — ${s.url}\n      sécurité : ${s.security} | stabilité : ${s.stability}`)
          .join("\n");
        return `🔌 **Connecteurs découverts**${t} → ${m.connectorSuggestionsStatus ?? "pending"}\n${list}`;
      }
      return `🔌 **Proposition de connecteur**${t} : [${m.connectorProposal?.kind}] ${m.connectorProposal?.name} — ${m.connectorProposal?.url} → ${m.connectorProposalStatus ?? "pending"}`;
    case "config-proposal":
      return `⚙️ **Configuration proposée**${t} : ${JSON.stringify(m.configProposal)} → ${m.configProposalStatus ?? "pending"}`;
    default:
      return `**${m.role}**${t} : ${stripHtml(m.text ?? "")}`;
  }
}

export function buildBuilderReport(draft: GentDraft): string {
  const lines: string[] = [];
  lines.push(`# Rapport de test — Builder « ${draft.name} »`);
  lines.push(`Généré le ${new Date().toLocaleString("fr-FR")} · statut : ${draft.status} · dernière modification : ${draft.updatedAt}`);
  lines.push("");
  lines.push("## Configuration du gent");
  lines.push(`- **Objectif** : ${draft.objective || "—"}`);
  lines.push(`- **Recherche web** : ${draft.webSearch ? "activée" : "désactivée"}`);
  for (const a of draft.modelAssignments) {
    if (a.modelId) lines.push(`- **Modèle ${a.capability}** : ${modelLabel(a.modelId)}`);
  }
  lines.push(`- **Connecteurs** (${draft.connectors.length}) :`);
  for (const c of draft.connectors) {
    lines.push(`  - [${c.toolKind}] ${c.name} ${connectorBadge(c.toolKind, c.detail)}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  if (draft.knowledgeSources.length) {
    lines.push(`- **Sources de connaissance** : ${draft.knowledgeSources.map((s) => `${s.kind}:${s.label}`).join(", ")}`);
  }
  lines.push("");
  lines.push("## Prompt système");
  lines.push("```");
  lines.push(draft.systemPrompt || "(vide)");
  lines.push("```");
  lines.push("");
  lines.push("## Transcript de la conversation avec l'assistant du builder");
  for (const m of draft.builderConversation) {
    lines.push(`- ${describeMessage(m)}`);
  }
  return lines.join("\n");
}

export function buildEspaceReport(espace: Espace): string {
  const lines: string[] = [];
  lines.push(`# Rapport de test — Espace « ${espace.name} »`);
  lines.push(`Généré le ${new Date().toLocaleString("fr-FR")} · gent : ${espace.gent} · statut : ${espace.statusLabel}`);
  lines.push("");
  lines.push("## Configuration publiée");
  lines.push(`- **Modèle conversationnel** : ${modelLabel(espace.chatModelId)}`);
  lines.push(`- **Recherche web** : ${espace.webSearch ? "activée" : "désactivée"}`);
  lines.push(`- **Serveurs MCP** : ${espace.mcpServers?.map((s) => `${s.name} (${s.url})`).join(", ") || "aucun"}`);
  lines.push(`- **Datasets** : ${espace.datasets?.map((d) => `${d.name} (${d.url})`).join(", ") || "aucun"}`);
  lines.push(`- **Mémoire de l'espace** : ${espace.memory || "—"}`);
  lines.push(`- **Artefacts présents** : ${espace.artefacts.map((a) => `${a.type} « ${a.title} »`).join(", ") || "aucun"}`);
  lines.push("");
  if (espace.systemPrompt) {
    lines.push("## Prompt système publié");
    lines.push("```");
    lines.push(espace.systemPrompt);
    lines.push("```");
    lines.push("");
  }
  espace.conversations.forEach((thread, idx) => {
    if (!thread.messages.length) return;
    lines.push(`## Conversation ${espace.conversations.length - idx} (${thread.startedAt})`);
    for (const m of thread.messages) {
      lines.push(`- ${describeMessage(m)}`);
    }
    lines.push("");
  });
  return lines.join("\n");
}

/** Télécharge le rapport côté navigateur sous forme de fichier .md. */
export function downloadReport(markdown: string, baseName: string): void {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "gent";
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rapport-test-${slug}-${stamp}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
