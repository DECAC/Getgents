"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useEspace } from "@/lib/context/EspaceContext";
import { SafeHTML } from "@/components/shared/SafeHTML";
import type { ConversationMessage } from "@/lib/types";
import styles from "./AssistantPanel.module.css";

export function AssistantPanel() {
  const {
    currentEspace,
    closeAssistant,
    pinAside,
    switchTab,
    espaces,
    currentId,
    openArtefactModal,
    sendMessage,
  } = useEspace();

  const [cdView, setCdView] = useState<"chat" | "hist">("chat");
  const [composerText, setComposerText] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [currentEspace.conversation, cdView]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Drag-to-resize
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    let dragging = false;

    function clamp(px: number) {
      const min = 320;
      const max = Math.round(window.innerWidth * 0.75);
      return Math.max(min, Math.min(max, px));
    }

    function onMove(e: MouseEvent) {
      if (!dragging) return;
      const rail = document.getElementById("rail");
      const railWidth = rail ? rail.getBoundingClientRect().width : 248;
      const px = clamp(e.clientX - railWidth);
      document.documentElement.style.setProperty("--assist", px + "px");
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      handle!.classList.remove(styles.handleActive);
      document.body.classList.remove("col-resizing");
    }

    function onDown(e: MouseEvent) {
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

  const handleSend = useCallback(() => {
    const txt = composerText.trim();
    if (!txt) return;
    sendMessage(txt);
    setComposerText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [composerText, sendMessage]);

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

  function jumpToTab(tabId: string) {
    const idx = currentEspace.tabs.findIndex((t) => t.id === tabId);
    if (idx >= 0) switchTab(idx);
  }

  function renderMessage(m: ConversationMessage, i: number) {
    if (m.role === "tool") {
      return (
        <div key={i} className={styles.toolcall}>
          <div className={styles.toolHead}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 7l-5 5 5 5M3 12h11" />
            </svg>
            Le gent a utilisé une intégration
          </div>
          <div className={styles.toolChip}>
            <span className={styles.toolKind}>{m.kind}</span>
            <span className={styles.toolWhat}>{m.what}</span>
            <span className={styles.toolOk}>✓</span>
          </div>
        </div>
      );
    }

    if (m.role === "artef-visual") {
      const a = currentEspace.artefacts.find((x) => x.id === m.ref);
      if (!a) return null;
      return (
        <button key={i} className={styles.artefVisual} onClick={() => openArtefactModal(a.id)}>
          <div className={styles.artefVisualLab}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            {a.type}
          </div>
          <div className={styles.artefVisualTitle}>{a.title}</div>
          <VisualGrid />
          <div className={styles.artefMeta}>{a.date} · illustration stylisée, pas une photo</div>
        </button>
      );
    }

    if (m.role === "artef-pointer") {
      const cls = m.status === "sent" ? styles.picSent : styles.picPending;
      return (
        <button key={i} className={styles.artefPointer} onClick={() => jumpToTab(m.tab ?? "")}>
          <div className={[styles.pic, cls].join(" ")}>{m.icon}</div>
          <div className={styles.ptext}>
            <div className={styles.ptitle}>{m.title}</div>
          </div>
          <div className={styles.plink}>
            {m.link}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </button>
      );
    }

    return (
      <div key={i} className={[styles.msg, m.role === "user" ? styles.msgUser : styles.msgAgent].join(" ")}>
        <div className={styles.av}>{m.role === "agent" ? "🤖" : "CL"}</div>
        <div className={styles.bubble}>
          <SafeHTML html={m.text ?? ""} />
          <div className={styles.t}>{m.t}</div>
        </div>
      </div>
    );
  }

  function renderHist() {
    const items = currentEspace.conversation.filter((m) => m.role === "user" || m.role === "agent");
    if (!items.length) {
      return <div className={styles.empty}>Aucun échange pour l'instant.</div>;
    }
    return (
      <div className={styles.histList}>
        {items.map((m, i) => (
          <div key={i} className={styles.histItem}>
            <div className={styles.hname}>{m.role === "agent" ? "🤖 Le gent" : "Vous"}</div>
            <div className={styles.hsnip}>{stripTags(m.text ?? "").slice(0, 140)}</div>
            <div className={styles.hmeta}>{m.t}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className={styles.panel} aria-label="Assistant" aria-modal="false">
      <div className={styles.resizeHandle} ref={handleRef} title="Glisser pour redimensionner" />

      <div className={styles.head}>
        <div className={styles.headIc}>{currentEspace.icon}</div>
        <div className={styles.headMeta}>
          <h3 className={styles.headTitle}>{currentEspace.gent}</h3>
          <div className={styles.headSub}>{currentEspace.name}</div>
        </div>
        <button className={styles.closeBtn} onClick={closeAssistant} aria-label="Fermer l'assistant">
          ✕
        </button>
      </div>

      <div className={styles.scope}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
        <span>L'assistant couvre tout le gent — naviguez librement entre les onglets pendant que vous échangez.</span>
      </div>

      <div className={styles.tabs}>
        <button
          className={[styles.tab, cdView === "chat" ? styles.tabOn : ""].filter(Boolean).join(" ")}
          onClick={() => setCdView("chat")}
        >
          Conversation
        </button>
        <button
          className={[styles.tab, cdView === "hist" ? styles.tabOn : ""].filter(Boolean).join(" ")}
          onClick={() => setCdView("hist")}
        >
          Historique
        </button>
      </div>

      <div className={styles.body} ref={bodyRef}>
        {cdView === "hist"
          ? renderHist()
          : currentEspace.conversation.length
          ? currentEspace.conversation.map((m, i) => renderMessage(m, i))
          : <div className={styles.empty}>Aucun échange pour l'instant.</div>}
      </div>

      {cdView === "chat" && (
        <div className={styles.composerWrap}>
          <div className={[styles.composer, !composerText.trim() ? styles.composerOff : ""].join(" ")}>
            <textarea
              ref={textareaRef}
              className={styles.composerTextarea}
              rows={1}
              placeholder="Écrire à votre assistant…"
              aria-label="Votre message"
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
            Vous interagissez avec une IA. Vérifiez les informations importantes.
          </div>
        </div>
      )}
    </section>
  );
}

function VisualGrid() {
  return (
    <div className={styles.visualGrid}>
      <div>
        <svg viewBox="0 0 200 190">
          <rect width="200" height="190" fill="#CFE0DD" />
          <rect y="120" width="200" height="70" fill="#A9C6BE" />
          <rect x="20" y="80" width="26" height="44" fill="#E8C66B" />
          <rect x="52" y="70" width="26" height="54" fill="#E0A05C" />
          <rect x="84" y="88" width="26" height="36" fill="#D88B7A" />
          <rect x="116" y="74" width="26" height="50" fill="#E8C66B" />
          <rect x="148" y="92" width="26" height="32" fill="#C97A6A" />
          <circle cx="160" cy="35" r="16" fill="#F2DDA0" />
        </svg>
      </div>
      <div>
        <svg viewBox="0 0 95 90">
          <rect width="95" height="90" fill="#B9D4D8" />
          <path d="M0 60 L30 35 L60 55 L95 30 L95 90 L0 90 Z" fill="#7FA8A0" />
        </svg>
      </div>
      <div>
        <svg viewBox="0 0 95 90">
          <rect width="95" height="90" fill="#E4D9C4" />
          <circle cx="48" cy="45" r="22" fill="none" stroke="#B7956A" strokeWidth="3" />
          <path d="M20 70 Q48 50 76 70" fill="none" stroke="#9C7B52" strokeWidth="3" />
        </svg>
      </div>
    </div>
  );
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}
