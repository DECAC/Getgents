"use client";

import { useCallback, useEffect, useState } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { isDirtySincePublish } from "@/lib/builderSnapshot";
import { apiFetchInit, estSessionExpiree, signalerSessionExpiree } from "@/lib/apiFetch";
import { SessionExpiree } from "@/components/shared/SessionExpiree";
import styles from "./CollabSuiviSection.module.css";

interface SuiviParticipant {
  id: string;
  name: string;
  role: string;
  lastSeenAt: string;
  answered: number;
  done: boolean;
}

interface RoomMessage {
  id: number;
  author: string;
  authorName: string;
  kind: string;
  text: string;
  createdAt: string;
}

interface SuiviSession {
  id: string;
  token: string;
  status: string;
  statusLabel: string;
  createdAt: string;
  orchestrationCount: number;
  maxOrchestrations: number;
  participants: SuiviParticipant[];
  progress: { answered: number; total: number; questionsCount: number };
  synthesis: Record<string, unknown>;
  roomMessages: RoomMessage[];
}

/**
 * Suivi créateur d'un Event Manager : participants, barre de progression,
 * synthèse, et lecture du salon — visible dans l'onglet Diffusion.
 */
export function CollabSuiviSection() {
  const { currentDraft } = useBuilder();
  const enabled = !!currentDraft.collab?.enabled;
  const [sessions, setSessions] = useState<SuiviSession[]>([]);
  const [mission, setMission] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [sessionExpiree, setSessionExpiree] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || currentDraft.status !== "published") return;
    setLoading(true);
    try {
      const res = await fetch(`/api/gents/${encodeURIComponent(currentDraft.id)}/collab`, apiFetchInit());
      if (estSessionExpiree(res.status)) {
        signalerSessionExpiree();
        setSessionExpiree(true);
        return;
      }
      const data = (await res.json()) as {
        sessions?: SuiviSession[];
        mission?: string;
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `Erreur ${res.status}`);
        setHint(data.hint ?? null);
        return;
      }
      setError(null);
      setHint(null);
      setMission(data.mission ?? "");
      const list = data.sessions ?? [];
      setSessions(list);
      setOpenId((prev) => prev ?? list[0]?.id ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [enabled, currentDraft.id, currentDraft.status]);

  useEffect(() => {
    void load();
    if (!enabled || currentDraft.status !== "published") return;
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [load, enabled, currentDraft.status]);

  if (!enabled) return null;

  const dirty = isDirtySincePublish(currentDraft);

  if (currentDraft.status !== "published") {
    return (
      <div className={styles.card}>
        <h4 className={styles.title}>Suivi du salon</h4>
        <p className={styles.sub}>
          Diffusez d&apos;abord Event Manager, créez un <b>lien de salon</b>, puis revenez ici :
          vous verrez qui a rejoint, l&apos;avancement de la collecte et le salon en lecture.
        </p>
      </div>
    );
  }

  if (sessionExpiree) return <SessionExpiree />;

  const active = sessions.find((s) => s.id === openId) ?? sessions[0] ?? null;
  const decision =
    active?.synthesis && typeof active.synthesis.decision === "object" && active.synthesis.decision
      ? (active.synthesis.decision as { title?: string; sub?: string })
      : null;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h4 className={styles.title}>Suivi du salon</h4>
          <p className={styles.sub}>
            {mission
              ? `Mission : ${mission}`
              : "Participants, progression et salon — rafraîchi automatiquement."}
          </p>
        </div>
        <button type="button" className={styles.refresh} onClick={() => void load()} disabled={loading}>
          {loading ? "…" : "Actualiser"}
        </button>
      </div>

      {dirty && (
        <div className={styles.warn}>
          Des modifications Event Manager ne sont pas encore diffusées. Le salon public utilise
          encore l&apos;ancienne version — cliquez <b>Diffuser les modifications</b>.
        </div>
      )}

      {error && (
        <div className={styles.warn}>
          {error}
          {hint ? <div className={styles.hint}>{hint}</div> : null}
        </div>
      )}

      {!error && sessions.length === 0 && (
        <p className={styles.muted}>
          Aucune session pour l&apos;instant. Dès qu&apos;un participant ouvre le lien de salon et
          indique son prénom, le suivi apparaît ici.
        </p>
      )}

      {sessions.length > 1 && (
        <div className={styles.sessionTabs}>
          {sessions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={[styles.sessionTab, s.id === active?.id ? styles.sessionTabOn : ""]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setOpenId(s.id)}
            >
              Salon {sessions.length - i}
              <span className={styles.pill}>{s.statusLabel}</span>
            </button>
          ))}
        </div>
      )}

      {active && (
        <>
          <div className={styles.metaRow}>
            <span className={styles.pill}>{active.statusLabel}</span>
            <span className={styles.meta}>
              {active.progress.answered}/{active.progress.total} ont répondu
              {active.progress.questionsCount
                ? ` (${active.progress.questionsCount} question${
                    active.progress.questionsCount > 1 ? "s" : ""
                  })`
                : ""}
            </span>
            <span className={styles.meta}>
              Orchestrations {active.orchestrationCount}/{active.maxOrchestrations}
            </span>
          </div>

          <div className={styles.barTrack} aria-hidden="true">
            <div
              className={styles.barFill}
              style={{
                width: `${
                  active.progress.total
                    ? Math.round((100 * active.progress.answered) / active.progress.total)
                    : 0
                }%`,
              }}
            />
          </div>

          <div className={styles.people}>
            {active.participants.map((p) => (
              <div key={p.id} className={styles.person}>
                <span className={styles.avatar}>{initials(p.name)}</span>
                <div className={styles.personMeta}>
                  <div className={styles.personName}>
                    {p.name}
                    {p.role === "organizer" ? (
                      <span className={styles.creatorBadge}>Créateur</span>
                    ) : null}
                  </div>
                  <div className={styles.personSub}>vu {formatRelative(p.lastSeenAt)}</div>
                </div>
                <span className={p.done ? styles.pillOk : styles.pillWait}>
                  {p.done
                    ? "A répondu"
                    : p.answered > 0
                      ? `${p.answered} réponse${p.answered > 1 ? "s" : ""}`
                      : "En attente"}
                </span>
              </div>
            ))}
          </div>

          {decision?.title && (
            <div className={styles.decision}>
              <div className={styles.decisionLabel}>Décision en tête</div>
              <div className={styles.decisionTitle}>{decision.title}</div>
              {decision.sub ? <div className={styles.personSub}>{decision.sub}</div> : null}
            </div>
          )}

          <div className={styles.salon}>
            <div className={styles.salonHead}>Salon (lecture seule)</div>
            {active.roomMessages.length === 0 ? (
              <p className={styles.muted}>Pas encore de message dans le salon.</p>
            ) : (
              <div className={styles.salonList}>
                {active.roomMessages.map((m) => (
                  <div key={m.id} className={styles.salonMsg}>
                    <span className={styles.salonAuthor}>
                      {m.author === "gent" ? `🧭 ${m.authorName}` : m.authorName}
                    </span>
                    <span className={styles.salonText}>
                      {m.kind === "proposal" ? `📋 ${m.text}` : m.kind === "vote" ? `🗳 ${m.text}` : m.text}
                    </span>
                    <span className={styles.salonTime}>{formatTime(m.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 60_000) return "à l'instant";
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3_600_000)} h`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
