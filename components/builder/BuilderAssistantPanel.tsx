"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { SafeHTML } from "@/components/shared/SafeHTML";
import { QuickReplyQuestions } from "@/components/shared/QuickReplyQuestions";
import { MODEL_CATALOG } from "@/lib/mock-data/builder";
import type { ConversationMessage } from "@/lib/types";
import { setBuilderAssistWidthFromPointer, canResizeAssist } from "@/lib/assistResize";
import styles from "./BuilderAssistantPanel.module.css";

const CHAT_MODELS = MODEL_CATALOG.filter((m) => m.capability === "chat");

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

export function BuilderAssistantPanel() {
  const { currentDraft, sendBuilderMessage, applyBuilderSuggestion, assignModel } = useBuilder();
  const [composerText, setComposerText] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  // Drag-to-resize (edge handle) — même mécanique que le panneau assistant
  // côté espace, sur une variable CSS dédiée (--builder-assist).
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    let dragging = false;

    function onMove(e: MouseEvent) {
      if (!dragging) return;
      setBuilderAssistWidthFromPointer(e.clientX);
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      handle!.classList.remove(styles.handleActive);
      document.body.classList.remove("col-resizing");
    }

    function onDown(e: MouseEvent) {
      if (!canResizeAssist()) return;
      dragging = true;
      handle!.classList.add(styles.handleActive);
      document.body.classList.add("col-resizing");
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

  const chatModelId =
    currentDraft.modelAssignments.find((a) => a.capability === "chat")?.modelId ??
    CHAT_MODELS[0]?.id ??
    "";

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [currentDraft.builderConversation]);

  const handleSend = useCallback(() => {
    const txt = composerText.trim();
    if (!txt) return;
    sendBuilderMessage(txt);
    setComposerText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [composerText, sendBuilderMessage]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setComposerText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 90) + "px";
  }

  function renderMessage(m: ConversationMessage, i: number) {
    const isUser = m.role === "user";
    const isLastMessage = i === currentDraft.builderConversation.length - 1;
    return (
      <div key={i} className={[styles.msg, isUser ? styles.msgUser : styles.msgAgent].join(" ")}>
        <div className={styles.av}>{isUser ? "V" : "🛠️"}</div>
        <div>
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

  return (
    <section className={styles.panel} aria-label="Assistant du builder" id="builder-assistant">
      <div className={styles.resizeHandle} ref={handleRef} title="Glisser pour redimensionner" />

      <div className={styles.head}>
        <div className={styles.headIc}>🛠️</div>
        <div className={styles.headMeta}>
          <h3 className={styles.headTitle}>Assistant du builder</h3>
          <div className={styles.headSub}>Vous aide à concevoir {currentDraft.name || "ce gent"}</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: "1px solid var(--line)" }}>
        <label htmlFor="builder-chat-model" style={{ flex: 1, fontSize: 12, color: "var(--muted)" }}>Modèle conversationnel</label>
        <select
          id="builder-chat-model"
          value={chatModelId}
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
      </div>

      <div className={styles.composerWrap}>
        <div className={styles.composer}>
          <textarea
            ref={textareaRef}
            className={styles.composerTextarea}
            rows={1}
            placeholder="Décrivez ce que ce gent doit faire…"
            aria-label="Votre message à l'assistant du builder"
            value={composerText}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
          />
          <button
            className={styles.sendBtn}
            aria-label="Envoyer"
            disabled={!composerText.trim()}
            onClick={handleSend}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
        <div className={styles.aiDisclosure}>
          Vous interagissez avec une IA. Vérifiez les suggestions avant publication.
        </div>
      </div>
    </section>
  );
}
