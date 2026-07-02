"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { SafeHTML } from "@/components/shared/SafeHTML";
import type { ConversationMessage } from "@/lib/types";
import styles from "./BuilderAssistantPanel.module.css";

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

export function BuilderAssistantPanel() {
  const { currentDraft, sendBuilderMessage, applyBuilderSuggestion } = useBuilder();
  const [composerText, setComposerText] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        </div>
      </div>
    );
  }

  return (
    <section className={styles.panel} aria-label="Assistant du builder" id="builder-assistant">
      <div className={styles.head}>
        <div className={styles.headIc}>🛠️</div>
        <div className={styles.headMeta}>
          <h3 className={styles.headTitle}>Assistant du builder</h3>
          <div className={styles.headSub}>Vous aide à concevoir {currentDraft.name || "ce gent"}</div>
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
