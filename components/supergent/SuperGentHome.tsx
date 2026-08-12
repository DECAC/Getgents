"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEspace } from "@/lib/context/EspaceContext";
import { SafeHTML } from "@/components/shared/SafeHTML";
import { ThinkingIndicator } from "@/components/shared/ThinkingIndicator";
import { buildGentSystemPrompt } from "@/lib/gentRuntimePrompt";
import { streamChatCompletion, CHAT_MAX_TOKENS } from "@/lib/streamChat";
import { renderMarkdown } from "@/lib/markdown";
import { ReportMenu } from "@/components/shared/ReportMenu";
import {
  buildSuperGentReport,
  describeGents,
  suggestionsFromGents,
  SUPER_GENT_ROUTER_MODEL,
  type SuperGentReportEntry,
} from "@/lib/superGent";
import type { Espace } from "@/lib/types";
import styles from "./SuperGentHome.module.css";

interface Turn {
  role: "user" | "gent" | "none";
  text: string;
  /** Gent mobilisé pour ce tour — affiché en tête de réponse. */
  gentName?: string;
  gentIcon?: string;
  /** Diagnostic de routage, restitué dans le rapport d'administration. */
  gentId?: string;
  reason?: string;
  model?: string;
  durationMs?: number;
}

/**
 * Le super gent : une seule barre de saisie, une question, et le gent le mieux
 * placé y répond avec son runtime complet.
 *
 * Il ne produit rien : ni artefact, ni mémoire, ni fichier (voir la variante
 * « superGent » de buildGentSystemPrompt). Il ne fait que router puis relayer.
 */
export function SuperGentHome() {
  // `storageReady` : la liste des gents est hydratée (cache local + serveur).
  // Router avant, c'est router sur une liste vide et répondre « aucun de vos
  // gents ne couvre ça » alors qu'ils ne sont simplement pas encore chargés.
  const { espaces, storageReady } = useEspace();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Inertie du routage : le gent en cours reste privilégié pour les relances.
  const currentGentIdRef = useRef<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  // Permet à « Nouvel échange » d'interrompre une réponse en cours plutôt que
  // de laisser un flux orphelin écrire dans un fil déjà vidé.
  const abortRef = useRef<AbortController | null>(null);

  const descriptors = useMemo(() => describeGents(espaces), [espaces]);
  const suggestions = useMemo(() => suggestionsFromGents(espaces), [espaces]);
  const started = turns.length > 0;

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  const ready = storageReady && descriptors.length > 0;

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy || !ready) return;
    setDraft("");
    setError(null);
    setTurns((t) => [...t, { role: "user", text: q }]);
    setBusy(true);
    setStatus("Recherche du gent le mieux placé…");

    // 1) Routage — quel gent doit répondre ?
    const startedAt = Date.now();
    let gentId: string | null = null;
    let reason: string | undefined;
    try {
      const res = await fetch("/api/supergent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, gents: descriptors, currentGentId: currentGentIdRef.current }),
      });
      if (!res.ok) throw new Error(`routage indisponible (${res.status})`);
      const decision = (await res.json()) as { gentId?: string | null; reason?: string };
      gentId = decision.gentId ?? null;
      reason = decision.reason;
    } catch (err) {
      setBusy(false);
      setStatus(null);
      setError(`Impossible de joindre le routeur : ${(err as Error).message}`);
      return;
    }

    const espace: Espace | undefined = gentId ? espaces[gentId] : undefined;
    if (!espace) {
      // Aucun gent ne couvre le sujet : on le dit, plutôt que de forcer une
      // réponse hors domaine (voir routingPrompt).
      currentGentIdRef.current = null;
      setTurns((t) => [
        ...t,
        {
          role: "none",
          text: descriptors.length
            ? `Aucun de vos gents actifs ne couvre ce sujet. Vos gents savent traiter : ${descriptors
                .map((d) => d.name)
                .join(", ")}. Vous pouvez en construire un nouveau depuis le Gent' studio.`
            : "Vous n'avez pas encore de gent actif capable de répondre. Construisez-en un depuis le Gent' studio.",
        },
      ]);
      setBusy(false);
      setStatus(null);
      return;
    }

    currentGentIdRef.current = gentId;
    const model = espace.chatModelId ?? "anthropic/claude-sonnet-5";
    setStatus(`${espace.gent || espace.name} rédige sa réponse…`);
    setTurns((t) => [
      ...t,
      {
        role: "gent",
        text: "",
        gentName: espace.gent || espace.name,
        gentIcon: espace.icon,
        gentId: gentId ?? undefined,
        reason,
        model,
      },
    ]);

    // 2) Réponse — le gent désigné répond avec son runtime complet.
    const controller = new AbortController();
    abortRef.current = controller;
    const history = turns
      .filter((t) => t.role !== "none")
      .map((t) => ({ role: t.role === "user" ? ("user" as const) : ("assistant" as const), content: t.text }));

    try {
      await streamChatCompletion(
        {
          model,
          messages: [
            { role: "system", content: buildGentSystemPrompt(espace, { variant: "superGent" }) },
            ...history,
            { role: "user", content: q },
          ],
          max_tokens: CHAT_MAX_TOKENS.espace,
          mcpServers: espace.mcpServers,
          datasets: espace.datasets,
          prim: espace.prim,
          powens: espace.powens,
          gmail: espace.gmail,
          gentId: gentId ?? undefined,
          restApis: espace.restApis,
          webSearch: espace.webSearch,
        },
        (fullSoFar) => {
          const clean = fullSoFar.includes("<!--") ? fullSoFar.slice(0, fullSoFar.indexOf("<!--")) : fullSoFar;
          setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, text: clean } : turn)));
        },
        (ev) => {
          if (ev.status === "running" && ev.call) setStatus(`${espace.gent || espace.name} consulte ${ev.call}…`);
        },
        undefined,
        "/api/chat",
        controller.signal
      );
    } catch (err) {
      // Interruption volontaire (« Nouvel échange ») : rien à signaler.
      if ((err as Error).name !== "AbortError") setError((err as Error).message);
    } finally {
      const durationMs = Date.now() - startedAt;
      setTurns((t) => t.map((turn, i) => (i === t.length - 1 && turn.role === "gent" ? { ...turn, durationMs } : turn)));
      abortRef.current = null;
      setBusy(false);
      setStatus(null);
    }
  }

  /** Repart d'une page vierge — la session du super gent n'est pas persistée. */
  function newExchange() {
    abortRef.current?.abort();
    abortRef.current = null;
    currentGentIdRef.current = null;
    setTurns([]);
    setDraft("");
    setError(null);
    setStatus(null);
    setBusy(false);
  }

  function report(): string {
    const entries: SuperGentReportEntry[] = [];
    for (let i = 0; i < turns.length; i++) {
      const t = turns[i];
      if (t.role !== "user") continue;
      const answer = turns[i + 1];
      entries.push({
        question: t.text,
        gentName: answer?.role === "gent" ? answer.gentName : undefined,
        gentId: answer?.gentId,
        reason: answer?.reason,
        model: answer?.model,
        durationMs: answer?.durationMs,
        answer: answer?.text ?? "",
      });
    }
    return buildSuperGentReport(entries, descriptors, SUPER_GENT_ROUTER_MODEL);
  }

  return (
    <div className={[styles.wrap, started ? styles.wrapThread : ""].filter(Boolean).join(" ")}>
      {!started ? (
        <div className={styles.hero}>
          <h1 className={styles.title}>Interroge tes gents</h1>
          <p className={styles.sub}>
            Une seule question — le gent le mieux placé y répond.
          </p>

          <form
            className={styles.composer}
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
          >
            <input
              className={styles.input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={storageReady ? "Interroge tes gents…" : "Chargement de vos gents…"}
              aria-label="Interroge tes gents"
              autoFocus
            />
            <button type="submit" className={styles.send} disabled={!draft.trim() || !ready} aria-label="Envoyer">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>

          {suggestions.length > 0 && (
            <div className={styles.ideas}>
              {suggestions.map((s) => (
                <button
                  key={`${s.gentId}-${s.question}`}
                  type="button"
                  className={styles.idea}
                  onClick={() => ask(s.question)}
                >
                  {s.question}
                </button>
              ))}
            </div>
          )}
          {storageReady && suggestions.length === 0 && descriptors.length === 0 && (
            <p className={styles.empty}>
              Aucun gent actif pour l&apos;instant. Construisez-en un depuis le{" "}
              <a href="/builder" className={styles.link}>
                Gent&apos; studio
              </a>
              .
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Barre d'actions — absente de la page vierge, qui doit rester nue. */}
          <div className={styles.bar}>
            <button type="button" className={styles.barBtn} onClick={newExchange} title="Repartir d'une page vierge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Nouvel échange
            </button>
            <ReportMenu getMarkdown={report} baseName="super-gent" />
          </div>

          <div className={styles.thread} ref={threadRef}>
            {turns.map((t, i) => (
              <div key={i} className={styles.turn}>
                {t.role === "user" ? (
                  <div className={styles.userBubble}>{t.text}</div>
                ) : (
                  <div className={styles.answer}>
                    <div className={styles.answerHead}>
                      <span className={styles.answerIcon} aria-hidden="true">
                        {t.role === "none" ? "🧭" : t.gentIcon}
                      </span>
                      <span className={styles.answerName}>
                        {t.role === "none" ? "Aucun gent mobilisé" : t.gentName}
                      </span>
                    </div>
                    {t.text ? (
                      <SafeHTML html={renderMarkdown(t.text)} />
                    ) : (
                      <div className={styles.pending}>…</div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className={styles.thinking}>
                <ThinkingIndicator label={status ?? "Réflexion en cours…"} />
              </div>
            )}
            {error && <div className={styles.error}>{error}</div>}
          </div>

          <form
            className={styles.composerBottom}
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
          >
            <input
              className={styles.input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Posez une autre question…"
              aria-label="Posez une autre question"
              disabled={busy}
            />
            <button type="submit" className={styles.send} disabled={!draft.trim() || busy} aria-label="Envoyer">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>
        </>
      )}
    </div>
  );
}
