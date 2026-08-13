"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { SafeHTML } from "@/components/shared/SafeHTML";
import { QuickReplyQuestions } from "@/components/shared/QuickReplyQuestions";
import { MODEL_CATALOG, BUILDER_ASSISTANT_MODEL_ID } from "@/lib/mock-data/builder";
import type { ConversationMessage } from "@/lib/types";
import { setBuilderAssistWidthFromPointer, canResizeAssist } from "@/lib/assistResize";
import { buildBuilderReport } from "@/lib/testReport";
import { ReportMenu } from "@/components/shared/ReportMenu";
import { ThinkingIndicator } from "@/components/shared/ThinkingIndicator";
import { extractDocumentText, type ExtractedDoc } from "@/lib/extractDocumentText";
import { frameBuilderKnowledgeFileMessage } from "@/lib/builderAssistantPrompt";
import styles from "./BuilderAssistantPanel.module.css";

const CHAT_MODELS = MODEL_CATALOG.filter((m) => m.capability === "chat");

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

export function BuilderAssistantPanel() {
  const {
    currentDraft,
    sendBuilderMessage,
    startNewBuilderConversation,
    applyBuilderSuggestion,
    assignModel,
    confirmConnectorProposal,
    confirmConnectorSuggestions,
    applyGentConfig,
    applyJumpForm,
    switchTab,
    isThinking,
    thinkingStatus,
    stopGeneration,
    assistantCollapsed,
    toggleAssistant,
  } = useBuilder();
  const [composerText, setComposerText] = useState("");
  const [attachment, setAttachment] = useState<ExtractedDoc | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<number, boolean>>({});
  // Sélection des connecteurs candidats, par message : URL → cochée (tout
  // est coché par défaut, le créateur décoche ce qu'il ne veut pas).
  const [suggestionChecks, setSuggestionChecks] = useState<Record<string, Record<string, boolean>>>({});
  const bodyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  // Référence indirecte : l'effet de drag ne se relie qu'au montage, il ne
  // doit pas capturer une version périmée du callback.
  const collapseRef = useRef(toggleAssistant);
  useEffect(() => {
    collapseRef.current = toggleAssistant;
  }, [toggleAssistant]);

  // Drag-to-resize (edge handle) — même mécanique que le panneau assistant
  // côté espace, sur une variable CSS dédiée (--builder-assist).
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    let dragging = false;
    // Un mousedown suivi d'un mouseup sans déplacement est un CLIC : la même
    // poignée sert donc à redimensionner (glisser) et à replier (cliquer),
    // comme le panneau conversationnel côté espace.
    let moved = false;

    function onMove(e: MouseEvent) {
      if (!dragging) return;
      moved = true;
      setBuilderAssistWidthFromPointer(e.clientX);
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      handle!.classList.remove(styles.handleActive);
      document.body.classList.remove("col-resizing");
      if (!moved) collapseRef.current();
    }

    function onDown(e: MouseEvent) {
      dragging = true;
      moved = false;
      if (canResizeAssist()) {
        handle!.classList.add(styles.handleActive);
        document.body.classList.add("col-resizing");
      }
      e.preventDefault();
    }

    handle.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      handle.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const gentChatModelId =
    currentDraft.modelAssignments.find((a) => a.capability === "chat")?.modelId ??
    CHAT_MODELS[0]?.id ??
    "";
  const assistantModelLabel =
    MODEL_CATALOG.find((m) => m.id === BUILDER_ASSISTANT_MODEL_ID)?.label ?? "Kimi K3";

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [currentDraft.builderConversation, isThinking, thinkingStatus]);

  // Nouveau gent (ou retour sur un autre) : vider le composeur local.
  useEffect(() => {
    setComposerText("");
    setAttachment(null);
    setAttachError(null);
    setSuggestionChecks({});
    setExpandedReasoning({});
  }, [currentDraft.id]);

  function toggleReasoning(i: number) {
    setExpandedReasoning((prev) => ({ ...prev, [i]: !prev[i] }));
  }

  function isReasoningOpen(i: number, m: ConversationMessage): boolean {
    if (i in expandedReasoning) return expandedReasoning[i];
    return isThinking && i === currentDraft.builderConversation.length - 1 && !m.text;
  }

  const handleSend = useCallback(() => {
    if (isThinking) return;
    const txt = composerText.trim();
    if (!txt && !attachment) return;
    if (attachment) {
      sendBuilderMessage(
        frameBuilderKnowledgeFileMessage(attachment.name, attachment.text.length, attachment.truncated, txt),
        { knowledgeFile: attachment }
      );
    } else {
      sendBuilderMessage(txt);
    }
    setComposerText("");
    setAttachment(null);
    setAttachError(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [composerText, attachment, sendBuilderMessage, isThinking]);

  const handleFilePick = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setAttachError(null);
    setAttaching(true);
    try {
      const doc = await extractDocumentText(file);
      setAttachment(doc);
    } catch (err) {
      setAttachment(null);
      setAttachError((err as Error).message || "Impossible de lire ce document.");
    } finally {
      setAttaching(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isThinking) handleSend();
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setComposerText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 90) + "px";
  }

  const lastAgentIndex = (() => {
    for (let i = currentDraft.builderConversation.length - 1; i >= 0; i--) {
      if (currentDraft.builderConversation[i].role === "agent") return i;
    }
    return -1;
  })();

  function renderMessage(m: ConversationMessage, i: number) {
    if (m.role === "config-proposal" && m.configProposal) {
      const cfg = m.configProposal;
      const model = (id?: string) => MODEL_CATALOG.find((mm) => mm.id === id)?.label ?? id;
      if (m.configProposalStatus === "applied") {
        return (
          <div key={i} className={styles.connectorDone}>
            ✓ Configuration appliquée au gent{cfg.name ? ` — ${cfg.name}` : ""}
          </div>
        );
      }
      if (m.configProposalStatus === "dismissed") {
        return (
          <div key={i} className={styles.connectorDismissed}>
            Configuration proposée ignorée
          </div>
        );
      }
      return (
        <div key={i} className={styles.connectorCard}>
          <div className={styles.connectorKind}>⚙️ Configuration proposée</div>
          <ul className={styles.configList}>
            {cfg.name && <li><b>Nom :</b> {cfg.name}</li>}
            {cfg.objective && <li><b>Objectif :</b> {cfg.objective}</li>}
            {cfg.systemPrompt && (
              <li>
                <b>Prompt système :</b>{" "}
                {cfg.systemPrompt.length > 180 ? `${cfg.systemPrompt.slice(0, 180)}…` : cfg.systemPrompt}
              </li>
            )}
            {cfg.chatModelId && <li><b>Modèle conversationnel :</b> {model(cfg.chatModelId)}</li>}
            {cfg.reasoningModelId && <li><b>Modèle de raisonnement :</b> {model(cfg.reasoningModelId)}</li>}
            {cfg.webSearch !== undefined && (
              <li><b>Recherche web :</b> {cfg.webSearch ? "activée" : "désactivée"}</li>
            )}
            {cfg.connectors?.map((c) => (
              <li key={c.url}>
                <b>Connecteur :</b>{" "}
                {c.kind === "dataset" ? "🗺️" : c.kind === "mcp" ? "🔗" : c.kind === "prim" ? "🚌" : c.kind === "powens" ? "🏦" : "🌐"} {c.name}
                {c.kind === "api-rest" && c.restConfig ? (
                  <>
                    <span className={styles.connectorUrl}>
                      {" "}
                      {c.restConfig.method} {c.restConfig.baseUrl}
                    </span>
                    {c.restConfig.modelParams?.length ? (
                      <span className={styles.connectorUrl}>
                        {" "}
                        · paramètres : {c.restConfig.modelParams.map((p) => p.name).join(", ")}
                      </span>
                    ) : null}
                    {c.restConfig.auth?.mode === "api-key" ? (
                      <span className={styles.connectorUrl}> · clé : {c.restConfig.auth.value || "à définir"}</span>
                    ) : null}
                  </>
                ) : (
                  <span className={styles.connectorUrl}> {c.url}</span>
                )}
              </li>
            ))}
          </ul>
          <div className={styles.connectorActions}>
            <button
              type="button"
              className={styles.connectorAddBtn}
              onClick={() => applyGentConfig(m.id ?? "", "apply")}
            >
              Appliquer la configuration
            </button>
            <button
              type="button"
              className={styles.connectorDismissBtn}
              onClick={() => applyGentConfig(m.id ?? "", "dismiss")}
            >
              Ignorer
            </button>
          </div>
        </div>
      );
    }

    if (m.role === "jump-form-proposal" && m.jumpFormProposal) {
      const form = m.jumpFormProposal;
      if (m.jumpFormProposalStatus === "applied") {
        return (
          <div key={i} className={styles.connectorDone}>
            ✓ Formulaire jump ajouté — « {form.title} » ({form.fields.length} champ
            {form.fields.length > 1 ? "s" : ""}). Il apparaîtra au démarrage d&apos;une conversation côté utilisateur.
          </div>
        );
      }
      if (m.jumpFormProposalStatus === "dismissed") {
        return (
          <div key={i} className={styles.connectorDismissed}>
            Formulaire jump ignoré
          </div>
        );
      }
      return (
        <div key={i} className={styles.connectorCard}>
          <div className={styles.connectorKind}>🗂️ Formulaire jump proposé</div>
          <div className={styles.connectorName}>{form.title}</div>
          {form.description && <div className={styles.connectorUrl}>{form.description}</div>}
          <ul className={styles.configList}>
            {form.fields.map((f) => (
              <li key={f.id}>
                <b>{f.label}</b>
                {f.required ? " *" : ""} — {f.kind}
                {f.kind === "select" && f.options?.length ? ` (${f.options.join(", ")})` : ""}
              </li>
            ))}
          </ul>
          <div className={styles.connectorActions}>
            <button
              type="button"
              className={styles.connectorAddBtn}
              onClick={() => applyJumpForm(m.id ?? "", "apply")}
            >
              Ajouter ce formulaire
            </button>
            <button
              type="button"
              className={styles.connectorDismissBtn}
              onClick={() => applyJumpForm(m.id ?? "", "dismiss")}
            >
              Ignorer
            </button>
          </div>
        </div>
      );
    }

    if (m.role === "connector-proposal" && m.connectorSuggestions?.length) {
      const list = m.connectorSuggestions;
      const msgId = m.id ?? "";
      if (m.connectorSuggestionsStatus === "applied") {
        return (
          <button key={i} className={styles.connectorDone} onClick={() => switchTab("connectors")}>
            ✓ Connecteurs configurés — voir l&apos;onglet Connecteurs
          </button>
        );
      }
      if (m.connectorSuggestionsStatus === "dismissed") {
        return (
          <div key={i} className={styles.connectorDismissed}>
            Suggestions de connecteurs ignorées
          </div>
        );
      }
      const checks = suggestionChecks[msgId] ?? Object.fromEntries(list.map((s) => [s.url, true]));
      const selectedUrls = list.filter((s) => checks[s.url]).map((s) => s.url);
      return (
        <div key={i} className={styles.connectorCard}>
          <div className={styles.connectorKind}>🔎 Connecteurs identifiés (recherche web)</div>
          {list.map((s) => (
            <label key={s.url} className={styles.suggestionRow}>
              <input
                type="checkbox"
                checked={!!checks[s.url]}
                onChange={(e) =>
                  setSuggestionChecks((prev) => ({ ...prev, [msgId]: { ...checks, [s.url]: e.target.checked } }))
                }
              />
              <span className={styles.suggestionInfo}>
                <span className={styles.connectorName}>
                  {s.kind === "dataset" ? "🗺️" : s.kind === "mcp" ? "🔗" : "🌐"} {s.name}
                </span>
                {s.description && <span className={styles.suggestionDesc}>{s.description}</span>}
                <span className={styles.suggestionEval}>🛡️ {s.security}</span>
                <span className={styles.suggestionEval}>⚖️ {s.stability}</span>
                <span className={styles.connectorUrl}>{s.url}</span>
              </span>
            </label>
          ))}
          <div className={styles.connectorActions}>
            <button
              type="button"
              className={styles.connectorAddBtn}
              disabled={!selectedUrls.length}
              onClick={() => confirmConnectorSuggestions(msgId, selectedUrls)}
            >
              Configurer la sélection ({selectedUrls.length})
            </button>
            <button
              type="button"
              className={styles.connectorDismissBtn}
              onClick={() => confirmConnectorSuggestions(msgId, [])}
            >
              Tout ignorer
            </button>
          </div>
        </div>
      );
    }

    if (m.role === "connector-proposal" && m.connectorProposal) {
      const p = m.connectorProposal;
      const kindLabel = p.kind === "dataset" ? "Dataset open data" : "Serveur MCP";
      if (m.connectorProposalStatus === "added") {
        return (
          <button key={i} className={styles.connectorDone} onClick={() => switchTab("connectors")}>
            ✓ Connecteur « {p.name} » ajouté — voir l&apos;onglet Connecteurs
          </button>
        );
      }
      if (m.connectorProposalStatus === "dismissed") {
        return (
          <div key={i} className={styles.connectorDismissed}>
            Proposition de connecteur ignorée — {p.name}
          </div>
        );
      }
      return (
        <div key={i} className={styles.connectorCard}>
          <div className={styles.connectorKind}>{p.kind === "dataset" ? "🗺️" : "🔗"} {kindLabel}</div>
          <div className={styles.connectorName}>{p.name}</div>
          <div className={styles.connectorUrl}>{p.url}</div>
          <div className={styles.connectorActions}>
            <button
              type="button"
              className={styles.connectorAddBtn}
              onClick={() => confirmConnectorProposal(m.id ?? "", "add")}
            >
              Ajouter ce connecteur
            </button>
            <button
              type="button"
              className={styles.connectorDismissBtn}
              onClick={() => confirmConnectorProposal(m.id ?? "", "dismiss")}
            >
              Ignorer
            </button>
          </div>
        </div>
      );
    }

    const isUser = m.role === "user";
    const isLastMessage = i === lastAgentIndex;
    const live = isThinking && i === currentDraft.builderConversation.length - 1 && !isUser && !m.text;
    const open = isReasoningOpen(i, m);
    return (
      <div key={i} className={[styles.msg, isUser ? styles.msgUser : styles.msgAgent].join(" ")}>
        <div className={styles.av}>{isUser ? "V" : "🛠️"}</div>
        <div>
          {!isUser && (m.reasoning || live) && (
            <>
              <button
                type="button"
                className={[styles.reasoningToggle, live ? styles.reasoningLive : ""].filter(Boolean).join(" ")}
                onClick={() => toggleReasoning(i)}
                aria-expanded={open}
              >
                <span className={[styles.reasoningChevron, open ? styles.reasoningChevronOpen : ""].filter(Boolean).join(" ")} aria-hidden="true">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </span>
                {live ? thinkingStatus ?? "Réflexion en cours…" : "Raisonnement du modèle"}
              </button>
              {open && (
                <div className={styles.reasoningBox}>
                  {m.reasoning || (live ? "Le modèle analyse votre demande…" : "")}
                </div>
              )}
            </>
          )}
          <div className={styles.bubble}>
            <SafeHTML html={m.text ?? ""} />
          </div>
          <div className={styles.t}>{m.t}</div>
          {!isUser && (
            <button
              className={styles.insertBtn}
              onClick={() => applyBuilderSuggestion(stripTags(m.text ?? ""))}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Insérer dans le prompt système
            </button>
          )}
          {!isUser && isLastMessage && !!m.questions?.length && (
            <QuickReplyQuestions questions={m.questions} onSubmit={sendBuilderMessage} />
          )}
        </div>
      </div>
    );
  }

  if (assistantCollapsed && !fullscreen) {
    return (
      <section className={styles.collapsedStrip} aria-label="Assistant du builder (réduit)" id="builder-assistant">
        <button
          type="button"
          className={styles.expandBtn}
          onClick={toggleAssistant}
          title="Rouvrir l'assistant du builder"
          aria-label="Rouvrir l'assistant du builder"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 6l-6 6 6 6" />
          </svg>
        </button>
        <span className={styles.collapsedLabel}>Assistant</span>
        <span className={styles.collapsedIc} aria-hidden="true">🛠️</span>
      </section>
    );
  }

  return (
    <section
      className={[styles.panel, fullscreen ? styles.panelFullscreen : ""].filter(Boolean).join(" ")}
      aria-label="Assistant du builder"
      id="builder-assistant"
    >
      {!fullscreen && <div className={styles.resizeHandle} ref={handleRef} title="Glisser pour redimensionner, cliquer pour replier" />}

      <div className={styles.head}>
        <div className={styles.headIc}>🛠️</div>
        <div className={styles.headMeta}>
          <h3 className={styles.headTitle}>Assistant du builder</h3>
          <div className={styles.headSub}>Vous aide à concevoir {currentDraft.name || "ce gent"}</div>
        </div>
        <button
          type="button"
          className={styles.newConvBtn}
          onClick={() => {
            startNewBuilderConversation();
            setComposerText("");
            setAttachment(null);
            setAttachError(null);
            setExpandedReasoning({});
          }}
          title="Démarrer une nouvelle discussion avec l'assistant"
          disabled={!currentDraft.builderConversation.length && !isThinking}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nouvelle discussion
        </button>
        <ReportMenu getMarkdown={() => buildBuilderReport(currentDraft)} baseName={currentDraft.name} />
        <button
          type="button"
          className={styles.reportBtn}
          onClick={() => setFullscreen((v) => !v)}
          title={fullscreen ? "Quitter le plein écran" : "Étendre la conversation en plein écran"}
          aria-label={fullscreen ? "Quitter le plein écran" : "Plein écran"}
        >
          {fullscreen ? "🗗" : "⛶"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 16px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)" }}>
          <span style={{ flex: 1 }}>Modèle de l&apos;assistant builder</span>
          <strong style={{ color: "var(--ink)", fontWeight: 600 }}>{assistantModelLabel}</strong>
          <span style={{ fontSize: 10, color: "var(--sage-700)", background: "var(--sage-tint)", padding: "2px 6px", borderRadius: 4 }}>
            prioritaire
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label htmlFor="builder-chat-model" style={{ flex: 1, fontSize: 12, color: "var(--muted)" }}>Modèle conversationnel du gent (publié)</label>
        <select
          id="builder-chat-model"
          value={gentChatModelId}
          onChange={(e) => assignModel("chat", e.target.value)}
          style={{
            background: "var(--bg)",
            border: "1px solid var(--line)",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 12,
            color: "var(--ink)",
          }}
        >
          {CHAT_MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
        </div>
      </div>

      <div className={styles.scope}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6z" />
        </svg>
        <span>Spécifique à Getgents — vous aide à rédiger le prompt, choisir les modèles et connecteurs.</span>
      </div>

      <div className={styles.body} ref={bodyRef}>
        {currentDraft.builderConversation.length ? (
          currentDraft.builderConversation.map((m, i) => renderMessage(m, i))
        ) : (
          <div className={styles.empty}>Décrivez l&apos;objectif de ce gent pour commencer.</div>
        )}
        {isThinking && <ThinkingIndicator label={thinkingStatus ?? "Réflexion en cours…"} />}
      </div>

      <div className={styles.composerWrap}>
        {attaching && (
          <div className={styles.attachLoading}>
            <span aria-hidden="true">⏳</span> Lecture du document…
          </div>
        )}
        {attachError && <div className={styles.attachError}>{attachError}</div>}
        {attachment && !attaching && (
          <div className={styles.attachChip}>
            <span className={styles.attachChipIcon} aria-hidden="true">
              📎
            </span>
            <div className={styles.attachChipBody}>
              <div className={styles.attachChipName}>{attachment.name}</div>
              <div className={styles.attachChipMeta}>
                {attachment.text.length.toLocaleString("fr-FR")} caractères
                {attachment.truncated ? " (tronqué)" : ""} · ajouté aux connaissances au prochain envoi
              </div>
            </div>
            <button
              type="button"
              className={styles.attachChipRemove}
              onClick={() => setAttachment(null)}
              aria-label="Retirer le document"
            >
              ✕
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,.csv,.tsv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv"
          style={{ display: "none" }}
          onChange={(e) => handleFilePick(e.target.files?.[0])}
        />
        <div className={styles.composer}>
          <button
            type="button"
            className={styles.attachBtn}
            aria-label="Ajouter un fichier aux connaissances du gent (PDF, Word, texte)"
            title="Ajouter un fichier aux connaissances du gent (PDF, Word, texte)"
            disabled={attaching || isThinking}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <textarea
            ref={textareaRef}
            className={styles.composerTextarea}
            rows={1}
            placeholder={
              attachment
                ? "Ajouter un message (facultatif)…"
                : "Décrivez ce que ce gent doit faire…"
            }
            aria-label="Votre message à l'assistant du builder"
            value={composerText}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
          />
          {isThinking ? (
            <button
              type="button"
              className={styles.stopBtn}
              aria-label="Arrêter la génération"
              title="Arrêter"
              onClick={stopGeneration}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              className={styles.sendBtn}
              aria-label="Envoyer"
              disabled={!composerText.trim() && !attachment}
              onClick={handleSend}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          )}
        </div>
        <div className={styles.aiDisclosure}>
          Vous interagissez avec une IA. Vérifiez les suggestions avant publication.
        </div>
      </div>
    </section>
  );
}
