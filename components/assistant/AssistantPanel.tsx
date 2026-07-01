"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useEspace } from "@/lib/context/EspaceContext";
import { SafeHTML } from "@/components/shared/SafeHTML";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ConversationMessage } from "@/lib/types";

const HANDLE_ACTIVE_CLASS = "bg-primary-tint [&::after]:bg-primary";

export function AssistantPanel() {
  const {
    currentEspace,
    closeAssistant,
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
      handle!.classList.remove(...HANDLE_ACTIVE_CLASS.split(" "));
      document.body.classList.remove("col-resizing");
    }

    function onDown(e: MouseEvent) {
      dragging = true;
      handle!.classList.add(...HANDLE_ACTIVE_CLASS.split(" "));
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
        <div key={i} className="mb-5 ml-[39px] max-w-[78%]">
          <div className="flex items-center gap-[7px] text-[11.5px] font-medium text-muted-foreground">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 7l-5 5 5 5M3 12h11" />
            </svg>
            Le gent a utilisé une intégration
          </div>
          <div className="mt-1.5 flex items-center gap-2.5 rounded-[10px] border border-border bg-card px-3 py-2.5 text-[12.5px]">
            <span className="rounded-[5px] bg-primary-tint px-[7px] py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wide text-primary-hover">
              {m.kind}
            </span>
            <span className="flex-1 text-foreground">{m.what}</span>
            <span className="text-sm text-primary">✓</span>
          </div>
        </div>
      );
    }

    if (m.role === "artef-visual") {
      const a = currentEspace.artefacts.find((x) => x.id === m.ref);
      if (!a) return null;
      return (
        <button
          key={i}
          className="mb-5 ml-[39px] block max-w-[78%] rounded-xl border border-border bg-card p-[13px] text-left transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(21,33,43,0.08)]"
          onClick={() => openArtefactModal(a.id)}
        >
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-primary-hover">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            {a.type}
          </div>
          <div className="my-1 text-[14.5px] font-semibold tracking-tight">{a.title}</div>
          <VisualGrid />
          <div className="mt-2 text-[11.5px] text-muted-foreground">{a.date} · illustration stylisée, pas une photo</div>
        </button>
      );
    }

    if (m.role === "artef-pointer") {
      const isSent = m.status === "sent";
      return (
        <button
          key={i}
          className="mb-5 ml-[39px] flex w-auto max-w-[78%] items-center gap-2.5 rounded-[10px] border border-border bg-card px-[13px] py-[11px] text-left hover:border-primary"
          onClick={() => jumpToTab(m.tab ?? "")}
        >
          <div className={cn("grid h-7 w-7 flex-none place-items-center rounded-[7px] text-sm", isSent ? "bg-accent" : "bg-secondary")}>
            {m.icon}
          </div>
          <div className="min-w-0 flex-1 text-[12.5px]">
            <div className="font-semibold text-foreground">{m.title}</div>
          </div>
          <div className="flex items-center gap-[3px] whitespace-nowrap text-[11px] font-semibold text-primary-hover">
            {m.link}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </button>
      );
    }

    const isUser = m.role === "user";
    return (
      <div key={i} className={cn("mb-5 flex gap-[11px]", isUser && "flex-row-reverse")}>
        <div
          className={cn(
            "grid h-7 w-7 flex-none place-items-center rounded-lg text-[13px] font-semibold",
            isUser ? "rounded-full bg-accent text-accent-foreground" : "bg-primary text-white"
          )}
        >
          {m.role === "agent" ? "🤖" : "CL"}
        </div>
        <div
          className={cn(
            "max-w-[78%] rounded-2xl px-3.5 py-[11px] text-sm",
            isUser
              ? "rounded-tr-[5px] bg-primary-hover text-white/95"
              : "rounded-tl-[5px] border border-border bg-card"
          )}
        >
          <SafeHTML html={m.text ?? ""} />
          <div className={cn("mt-[7px] text-[10.5px]", isUser ? "text-white/60" : "text-faint")}>{m.t}</div>
        </div>
      </div>
    );
  }

  function renderHist() {
    const items = currentEspace.conversation.filter((m) => m.role === "user" || m.role === "agent");
    if (!items.length) {
      return <div className="pt-[30px] text-center text-[12.5px] text-muted-foreground">Aucun échange pour l&apos;instant.</div>;
    }
    return (
      <div className="flex flex-col gap-2">
        {items.map((m, i) => (
          <div key={i} className="rounded-[10px] border border-border bg-background p-2.5 text-left hover:border-primary">
            <div className="text-[12.5px] font-semibold">{m.role === "agent" ? "🤖 Le gent" : "Vous"}</div>
            <div className="mt-[3px] text-[11.5px] leading-relaxed text-muted-foreground">
              {stripTags(m.text ?? "").slice(0, 140)}
            </div>
            <div className="mt-[5px] text-[10.5px] text-faint">{m.t}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="relative flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-border bg-card" aria-label="Assistant" aria-modal="false">
      <div
        ref={handleRef}
        title="Glisser pour redimensionner"
        className={cn(
          "absolute -right-[3px] top-0 bottom-0 z-20 w-[7px] cursor-col-resize bg-transparent hover:bg-primary-tint",
          "after:absolute after:left-1/2 after:top-1/2 after:h-8 after:w-[3px] after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-[3px] after:bg-border hover:after:bg-primary"
        )}
      />

      <div className="flex flex-none items-center gap-[11px] border-b border-border p-4">
        <div className="grid h-[34px] w-[34px] flex-none place-items-center rounded-lg bg-primary text-base text-white">
          {currentEspace.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap font-display text-[15px] font-bold tracking-tight">
            {currentEspace.gent}
          </h3>
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-muted-foreground">
            {currentEspace.name}
          </div>
        </div>
        <button
          className="grid h-[30px] w-[30px] flex-none place-items-center rounded-lg text-muted-foreground hover:bg-background"
          onClick={closeAssistant}
          aria-label="Fermer l'assistant"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-none items-center gap-[7px] border-b border-muted bg-primary-tint px-[18px] py-2.5 text-[11px] text-primary-hover">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-none">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
        <span>L&apos;assistant couvre tout le gent — naviguez librement entre les onglets pendant que vous échangez.</span>
      </div>

      <Tabs value={cdView} onValueChange={(v) => setCdView(v as "chat" | "hist")} className="flex-none border-b border-muted px-3">
        <TabsList className="h-auto bg-transparent p-0">
          <TabsTrigger value="chat" className="rounded-t-none px-[11px] py-2.5 text-[12.5px]">
            Conversation
          </TabsTrigger>
          <TabsTrigger value="hist" className="rounded-t-none px-[11px] py-2.5 text-[12.5px]">
            Historique
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="min-h-0 flex-1 overflow-y-auto p-[18px]" ref={bodyRef}>
        {cdView === "hist"
          ? renderHist()
          : currentEspace.conversation.length
          ? currentEspace.conversation.map((m, i) => renderMessage(m, i))
          : <div className="pt-[30px] text-center text-[12.5px] text-muted-foreground">Aucun échange pour l&apos;instant.</div>}
      </div>

      {cdView === "chat" && (
        <div className="flex-none border-t border-border px-3.5 pb-3.5 pt-2.5">
          <div
            className={cn(
              "flex items-end gap-[7px] rounded-2xl border border-border bg-background py-1.5 pl-3.5 pr-1.5 focus-within:border-primary"
            )}
          >
            <textarea
              ref={textareaRef}
              className="max-h-[90px] flex-1 resize-none border-none bg-transparent py-1.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-faint"
              rows={1}
              placeholder="Écrire à votre assistant…"
              aria-label="Votre message"
              value={composerText}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
            />
            <button
              className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full bg-primary text-white hover:bg-primary-hover disabled:bg-border disabled:text-faint"
              aria-label="Envoyer"
              disabled={!composerText.trim()}
              onClick={handleSend}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
          <div className="pt-1.5 text-center text-[10px] text-faint">
            Vous interagissez avec une IA. Vérifiez les informations importantes.
          </div>
        </div>
      )}
    </section>
  );
}

function VisualGrid() {
  return (
    <div className="grid grid-cols-[1.4fr_1fr_1fr] grid-rows-[90px_90px] gap-1.5 [&_>_div:first-child]:row-span-2 [&_svg]:block [&_svg]:h-full [&_svg]:w-full [&_svg]:rounded-lg">
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
