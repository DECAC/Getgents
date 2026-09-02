"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Espace } from "@/lib/types";
import {
  COLLAB_GENT_AUTHOR,
  COLLAB_ROOM_CHANNEL,
  type CollabMessage,
  type CollabParticipant,
  type CollabStatePayload,
} from "@/lib/collab";
import styles from "./CollabShell.module.css";

/**
 * Salon d'un gent collaboratif, ouvert par un lien de partage : plusieurs
 * participants, un salon commun, et un gent qui orchestre la mission.
 *
 * Pas de compte : l'arrivant donne son prénom, reçoit un participant_token
 * conservé en localStorage, et le présente à chaque requête. L'état est
 * rafraîchi par polling toutes les 4 s (pas de websockets).
 *
 * Ce premier lot pose le socle : salon, participants, envoi de messages.
 * Les fils privés, les MP entre participants et l'onglet Synthèse arrivent
 * avec l'orchestrateur au lot suivant.
 */

const POLL_MS = 4000;

function storageKey(token: string): string {
  return `getgents:collab:${token}`;
}

interface StoredIdentity {
  participantToken: string;
  name: string;
}

function readIdentity(token: string): StoredIdentity | null {
  try {
    const raw = window.localStorage.getItem(storageKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredIdentity;
    return typeof parsed?.participantToken === "string" && parsed.participantToken ? parsed : null;
  } catch {
    return null;
  }
}

function writeIdentity(token: string, identity: StoredIdentity): void {
  try {
    window.localStorage.setItem(storageKey(token), JSON.stringify(identity));
  } catch {
    // navigation privée : l'identité ne survivra pas à l'onglet, c'est tout
  }
}

function clearIdentity(token: string): void {
  try {
    window.localStorage.removeItem(storageKey(token));
  } catch {
    // rien à effacer
  }
}

/* Palette déterministe par prénom (mêmes teintes que la maquette). */
const PAV_COLORS: [string, string][] = [
  ["#dbe7fb", "#3a5fa3"],
  ["#fde4bb", "#8a6410"],
  ["#ffdee2", "#c73758"],
  ["#d4f1d4", "#3c7a40"],
  ["#e6e0f8", "#5b4a9e"],
];

function pavStyle(name: string): { background: string; color: string } {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const [bg, fg] = PAV_COLORS[h % PAV_COLORS.length];
  return { background: bg, color: fg };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function CollabShell({ token, espace }: { token: string; espace: Espace }) {
  const collab = espace.collab;
  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const [state, setState] = useState<CollabStatePayload | null>(null);
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [shareLabel, setShareLabel] = useState("Copier le lien d'invitation");
  const feedRef = useRef<HTMLDivElement>(null);
  // Ne pas rejouer le scroll à chaque poll : uniquement quand un message
  // NOUVEAU arrive (le dernier id change), sinon l'utilisateur ne peut plus
  // remonter lire le fil.
  const lastMessageId = useRef<number>(0);

  const gentName = espace.gent || espace.name;
  const mission = collab?.mission?.trim() || espace.name;

  const fetchState = useCallback(
    async (participantToken: string): Promise<"ok" | "unknown" | "error"> => {
      try {
        const res = await fetch(
          `/api/collab/${encodeURIComponent(token)}/state?participant=${encodeURIComponent(participantToken)}`,
          { cache: "no-store" }
        );
        if (res.status === 401 || res.status === 403 || res.status === 404) return "unknown";
        if (!res.ok) return "error";
        setState((await res.json()) as CollabStatePayload);
        return "ok";
      } catch {
        return "error";
      }
    },
    [token]
  );

  // Identité retrouvée en localStorage à l'ouverture : on la revalide auprès
  // du serveur (le salon a pu être réinitialisé entre-temps).
  useEffect(() => {
    const stored = readIdentity(token);
    if (!stored) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(
        `/api/collab/${encodeURIComponent(token)}/join`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantToken: stored.participantToken }),
        }
      ).catch(() => null);
      if (cancelled) return;
      if (res && res.ok) {
        setIdentity(stored);
      } else {
        clearIdentity(token);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Polling de l'état tant que le participant est dans le salon.
  useEffect(() => {
    if (!identity) return;
    let cancelled = false;
    const tick = async () => {
      const res = await fetchState(identity.participantToken);
      if (cancelled) return;
      if (res === "unknown") {
        // Jeton devenu invalide (salon révoqué, base réinitialisée…) :
        // retour à l'écran d'arrivée plutôt qu'une erreur figée.
        clearIdentity(token);
        setIdentity(null);
        setState(null);
      }
    };
    void tick();
    const interval = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [identity, fetchState, token]);

  // Scroll en bas du fil quand un message nouveau arrive.
  useEffect(() => {
    const messages = state?.messages ?? [];
    const lastId = messages.length ? messages[messages.length - 1].id : 0;
    if (lastId !== lastMessageId.current) {
      lastMessageId.current = lastId;
      const el = feedRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [state]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const name = joinName.trim();
    if (!name || joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/collab/${encodeURIComponent(token)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        participantToken?: string;
        hint?: string;
        error?: string;
      };
      if (!res.ok || !data.participantToken) {
        setJoinError(
          data.hint ??
            (res.status === 403
              ? "Ce lien n'est plus actif. Demandez un nouveau lien à son auteur."
              : "Impossible de rejoindre le salon pour le moment. Réessayez dans un instant.")
        );
        return;
      }
      const next = { participantToken: data.participantToken, name };
      writeIdentity(token, next);
      setIdentity(next);
    } catch {
      setJoinError("Connexion interrompue. Vérifiez votre réseau et réessayez.");
    } finally {
      setJoining(false);
    }
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || sending || !identity) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/collab/${encodeURIComponent(token)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantToken: identity.participantToken,
          target: { kind: "room" },
          text,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: CollabMessage };
      if (!res.ok || !data.message) {
        setSendError("Votre message n'est pas parti. Réessayez.");
        return;
      }
      setDraft("");
      // Affichage immédiat du message renvoyé par le serveur ; le prochain
      // poll recollera de toute façon l'état complet (dédoublonné par id).
      setState((prev) =>
        prev && !prev.messages.some((m) => m.id === data.message!.id)
          ? { ...prev, messages: [...prev.messages, data.message!] }
          : prev
      );
    } catch {
      setSendError("Connexion interrompue. Réessayez.");
    } finally {
      setSending(false);
    }
  }

  function handleShare() {
    const url = window.location.href;
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => undefined);
    setShareLabel("Lien copié ✓");
    setTimeout(() => setShareLabel("Copier le lien d'invitation"), 1600);
  }

  const roomMessages = useMemo(
    () => (state?.messages ?? []).filter((m) => m.channel === COLLAB_ROOM_CHANNEL),
    [state]
  );

  /* ── Écran d'arrivée ─────────────────────────────────────────────── */
  if (!identity) {
    return (
      <div className={styles.page}>
        <main className={styles.join}>
          <form className={styles.joinCard} onSubmit={handleJoin}>
            <div className={styles.joinIcon}>{espace.icon}</div>
            <h1 className={styles.joinTitle}>
              {gentName} <span className={styles.badgeOrch}>Orchestrateur</span>
            </h1>
            <p className={styles.joinMission}>
              {mission} — un salon collectif où {gentName} organise la mission avec tout le
              groupe. Rejoignez avec votre prénom, sans créer de compte.
            </p>
            <label className={styles.joinLabel} htmlFor="collab-name">
              Votre prénom
            </label>
            <input
              id="collab-name"
              className={styles.joinInput}
              type="text"
              autoComplete="given-name"
              placeholder="ex. Camille"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              maxLength={40}
              autoFocus
            />
            <button className={styles.joinBtn} type="submit" disabled={!joinName.trim() || joining}>
              {joining ? "Ouverture du salon…" : "Rejoindre le salon"}
            </button>
            {joinError && <p className={styles.joinError}>{joinError}</p>}
            <p className={styles.joinNote}>
              Aucun compte nécessaire. Vos échanges avec {gentName} restent privés ; les
              conversations entre participants restent entre vous.
            </p>
          </form>
        </main>
      </div>
    );
  }

  /* ── Salon ───────────────────────────────────────────────────────── */
  const me = state?.me;
  const participants = state?.participants ?? [];
  const progress = state?.progress;
  const pct =
    progress && progress.total > 0 ? Math.round((progress.answered / progress.total) * 100) : 0;
  const iAmCreator = me?.role === "organizer";

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.gentAv}>{espace.icon}</div>
        <div className={styles.gentMeta}>
          <p className={styles.gentName}>
            {gentName} <span className={styles.badgeOrch}>Orchestrateur</span>
          </p>
          <p className={styles.gentSub}>{mission}</p>
        </div>

        <div className={styles.missionChips}>
          {iAmCreator && (
            <span className={`${styles.mchip} ${styles.mchipCreator}`}>
              ★ Vous êtes le créateur de cette mission
            </span>
          )}
          {participants.length > 0 && (
            <span className={styles.mchip}>👥 {participants.length} participant{participants.length > 1 ? "s" : ""}</span>
          )}
          {state?.cadre.budget && <span className={styles.mchip}>💶 {state.cadre.budget}</span>}
          {state?.cadre.lieu && <span className={styles.mchip}>📍 {state.cadre.lieu}</span>}
          {state?.cadre.periode && <span className={styles.mchip}>📅 {state.cadre.periode}</span>}
        </div>

        <div className={styles.topRight}>
          {progress && (
            <div className={styles.progress}>
              <p className={styles.progressLabel}>
                <b>
                  {progress.answered}/{progress.total}
                </b>{" "}
                réponses
              </p>
              <div className={styles.bar}>
                <i className={styles.barFill} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          <button className={styles.shareBtn} type="button" onClick={handleShare}>
            🔗 <span>{shareLabel}</span>
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.people}>
          <div className={styles.peopleHead}>
            <div className={styles.peopleTitle}>
              <h2>Participants</h2>
              <span className={styles.peopleCount}>{participants.length}</span>
            </div>
            <p className={styles.peopleHint}>La collecte se fait en fils privés</p>
          </div>
          <div className={styles.peopleList}>
            {participants.map((p) => (
              <PersonRow
                key={p.id}
                participant={p}
                isMe={p.id === me?.id}
                done={progress?.perParticipant[p.id]?.done ?? false}
              />
            ))}
          </div>
          <p className={styles.peopleFoot}>
            🔒 Vos échanges avec {gentName} restent privés. Les conversations entre participants
            restent entre vous — le gent n&apos;y a pas accès.
          </p>
        </aside>

        <main className={styles.stage}>
          <div className={styles.feed} ref={feedRef}>
            <div className={styles.feedInner}>
              {roomMessages.length === 0 && (
                <div className={styles.emptyState}>
                  <p>Le salon s&apos;ouvre…</p>
                  <p className={styles.emptySub}>
                    {gentName} prépare la mission. Actualisation automatique toutes les 4 secondes.
                  </p>
                </div>
              )}
              {roomMessages.map((m) =>
                m.author === COLLAB_GENT_AUTHOR ? (
                  <GentCard key={m.id} message={m} icon={espace.icon} />
                ) : (
                  <ParticipantMessage key={m.id} message={m} meId={me?.id} participants={participants} />
                )
              )}
            </div>
          </div>

          <footer className={styles.composer}>
            <div className={styles.composerInner}>
              <form
                className={styles.cbox}
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSend();
                }}
              >
                <input
                  type="text"
                  placeholder="Écrire dans le salon…"
                  autoComplete="off"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={2000}
                />
                <button className={styles.send} type="submit" aria-label="Envoyer" disabled={!draft.trim() || sending}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </button>
              </form>
              {sendError ? (
                <p className={styles.errLine}>{sendError}</p>
              ) : (
                <p className={styles.cnote}>
                  {gentName} anime ce salon ; les réponses détaillées de chacun restent dans les
                  fils privés.
                </p>
              )}
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

function PersonRow({
  participant,
  isMe,
  done,
}: {
  participant: CollabParticipant;
  isMe: boolean;
  done: boolean;
}) {
  return (
    <div className={`${styles.person} ${isMe ? styles.personMe : ""}`}>
      <span className={styles.pav} style={pavStyle(participant.name)}>
        {initials(participant.name)}
      </span>
      <div>
        <p className={styles.pname}>
          {participant.name}
          {isMe && <span className={styles.you}>(vous)</span>}
          {participant.role === "organizer" && <span className={styles.badgeCreator}>Créateur</span>}
        </p>
      </div>
      <span className={`${styles.pill} ${done ? styles.pillOk : styles.pillWait}`}>
        {done ? "✓ A répondu" : "En attente"}
      </span>
    </div>
  );
}

function GentCard({ message, icon }: { message: CollabMessage; icon: string }) {
  return (
    <article className={styles.orch}>
      <div className={styles.orchHead}>
        <span className={styles.orchAv}>{icon}</span>
        <b>{message.authorName}</b>
        <span className={styles.badgeOrch}>Orchestrateur</span>
        <time>{formatTime(message.createdAt)}</time>
      </div>
      <p className={styles.orchText}>{message.text}</p>
    </article>
  );
}

function ParticipantMessage({
  message,
  meId,
  participants,
}: {
  message: CollabMessage;
  meId: string | undefined;
  participants: CollabParticipant[];
}) {
  const isMe = message.author === meId;
  const role = participants.find((p) => p.id === message.author)?.role;
  return (
    <div className={styles.msg}>
      <span className={styles.pav} style={pavStyle(message.authorName)}>
        {initials(message.authorName)}
      </span>
      <div className={styles.msgBody}>
        <div className={styles.msgHead}>
          <b>{message.authorName}</b>
          {isMe && <span className={styles.you}>(vous)</span>}
          {role === "organizer" && <span className={styles.badgeCreator}>Créateur</span>}
          <time>{formatTime(message.createdAt)}</time>
        </div>
        <p className={styles.bubble}>{message.text}</p>
      </div>
    </div>
  );
}
