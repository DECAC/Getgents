"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useEspace } from "@/lib/context/EspaceContext";
import { SafeHTML } from "@/components/shared/SafeHTML";
import { QuickReplyQuestions } from "@/components/shared/QuickReplyQuestions";
import { JumpFormCard } from "@/components/shared/JumpFormCard";
import { MiniBarChart } from "@/components/shared/MiniBarChart";
import { MapAppModal, type MapDestination } from "@/components/shared/MapAppModal";
import type { ConversationMessage, Espace } from "@/lib/types";
import { setAssistWidthFromPointer } from "@/lib/assistResize";
import { threadPreview, threadLastActivity } from "@/lib/conversationUtils";
import { buildEspaceReport } from "@/lib/testReport";
import { ReportMenu } from "@/components/shared/ReportMenu";
import styles from "./AssistantPanel.module.css";

const PROPOSAL_KIND_LABEL: Record<string, string> = {
  report: "Rapport",
  checklist: "Checklist",
  chart: "Graphique",
  visual: "Aperçu visuel",
  map: "Carte",
};

/** Titre lisible d'un module (même convention d'id que ModuleCanvas.tsx : tab-<id>, map, artef-<id>). */
function moduleTitle(espace: Espace, moduleId: string): string {
  if (moduleId === "map") return espace.map?.title ?? "Carte";
  if (moduleId.startsWith("tab-")) {
    const id = moduleId.slice(4);
    return espace.tabs.find((t) => t.id === id)?.name ?? moduleId;
  }
  if (moduleId.startsWith("artef-")) {
    const id = moduleId.slice(6);
    return espace.artefacts.find((a) => a.id === id)?.title ?? moduleId;
  }
  return moduleId;
}

function themeTabLabel(espace: Espace, tabId: string): string {
  return espace.themeTabs?.find((t) => t.id === tabId)?.label ?? "cet onglet";
}

export function AssistantPanel() {
  const {
    currentEspace,
    activeConversation,
    closeAssistant,
    switchTab,
    openArtefactModal,
    sendMessage,
    submitJumpForm,
    confirmArtefactProposal,
    confirmThemeProposal,
    startNewConversation,
    switchConversation,
    isThinking,
    geoStatus,
    confirmGeoRequest,
  } = useEspace();

  const [cdView, setCdView] = useState<"chat" | "hist">("chat");
  const [jumpFormOpen, setJumpFormOpen] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [expandedReasoning, setExpandedReasoning] = useState<Record<number, boolean>>({});
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [mapDestination, setMapDestination] = useState<MapDestination | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [activeConversation.messages, cdView]);

  useEffect(() => {
    setExpandedReasoning({});
  }, [activeConversation.id]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--assist", "30vw");
  }, []);

  // Drag-to-resize (edge handle)
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    let dragging = false;

    function onMove(e: MouseEvent) {
      if (!dragging) return;
      setAssistWidthFromPointer(e.clientX);
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

  // Intercepte les clics sur les adresses cliquables émises par le gent
  // (<a href="geo:lat,lon" data-address="…">) pour ouvrir le choix
  // d'application de cartographie au lieu de suivre le lien brut.
  function handleBodyClick(e: React.MouseEvent) {
    const link = (e.target as HTMLElement).closest?.('a[href^="geo:"]') as HTMLAnchorElement | null;
    if (!link) return;
    e.preventDefault();
    const m = link.getAttribute("href")?.match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (!m) return;
    setMapDestination({
      lat: parseFloat(m[1]),
      lon: parseFloat(m[2]),
      address: link.getAttribute("data-address") ?? link.textContent ?? undefined,
    });
  }

  function jumpToTab(tabId: string) {
    const idx = currentEspace.tabs.findIndex((t) => t.id === tabId);
    if (idx >= 0) switchTab(idx);
  }

  // Le dernier message "agent" textuel — pas forcément le tout dernier message
  // du fil, un pointeur d'artefact pouvant être ajouté juste après.
  const lastAgentIndex = (() => {
    for (let i = activeConversation.messages.length - 1; i >= 0; i--) {
      if (activeConversation.messages[i].role === "agent") return i;
    }
    return -1;
  })();

  function toggleReasoning(i: number) {
    setExpandedReasoning((prev) => ({ ...prev, [i]: !isReasoningOpen(i) }));
  }

  function htmlToPlainText(html: string): string {
    const el = document.createElement("div");
    el.innerHTML = html;
    return (el.textContent ?? el.innerText ?? "").trim();
  }

  const copyAgentMessage = useCallback(async (index: number, html: string) => {
    const plain = htmlToPlainText(html);
    if (!plain) return;
    try {
      await navigator.clipboard.writeText(plain);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex((prev) => (prev === index ? null : prev)), 2000);
    } catch {
      // Secours pour navigateurs sans accès clipboard sécurisé
      const ta = document.createElement("textarea");
      ta.value = plain;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex((prev) => (prev === index ? null : prev)), 2000);
    }
  }, []);

  function isReasoningOpen(i: number): boolean {
    const m = activeConversation.messages[i];
    if (i in expandedReasoning) return expandedReasoning[i];
    // Ouvert automatiquement pendant que le modèle réfléchit et n'a pas
    // encore commencé à répondre — se referme dès que le texte arrive,
    // sauf si l'utilisateur l'a déjà déplié/replié manuellement.
    return isThinking && i === lastAgentIndex && !m?.text;
  }

  function renderReasoning(m: ConversationMessage, i: number) {
    if (!m.reasoning) return null;
    const live = isThinking && i === lastAgentIndex && !m.text;
    const open = isReasoningOpen(i);
    return (
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
          {live ? "Réflexion en cours…" : "Raisonnement"}
        </button>
        {open && <div className={styles.reasoningBox}>{m.reasoning}</div>}
      </>
    );
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
            <span className={styles.toolOk}>{m.ok === false ? "✕" : "✓"}</span>
          </div>
          {m.ok === false && m.toolDetail && <div className={styles.toolDetail}>{m.toolDetail}</div>}
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

    if (m.role === "artef-proposal" && m.proposal) {
      const p = m.proposal;
      if (m.proposalStatus === "added") {
        return (
          <button key={i} className={styles.artefPointer} onClick={() => openArtefactModal(m.ref ?? "")}>
            <div className={[styles.pic, styles.picSent].join(" ")}>✓</div>
            <div className={styles.ptext}>
              <div className={styles.ptitle}>Ajouté à votre espace — {p.title}</div>
            </div>
            <div className={styles.plink}>
              Voir
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </button>
        );
      }
      if (m.proposalStatus === "dismissed") {
        return (
          <div key={i} className={styles.proposalDismissed}>
            Proposition ignorée — {p.title}
          </div>
        );
      }
      return (
        <div key={i} className={styles.proposalCard}>
          <div className={styles.proposalHead}>
            <span className={styles.proposalKind}>{PROPOSAL_KIND_LABEL[p.kind] ?? "Artefact"}</span>
            <span className={styles.proposalTitle}>{p.title}</span>
          </div>
          {p.chartData && <MiniBarChart data={p.chartData} />}
          {p.mapPoints && (
            <ul className={styles.proposalItems}>
              {p.mapPoints.slice(0, 6).map((pt, ii) => <li key={ii}>📍 {pt.label}</li>)}
              {p.mapPoints.length > 6 && <li>… et {p.mapPoints.length - 6} de plus</li>}
            </ul>
          )}
          {p.items && (
            <ul className={styles.proposalItems}>
              {p.items.slice(0, 6).map((it, ii) => <li key={ii}>{it}</li>)}
              {p.items.length > 6 && <li>… et {p.items.length - 6} de plus</li>}
            </ul>
          )}
          {p.body && !p.items && !p.chartData && (
            <div className={styles.proposalBody}>{p.body.slice(0, 200)}{p.body.length > 200 ? "…" : ""}</div>
          )}
          <div className={styles.proposalActions}>
            <button
              type="button"
              className={styles.proposalAddBtn}
              onClick={() => confirmArtefactProposal(m.id ?? "", "add")}
            >
              Ajouter à mon espace
            </button>
            <button
              type="button"
              className={styles.proposalDismissBtn}
              onClick={() => confirmArtefactProposal(m.id ?? "", "dismiss")}
            >
              Ignorer
            </button>
          </div>
        </div>
      );
    }

    if (m.role === "geo-request") {
      if (m.geoRequestStatus === "granted") {
        return (
          <div key={i} className={styles.proposalDismissed}>
            ✓ Position partagée avec le gent
          </div>
        );
      }
      if (m.geoRequestStatus === "denied") {
        return (
          <div key={i} className={styles.proposalDismissed}>
            Partage de position refusé
          </div>
        );
      }
      if (m.geoRequestStatus === "error") {
        return (
          <div key={i} className={styles.proposalDismissed}>
            Position indisponible (permission navigateur refusée ou géolocalisation inaccessible)
          </div>
        );
      }
      return (
        <div key={i} className={styles.proposalCard}>
          <div className={styles.proposalHead}>
            <span className={styles.proposalKind}>📍 Position</span>
            <span className={styles.proposalTitle}>Le gent demande votre position</span>
          </div>
          <div className={styles.proposalBody}>
            Elle sert uniquement à trouver les lieux les plus proches et n&apos;est jamais partagée
            sans votre accord — votre navigateur demandera aussi sa permission.
          </div>
          <div className={styles.proposalActions}>
            <button
              type="button"
              className={styles.proposalAddBtn}
              disabled={geoStatus === "pending"}
              onClick={() => confirmGeoRequest(m.id ?? "", "share")}
            >
              {geoStatus === "pending" ? "Localisation…" : "Partager ma position"}
            </button>
            <button
              type="button"
              className={styles.proposalDismissBtn}
              onClick={() => confirmGeoRequest(m.id ?? "", "deny")}
            >
              Refuser
            </button>
          </div>
        </div>
      );
    }

    if (m.role === "theme-proposal" && m.themeProposal) {
      const action = m.themeProposal;
      const headline =
        action.action === "create"
          ? `Regrouper ${action.moduleIds.length} élément${action.moduleIds.length > 1 ? "s" : ""} sous « ${action.label} »`
          : action.action === "rename"
            ? `Renommer « ${themeTabLabel(currentEspace, action.tabId)} » en « ${action.label} »`
            : `Supprimer l'onglet « ${themeTabLabel(currentEspace, action.tabId)} »`;

      if (m.themeProposalStatus === "applied") {
        return (
          <div key={i} className={styles.proposalDismissed}>
            ✓ Appliqué — {headline}
          </div>
        );
      }
      if (m.themeProposalStatus === "dismissed") {
        return (
          <div key={i} className={styles.proposalDismissed}>
            Proposition ignorée — {headline}
          </div>
        );
      }
      return (
        <div key={i} className={styles.proposalCard}>
          <div className={styles.proposalHead}>
            <span className={styles.proposalKind}>Onglet thématique</span>
            <span className={styles.proposalTitle}>{headline}</span>
          </div>
          {action.action === "create" && (
            <ul className={styles.proposalItems}>
              {action.moduleIds.map((id) => (
                <li key={id}>{moduleTitle(currentEspace, id)}</li>
              ))}
            </ul>
          )}
          <div className={styles.proposalActions}>
            <button
              type="button"
              className={styles.proposalAddBtn}
              onClick={() => confirmThemeProposal(m.id ?? "", "apply")}
            >
              Appliquer
            </button>
            <button
              type="button"
              className={styles.proposalDismissBtn}
              onClick={() => confirmThemeProposal(m.id ?? "", "dismiss")}
            >
              Ignorer
            </button>
          </div>
        </div>
      );
    }

    if (m.role === "artef-new") {
      return (
        <button key={i} className={styles.artefPointer} onClick={() => openArtefactModal(m.ref ?? "")}>
          <div className={[styles.pic, styles.picSent].join(" ")}>{m.icon ?? "📄"}</div>
          <div className={styles.ptext}>
            <div className={styles.ptitle}>{m.title}</div>
          </div>
          <div className={styles.plink}>
            Voir
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
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

    const isLastMessage = i === lastAgentIndex;
    const isAgent = m.role === "agent";
    const canCopy = isAgent && !!m.text?.trim();
    const isCopied = copiedIndex === i;
    return (
      <div key={i} className={[styles.msg, isAgent ? styles.msgAgent : styles.msgUser].join(" ")}>
        <div className={styles.av}>{isAgent ? "🤖" : "CL"}</div>
        <div className={styles.msgBody}>
          <div className={styles.msgAuthorRow}>
            <div className={styles.msgAuthor}>{isAgent ? currentEspace.gent : "Vous"}</div>
            {canCopy && (
              <button
                type="button"
                className={[styles.copyBtn, isCopied ? styles.copyBtnDone : ""].filter(Boolean).join(" ")}
                onClick={() => copyAgentMessage(i, m.text ?? "")}
                aria-label={isCopied ? "Réponse copiée" : "Copier la réponse"}
              >
                {isCopied ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Copié
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copier
                  </>
                )}
              </button>
            )}
          </div>
          {isAgent && renderReasoning(m, i)}
          <div className={styles.bubble}>
            <SafeHTML html={m.text ?? ""} />
            <div className={styles.t}>{m.t}</div>
          </div>
          {isAgent && isLastMessage && !!m.questions?.length && (
            <QuickReplyQuestions questions={m.questions} onSubmit={sendMessage} />
          )}
        </div>
      </div>
    );
  }

  function handleNewConversation() {
    startNewConversation();
    setCdView("chat");
    setComposerText("");
  }

  function handleSelectConversation(id: string) {
    switchConversation(id);
    setCdView("chat");
  }

  function renderHist() {
    const threads = currentEspace.conversations;

    if (!threads.length) {
      return <div className={styles.empty}>Aucun échange pour l&apos;instant.</div>;
    }

    return (
      <div className={styles.histList}>
        {threads.map((thread, i) => {
          const isActive = thread.id === currentEspace.activeConversationId;
          const label =
            thread.messages.length === 0
              ? "Nouvel échange"
              : `Échange ${threads.length - i}`;
          return (
            <button
              key={thread.id}
              type="button"
              className={[styles.histItem, isActive ? styles.histItemActive : ""].filter(Boolean).join(" ")}
              onClick={() => handleSelectConversation(thread.id)}
            >
              <div className={styles.hname}>{label}</div>
              <div className={styles.hsnip}>{threadPreview(thread)}</div>
              <div className={styles.hmeta}>
                {thread.startedAt} · {threadLastActivity(thread)}
                {thread.messages.length === 0 ? " · vide" : ""}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <section
      className={[styles.panel, fullscreen ? styles.panelFullscreen : ""].filter(Boolean).join(" ")}
      aria-label="Assistant"
      aria-modal="false"
    >
      {!fullscreen && <div className={styles.resizeHandle} ref={handleRef} title="Glisser pour redimensionner" />}

      <div className={styles.head}>
        <div className={styles.headIc}>{currentEspace.icon}</div>
        <div className={styles.headMeta}>
          <h3 className={styles.headTitle}>{currentEspace.gent}</h3>
          <div className={styles.headSub}>{currentEspace.name}</div>
        </div>
        <ReportMenu getMarkdown={() => buildEspaceReport(currentEspace)} baseName={currentEspace.name} />
        <button
          type="button"
          className={styles.reportBtn}
          onClick={() => setFullscreen((v) => !v)}
          title={fullscreen ? "Quitter le plein écran" : "Étendre la conversation en plein écran"}
          aria-label={fullscreen ? "Quitter le plein écran" : "Plein écran"}
        >
          {fullscreen ? "🗗" : "⛶"}
        </button>
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

      <div className={styles.tabsRow}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={[styles.tab, cdView === "chat" ? styles.tabOn : ""].filter(Boolean).join(" ")}
            onClick={() => setCdView("chat")}
          >
            Conversation
          </button>
          <button
            type="button"
            className={[styles.tab, cdView === "hist" ? styles.tabOn : ""].filter(Boolean).join(" ")}
            onClick={() => setCdView("hist")}
          >
            Historique
          </button>
        </div>
        <button
          type="button"
          className={styles.newConvBtn}
          onClick={handleNewConversation}
          title="Démarrer un nouvel échange — les artefacts du gent ne sont pas modifiés"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nouvel échange
        </button>
      </div>

      <div className={styles.body} ref={bodyRef} onClick={handleBodyClick}>
        {cdView === "hist" ? (
          renderHist()
        ) : (
          <>
            {activeConversation.messages.length
              ? activeConversation.messages.map((m, i) => renderMessage(m, i))
              : !currentEspace.jumpForm && (
                  <div className={styles.empty}>
                    Nouvel échange — écrivez votre premier message. Le contenu du gent (itinéraire, réservations…) reste
                    inchangé.
                  </div>
                )}
            {currentEspace.jumpForm && (activeConversation.messages.length === 0 || jumpFormOpen) && (
              <div className={styles.jumpFormWrap}>
                <JumpFormCard
                  form={currentEspace.jumpForm}
                  disabled={isThinking}
                  onSubmit={(values) => {
                    submitJumpForm(values);
                    setJumpFormOpen(false);
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {cdView === "chat" && currentEspace.jumpForm && activeConversation.messages.length > 0 && (
        <button
          type="button"
          className={styles.jumpFormToggle}
          onClick={() => setJumpFormOpen((v) => !v)}
          aria-expanded={jumpFormOpen}
        >
          🗂️ {jumpFormOpen ? "Masquer le formulaire" : currentEspace.jumpForm.title}
        </button>
      )}

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

      {mapDestination && <MapAppModal destination={mapDestination} onClose={() => setMapDestination(null)} />}
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
