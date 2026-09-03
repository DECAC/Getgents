"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Espace } from "@/lib/types";
import {
  COLLAB_GENT_AUTHOR,
  COLLAB_ROOM_CHANNEL,
  gentChannel,
  peerChannel,
  isPeerChannel,
  peerMembers,
  type CollabMessage,
  type CollabParticipant,
  type CollabProposalPayload,
  type CollabQuestionPayload,
  type CollabStatePayload,
  type CollabVoteTally,
} from "@/lib/collab";
import styles from "./CollabShell.module.css";

/**
 * Salon d'un gent collaboratif, ouvert par un lien de partage : salon commun,
 * fils privés avec le gent, MP entre participants (invisibles du gent) et
 * onglet Synthèse maintenu par l'orchestrateur.
 *
 * Pas de compte : l'arrivant donne son prénom, reçoit un participant_token
 * conservé en localStorage, et le présente à chaque requête. L'état est
 * rafraîchi par polling toutes les 4 s (pas de websockets). Tout le filtrage
 * de visibilité est fait côté serveur ; ce composant n'affiche que ce que
 * la route d'état a déjà décidé de lui servir.
 */

// Réactivité : quand l'autre participant parle, l'affichage ne peut se
// mettre à jour qu'au prochain polling `/state`. On réduit donc légèrement
// l'intervalle pour limiter la sensation de "latence".
const POLL_MS = 2500;

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

/** Message lisible quand l'orchestrateur n'a pas pu démarrer après le join. */
function orchestratorHint(reason?: string): string {
  switch (reason) {
    case "no_key":
      return "Le gent n'a pas pu démarrer : aucune clé API n'est disponible pour son propriétaire. Le salon reste ouvert — les messages entre vous fonctionnent.";
    case "quota":
      return "Le gent n'a pas pu démarrer : le crédit / quota du propriétaire est épuisé. Réessayez plus tard.";
    case "busy_or_capped":
      return "Le gent est momentanément saturé (trop d'actions). Réessayez dans un instant ; vous pouvez déjà écrire dans le salon.";
    case "empty_llm":
    case "bad_marker":
      return "Le gent a répondu de façon inattendue. Écrivez dans le salon ou en privé — un prochain message le relancera.";
    default:
      return "Le gent n'a pas pu démarrer tout de suite. Le salon est ouvert ; un prochain message le relancera.";
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

function formatRelative(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const min = Math.max(0, Math.round((Date.now() - d) / 60000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

/* ── Synthèse (jsonb libre, lu défensivement) ─────────────────────────── */

interface SynFact {
  icon?: string;
  k?: string;
  v?: string;
  s?: string;
}

interface SynView {
  decision?: { icon?: string; title?: string; sub?: string; status?: string };
  facts: SynFact[];
  pending: string[];
  timeline: { at?: string; text?: string }[];
  updatedAt?: string;
}

function readSynthesis(raw: Record<string, unknown>): SynView {
  const decision =
    raw.decision && typeof raw.decision === "object" && !Array.isArray(raw.decision)
      ? (raw.decision as SynView["decision"])
      : undefined;
  const facts = Array.isArray(raw.facts)
    ? raw.facts.filter((f): f is SynFact => !!f && typeof f === "object")
    : [];
  const pending = Array.isArray(raw.pending)
    ? raw.pending.filter((p): p is string => typeof p === "string" && p.trim() !== "")
    : [];
  const timeline = Array.isArray(raw.timeline)
    ? raw.timeline.filter((t): t is { at?: string; text?: string } => !!t && typeof t === "object")
    : [];
  return {
    decision,
    facts,
    pending,
    timeline,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  };
}

type Tab = "salon" | "synthese" | "prive" | `peer:${string}`;

/** Canal lu par un onglet (null pour la synthèse, en lecture seule). */
function channelForTab(tab: Tab, meId: string): string | null {
  if (tab === "salon") return COLLAB_ROOM_CHANNEL;
  if (tab === "prive") return gentChannel(meId);
  if (tab === "synthese") return null;
  return peerChannel(meId, tab.slice("peer:".length));
}

export function CollabShell({ token, espace }: { token: string; espace: Espace }) {
  const collab = espace.collab;
  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const [state, setState] = useState<CollabStatePayload | null>(null);
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [orchestratorNotice, setOrchestratorNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("salon");
  /* Sur téléphone, la colonne des participants prenait 168 px en haut de
     l'écran et repoussait le fil hors de vue. Elle devient un volet, ouvert
     depuis la barre du bas — on ne la supprime pas : c'est par elle qu'on
     démarre une conversation privée avec quelqu'un. */
  const [personnesOuvertes, setPersonnesOuvertes] = useState(false);
  const [openPeers, setOpenPeers] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  /** True pendant l'attente du tick LLM (envoi salon/privé ou vote). */
  const [awaitingOrch, setAwaitingOrch] = useState(false);
  const [shareLabel, setShareLabel] = useState("Copier le lien d'invitation");
  const openPeersRef = useRef<string[]>(openPeers);
  const autoSwitchedPeerRef = useRef<Set<string>>(new Set());
  // Sélections en cours pour les questions à choix multiples (par id de message).
  const [askSel, setAskSel] = useState<Record<number, string[]>>({});
  const feedRef = useRef<HTMLDivElement>(null);
  const lastSeenPerTab = useRef<Record<string, number>>({});
  const lastMessageId = useRef<number>(0);

  useEffect(() => {
    openPeersRef.current = openPeers;
  }, [openPeers]);

  const gentName = espace.gent || espace.name;
  const mission = collab?.mission?.trim() || espace.name;

  const fetchState = useCallback(
    async (participantToken: string): Promise<"ok" | "unknown" | "error"> => {
      try {
        const res = await fetch(
          `/api/collab/${encodeURIComponent(token)}/state?participant=${encodeURIComponent(participantToken)}`,
          { cache: "no-store", credentials: "include" }
        );
        if (res.status === 401 || res.status === 403 || res.status === 404) return "unknown";
        if (!res.ok) return "error";
        const next = (await res.json()) as CollabStatePayload;
        // Réconciliation optimiste : les messages provisoires (id négatif)
        // disparaissent dès que le serveur sert leur version définitive.
        setState((prev) => {
          const temps = (prev?.messages ?? []).filter(
            (m) =>
              m.id < 0 &&
              !next.messages.some(
                (r) => r.author === m.author && r.channel === m.channel && r.text === m.text
              )
          );
          return { ...next, messages: [...next.messages, ...temps] };
        });
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
      const res = await fetch(`/api/collab/${encodeURIComponent(token)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ participantToken: stored.participantToken }),
      }).catch(() => null);
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

  const me = state?.me;
  const activeChannel = me ? channelForTab(tab, me.id) : null;
  const visibleMessages = useMemo(
    () => (activeChannel ? (state?.messages ?? []).filter((m) => m.channel === activeChannel) : []),
    [state, activeChannel]
  );

  // Marque l'onglet actif comme lu, puis scroll en bas sur nouveau message
  // (ou quand le gent « réfléchit » apparaît).
  useEffect(() => {
    if (!me || !activeChannel) return;
    const msgs = (state?.messages ?? []).filter((m) => m.channel === activeChannel);
    const lastId = msgs.length ? msgs[msgs.length - 1].id : 0;
    lastSeenPerTab.current[activeChannel] = Math.max(
      lastSeenPerTab.current[activeChannel] ?? 0,
      lastId
    );
    if (lastId !== lastMessageId.current || awaitingOrch) {
      lastMessageId.current = lastId;
      const el = feedRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [state, activeChannel, me, awaitingOrch]);

  function unreadFor(channel: string): boolean {
    if (!state || !me) return false;
    const seen = lastSeenPerTab.current[channel] ?? 0;
    return state.messages.some((m) => m.channel === channel && m.id > seen && m.author !== me.id);
  }

  // Auto-affiche l'onglet 1:1 entre participants quand un premier message arrive,
  // pour éviter la sensation de latence (openPeers était initialement alimenté
  // uniquement par un clic utilisateur).
  useEffect(() => {
    if (!me || !state) return;
    const peerOthers = new Set<string>();
    for (const m of state.messages ?? []) {
      if (!isPeerChannel(m.channel)) continue;
      const members = peerMembers(m.channel);
      if (!members) continue;
      const other = members[0] === me.id ? members[1] : members[1] === me.id ? members[0] : null;
      if (other) peerOthers.add(other);
    }
    const missing = Array.from(peerOthers).filter((id) => !openPeersRef.current.includes(id));
    if (!missing.length) return;
    setOpenPeers((prev) => {
      const next = new Set(prev);
      for (const id of missing) next.add(id);
      return Array.from(next);
    });

    // Si on est sur le salon, on ouvre le 1:1 dès le premier message.
    if (tab === "salon") {
      const first = missing[0];
      if (!autoSwitchedPeerRef.current.has(first)) {
        autoSwitchedPeerRef.current.add(first);
        setTab(`peer:${first}`);
      }
    }
  }, [state, me, tab]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const name = joinName.trim();
    if (!name || joining) return;
    setJoining(true);
    setJoinError(null);
    setOrchestratorNotice(null);
    try {
      const res = await fetch(`/api/collab/${encodeURIComponent(token)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        participantToken?: string;
        hint?: string;
        orchestrator?: { ok: boolean; reason?: string };
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
      if (data.orchestrator && !data.orchestrator.ok) {
        setOrchestratorNotice(orchestratorHint(data.orchestrator.reason));
      }
    } catch {
      setJoinError("Connexion interrompue. Vérifiez votre réseau et réessayez.");
    } finally {
      setJoining(false);
    }
  }

  /** Envoi du brouillon vers le fil actif (salon, gent ou pair). */
  function handleSend(textOverride?: string) {
    const text = (textOverride ?? draft).trim();
    if (!text || !identity || !me || !activeChannel || awaitingOrch) return;
    const target =
      tab === "salon"
        ? { kind: "room" as const }
        : tab === "prive"
          ? { kind: "gent" as const }
          : { kind: "peer" as const, participantId: tab.slice("peer:".length) };
    // L'orchestrateur ne voit que salon + fil gent — pas les MP entre pairs.
    const wakesOrch = target.kind === "room" || target.kind === "gent";

    // Affichage optimiste : id négatif, réconcilié au prochain poll / refresh.
    const optimistic: CollabMessage = {
      id: -Date.now(),
      channel: activeChannel,
      author: me.id,
      authorName: me.name,
      kind: "text",
      text,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => (prev ? { ...prev, messages: [...prev.messages, optimistic] } : prev));
    if (!textOverride) setDraft("");
    setSendError(null);
    if (wakesOrch) setAwaitingOrch(true);

    void (async () => {
      try {
        const res = await fetch(`/api/collab/${encodeURIComponent(token)}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ participantToken: identity.participantToken, target, text }),
        });
        if (!res.ok) {
          setState((prev) =>
            prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== optimistic.id) } : prev
          );
          const data = (await res.json().catch(() => ({}))) as { hint?: string };
          setSendError(data.hint ?? "Votre message n'est pas parti. Réessayez.");
          return;
        }
        // Le serveur a attendu l'orchestrateur : on recharge tout de suite
        // (sinon jusqu'à 4 s de silence avant le prochain poll).
        await fetchState(identity.participantToken);
      } catch {
        setState((prev) =>
          prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== optimistic.id) } : prev
        );
        setSendError("Connexion interrompue. Réessayez.");
      } finally {
        if (wakesOrch) setAwaitingOrch(false);
      }
    })();
  }

  /** Vote / rétention sur une proposition (dernier choix faisant foi), optimiste. */
  function handleVote(proposalId: number, optionId: string) {
    if (!identity || !me || awaitingOrch) return;
    const prevVotes = state?.votes ?? {};
    setState((prev) => {
      if (!prev) return prev;
      const key = String(proposalId);
      const current = prev.votes[key] ?? { counts: {}, voters: 0, my: null };
      const counts = { ...current.counts };
      if (current.my && counts[current.my]) counts[current.my] -= 1;
      counts[optionId] = (counts[optionId] ?? 0) + 1;
      const tally: CollabVoteTally = {
        counts,
        voters: current.voters + (current.my ? 0 : 1),
        my: optionId,
      };
      return { ...prev, votes: { ...prev.votes, [key]: tally } };
    });
    setSendError(null);
    setAwaitingOrch(true);
    void (async () => {
      try {
        const res = await fetch(`/api/collab/${encodeURIComponent(token)}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            participantToken: identity.participantToken,
            vote: { proposalId, optionId },
          }),
        });
        if (!res.ok) {
          setState((prev) => (prev ? { ...prev, votes: prevVotes } : prev));
          const data = (await res.json().catch(() => ({}))) as { hint?: string };
          setSendError(data.hint ?? "Votre choix n'a pas pu être enregistré. Réessayez.");
          return;
        }
        await fetchState(identity.participantToken);
      } catch {
        setState((prev) => (prev ? { ...prev, votes: prevVotes } : prev));
        setSendError("Connexion interrompue. Votre choix n'a pas été enregistré.");
      } finally {
        setAwaitingOrch(false);
      }
    })();
  }

  function handleShare() {
    const url = window.location.href;
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => undefined);
    setShareLabel("Lien copié ✓");
    setTimeout(() => setShareLabel("Copier le lien d'invitation"), 1600);
  }

  function openPeer(id: string) {
    setPersonnesOuvertes(false);
    setOpenPeers((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setTab(`peer:${id}`);
  }

  function closePeer(id: string) {
    setOpenPeers((prev) => prev.filter((p) => p !== id));
    if (tab === `peer:${id}`) setTab("salon");
  }

  /** Réponse à une question cliquable (privé) : choix unique direct, ou validation multi. */
  function answerQuestion(message: CollabMessage, multi: boolean) {
    const sel = askSel[message.id] ?? [];
    if (!sel.length) return;
    handleSend(multi ? sel.join(", ") : sel[0]);
    setAskSel((prev) => ({ ...prev, [message.id]: [] }));
  }

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
  const participants = state?.participants ?? [];
  const progress = state?.progress;
  const pct =
    progress && progress.total > 0 ? Math.round((progress.answered / progress.total) * 100) : 0;
  const iAmCreator = me?.role === "organizer";
  const synthesis = readSynthesis(state?.synthesis ?? {});
  const activePeer =
    tab.startsWith("peer:") && me
      ? participants.find((p) => p.id === tab.slice("peer:".length))
      : undefined;

  const composerNote =
    tab === "salon"
      ? `${gentName} anime ce salon ; les réponses détaillées de chacun restent dans les fils privés.`
      : tab === "prive"
        ? `Ce fil n'est visible que par vous et ${gentName}.`
        : tab === "synthese"
          ? `La synthèse est maintenue par ${gentName} — lecture seule.`
          : activePeer
            ? `Conversation privée avec ${activePeer.name} — ${gentName} n'y a pas accès, rien ne remonte dans le salon.`
            : "";

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
            <span className={styles.mchip}>
              👥 {participants.length} participant{participants.length > 1 ? "s" : ""}
            </span>
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

      {orchestratorNotice && (
        <div className={styles.orchNotice} role="status">
          <span>{orchestratorNotice}</span>
          <button
            type="button"
            className={styles.orchNoticeDismiss}
            onClick={() => setOrchestratorNotice(null)}
            aria-label="Fermer l'avis"
          >
            ×
          </button>
        </div>
      )}

      <div className={styles.layout}>
        <aside
          id="collab-participants"
          className={[styles.people, personnesOuvertes ? styles.peopleOuvert : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <div className={styles.peopleHead}>
            <div className={styles.peopleTitle}>
              <h2>Participants</h2>
              <span className={styles.peopleCount}>{participants.length}</span>
            </div>
            <p className={styles.peopleHint}>Cliquez pour écrire en privé</p>
          </div>
          <div className={styles.peopleList}>
            {participants.map((p) => {
              const isMe = p.id === me?.id;
              const done = progress?.perParticipant[p.id]?.done ?? false;
              const inner = (
                <>
                  <span className={styles.pav} style={pavStyle(p.name)}>
                    {initials(p.name)}
                  </span>
                  <div>
                    <p className={styles.pname}>
                      {p.name}
                      {isMe && <span className={styles.you}>(vous)</span>}
                      {p.role === "organizer" && (
                        <span className={styles.badgeCreator}>Créateur</span>
                      )}
                    </p>
                  </div>
                  <span className={`${styles.pill} ${done ? styles.pillOk : styles.pillWait}`}>
                    {done ? "✓ A répondu" : "En attente"}
                  </span>
                </>
              );
              // Un clic sur un AUTRE participant ouvre le fil privé avec lui.
              return isMe ? (
                <div key={p.id} className={`${styles.person} ${styles.personMe}`}>
                  {inner}
                </div>
              ) : (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.person} ${styles.personBtn}`}
                  onClick={() => openPeer(p.id)}
                  title={`Écrire à ${p.name} en privé`}
                >
                  {inner}
                </button>
              );
            })}
          </div>
          <p className={styles.peopleFoot}>
            🔒 Vos échanges avec {gentName} restent privés. Cliquez sur un participant pour lui
            écrire : ces conversations restent entre vous, {gentName} n&apos;y a pas accès.
          </p>
        </aside>

        <main className={styles.stage}>
          <nav className={styles.tabs} role="tablist">
            <TabButton label="Salon" active={tab === "salon"} onClick={() => setTab("salon")} unread={unreadFor(COLLAB_ROOM_CHANNEL)} />
            <TabButton
              label="📋 Synthèse"
              active={tab === "synthese"}
              onClick={() => setTab("synthese")}
            />
            {me && (
              <TabButton
                label={`🔒 Privé · ${gentName}`}
                active={tab === "prive"}
                onClick={() => setTab("prive")}
                unread={unreadFor(gentChannel(me.id))}
              />
            )}
            {openPeers.map((id) => {
              const p = participants.find((x) => x.id === id);
              if (!p || !me) return null;
              return (
                <TabButton
                  key={id}
                  label={p.name}
                  avatar={p.name}
                  active={tab === `peer:${id}`}
                  onClick={() => setTab(`peer:${id}`)}
                  onClose={() => closePeer(id)}
                  unread={unreadFor(peerChannel(me.id, id))}
                />
              );
            })}

            {/* Accès aux participants depuis la barre du bas, sur téléphone
                seulement : la colonne latérale y est masquée, et c'est par elle
                qu'on ouvre une conversation privée avec quelqu'un. */}
            <button
              type="button"
              className={styles.tabPersonnes}
              onClick={() => setPersonnesOuvertes((v) => !v)}
              aria-expanded={personnesOuvertes}
              aria-controls="collab-participants"
            >
              <span aria-hidden="true">👥</span>
              <span className={styles.tabPersonnesNb}>{participants.length}</span>
              <span className={styles.tabPersonnesTexte}>
                {personnesOuvertes ? "Fermer" : "Participants"}
              </span>
            </button>
          </nav>

          {/* Voile du volet : il ferme d'un toucher n'importe où à côté. */}
          {personnesOuvertes && (
            <div
              className={styles.peopleVoile}
              onClick={() => setPersonnesOuvertes(false)}
              aria-hidden="true"
            />
          )}

          <div className={styles.feed} ref={feedRef}>
            <div className={styles.feedInner}>
              {tab === "synthese" ? (
                <SynthesisPanel synthesis={synthesis} gentName={gentName} />
              ) : (
                <>
                  {tab.startsWith("peer:") && activePeer && (
                    <p className={styles.p2pBanner}>
                      🔒 Conversation privée entre vous et <b>{activePeer.name}</b> — {gentName}{" "}
                      n&apos;y a pas accès.
                    </p>
                  )}
                  {visibleMessages.length === 0 && (
                    <div className={styles.emptyState}>
                      {tab.startsWith("peer:") && activePeer ? (
                        <>
                          <span className={styles.pav} style={pavStyle(activePeer.name)}>
                            {initials(activePeer.name)}
                          </span>
                          <p>
                            Dites bonjour à <b>{activePeer.name}</b> 👋
                          </p>
                          <p className={styles.emptySub}>Cette conversation reste entre vous deux.</p>
                        </>
                      ) : tab === "prive" ? (
                        <>
                          <p>{gentName} va vous poser ses questions ici.</p>
                          <p className={styles.emptySub}>
                            Vos réponses détaillées restent privées ; le salon ne voit que des
                            synthèses.
                          </p>
                        </>
                      ) : (
                        <>
                          <p>Le salon s&apos;ouvre…</p>
                          <p className={styles.emptySub}>
                            {gentName} prépare la mission. Actualisation automatique toutes les 4
                            secondes.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  {visibleMessages.map((m) =>
                    m.author === COLLAB_GENT_AUTHOR ? (
                      <GentCard
                        key={m.id}
                        message={m}
                        icon={espace.icon}
                        votes={state?.votes[String(m.id)]}
                        decision={state?.decision ?? "vote"}
                        canDecide={
                          (state?.decision ?? "vote") === "vote" || me?.role === "organizer"
                        }
                        voteDisabled={awaitingOrch}
                        onVote={(optionId) => handleVote(m.id, optionId)}
                        isPrivate={tab === "prive"}
                        askSel={askSel[m.id] ?? []}
                        onAskToggle={(opt, multi) => {
                          if (awaitingOrch) return;
                          setAskSel((prev) => {
                            const cur = prev[m.id] ?? [];
                            const next = multi
                              ? cur.includes(opt)
                                ? cur.filter((o) => o !== opt)
                                : [...cur, opt]
                              : [opt];
                            return { ...prev, [m.id]: next };
                          });
                          if (!multi) {
                            // Choix unique : la réponse part immédiatement.
                            setAskSel((prev) => ({ ...prev, [m.id]: [] }));
                            handleSend(opt);
                          }
                        }}
                        onAskValidate={(multi) => answerQuestion(m, multi)}
                      />
                    ) : (
                      <ParticipantMessage
                        key={m.id}
                        message={m}
                        meId={me?.id}
                        participants={participants}
                        alignRight={tab !== "salon" && m.author === me?.id}
                      />
                    )
                  )}
                  {awaitingOrch && (tab === "salon" || tab === "prive") && (
                    <article className={`${styles.orch} ${styles.orchThinking}`} aria-live="polite">
                      <div className={styles.orchHead}>
                        <span className={styles.orchAv}>{espace.icon}</span>
                        <b>{gentName}</b>
                        <span className={styles.badgeOrch}>Orchestrateur</span>
                      </div>
                      <p className={styles.orchText}>
                        <span className={styles.thinkingDots} aria-hidden="true">
                          <i />
                          <i />
                          <i />
                        </span>
                        {gentName} réfléchit…
                      </p>
                    </article>
                  )}
                </>
              )}
            </div>
          </div>

          <footer className={styles.composer}>
            <div className={styles.composerInner}>
              <form
                className={styles.cbox}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
              >
                <input
                  type="text"
                  placeholder={
                    awaitingOrch
                      ? `${gentName} réfléchit…`
                      : tab === "salon"
                        ? "Écrire dans le salon…"
                        : tab === "prive"
                          ? `Répondre à ${gentName} en privé…`
                          : tab === "synthese"
                            ? "Lecture seule"
                            : activePeer
                              ? `Écrire à ${activePeer.name} en privé…`
                              : "Écrire…"
                  }
                  autoComplete="off"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={2000}
                  disabled={tab === "synthese" || awaitingOrch}
                />
                <button
                  className={styles.send}
                  type="submit"
                  aria-label="Envoyer"
                  disabled={!draft.trim() || tab === "synthese" || awaitingOrch}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    width="14"
                    height="14"
                  >
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </button>
              </form>
              {sendError ? (
                <p className={styles.errLine}>{sendError}</p>
              ) : awaitingOrch ? (
                <p className={styles.cnote}>
                  {gentName} prépare sa réponse — cela peut prendre jusqu&apos;à une minute.
                </p>
              ) : (
                <p className={styles.cnote}>{composerNote}</p>
              )}
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

/* ── Onglet ───────────────────────────────────────────────────────────── */

function TabButton({
  label,
  active,
  onClick,
  onClose,
  unread,
  avatar,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  onClose?: () => void;
  unread?: boolean;
  avatar?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`${styles.tab} ${active ? styles.tabOn : ""}`}
      onClick={onClick}
    >
      {avatar && (
        <span className={styles.tabAv} style={pavStyle(avatar)}>
          {initials(avatar)}
        </span>
      )}
      <span>{label}</span>
      {unread && <span className={styles.tabDot} aria-label="Messages non lus" />}
      {onClose && (
        <span
          className={styles.tabX}
          role="button"
          aria-label={`Fermer ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          ×
        </span>
      )}
    </button>
  );
}

/* ── Messages ─────────────────────────────────────────────────────────── */

function GentCard({
  message,
  icon,
  votes,
  decision,
  canDecide,
  voteDisabled,
  onVote,
  isPrivate,
  askSel,
  onAskToggle,
  onAskValidate,
}: {
  message: CollabMessage;
  icon: string;
  votes?: CollabVoteTally;
  decision: "vote" | "createur";
  canDecide: boolean;
  voteDisabled?: boolean;
  onVote: (optionId: string) => void;
  isPrivate: boolean;
  askSel: string[];
  onAskToggle: (option: string, multi: boolean) => void;
  onAskValidate: (multi: boolean) => void;
}) {
  const proposal =
    message.kind === "proposal" && message.payload && typeof message.payload === "object"
      ? (message.payload as CollabProposalPayload)
      : null;
  const ask =
    message.kind === "question" && message.payload && typeof message.payload === "object"
      ? (message.payload as CollabQuestionPayload)
      : null;
  const creatorMode = decision === "createur";

  return (
    <article className={styles.orch}>
      <div className={styles.orchHead}>
        <span className={styles.orchAv}>{icon}</span>
        <b>{message.authorName}</b>
        <span className={styles.badgeOrch}>{isPrivate ? "Fil privé" : "Orchestrateur"}</span>
        <time>{formatTime(message.createdAt)}</time>
      </div>
      {message.text && <p className={styles.orchText}>{message.text}</p>}

      {ask?.questions?.map((q, i) => (
        <div key={i}>
          {q.q && q.q !== message.text && <p className={styles.orchText}>{q.q}</p>}
          <div className={styles.ask}>
            {q.options.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`${styles.chip} ${askSel.includes(opt) ? styles.chipOn : ""}`}
                onClick={() => onAskToggle(opt, !!q.multi)}
              >
                {opt}
              </button>
            ))}
            {q.multi && (
              <button
                type="button"
                className={styles.askValidate}
                disabled={!askSel.length}
                onClick={() => onAskValidate(true)}
              >
                Valider
              </button>
            )}
          </div>
        </div>
      ))}

      {proposal && (
        <>
          <div className={styles.props}>
            {proposal.options.map((opt) => {
              const count = votes?.counts[opt.id] ?? 0;
              const mine = votes?.my === opt.id;
              return (
                <article key={opt.id} className={styles.prop}>
                  <h4 className={styles.propTitle}>{opt.title}</h4>
                  {opt.where && <p className={styles.propWhere}>{opt.where}</p>}
                  {opt.price && <p className={styles.propPrice}>{opt.price}</p>}
                  {opt.verified ? (
                    <p className={styles.propVerif}>✓ Vérifié sur le web</p>
                  ) : (
                    <p className={styles.propVerifNo}>À confirmer</p>
                  )}
                  {canDecide ? (
                    <button
                      type="button"
                      className={`${styles.vote} ${mine ? styles.voteOn : ""}`}
                      onClick={() => onVote(opt.id)}
                      disabled={voteDisabled}
                    >
                      {creatorMode
                        ? mine
                          ? `✓ Retenue · ${count}`
                          : `Retenir · ${count}`
                        : mine
                          ? `✓ Mon choix · ${count}`
                          : `Choisir · ${count}`}
                    </button>
                  ) : (
                    <p className={styles.voteHint} style={{ margin: "8px 0 0" }}>
                      {creatorMode
                        ? "Le créateur tranche — pas de vote ouvert."
                        : `${count} voix`}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
          {votes && votes.voters > 0 && (
            <p className={styles.voteHint}>
              {creatorMode ? (
                votes.my ? (
                  <>
                    Option retenue :{" "}
                    <b>{proposal.options.find((o) => o.id === votes.my)?.title ?? ""}</b>
                  </>
                ) : (
                  "En attente de la décision du créateur"
                )
              ) : (
                <>
                  {votes.voters} votant{votes.voters > 1 ? "s" : ""}
                  {votes.my ? (
                    <>
                      {" "}
                      · vous avez choisi{" "}
                      <b>{proposal.options.find((o) => o.id === votes.my)?.title ?? ""}</b>
                    </>
                  ) : (
                    ""
                  )}
                </>
              )}
            </p>
          )}
        </>
      )}
    </article>
  );
}

function ParticipantMessage({
  message,
  meId,
  participants,
  alignRight,
}: {
  message: CollabMessage;
  meId: string | undefined;
  participants: CollabParticipant[];
  alignRight: boolean;
}) {
  const isMe = message.author === meId;
  const role = participants.find((p) => p.id === message.author)?.role;
  return (
    <div className={`${styles.msg} ${alignRight ? styles.msgMe : ""}`}>
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

/* ── Onglet Synthèse ──────────────────────────────────────────────────── */

function SynthesisPanel({ synthesis, gentName }: { synthesis: SynView; gentName: string }) {
  const vide =
    !synthesis.decision && !synthesis.facts.length && !synthesis.pending.length && !synthesis.timeline.length;

  if (vide) {
    return (
      <div className={styles.emptyState}>
        <p>La synthèse n&apos;est pas encore publiée.</p>
        <p className={styles.emptySub}>
          {gentName} la remplira au fil de la collecte : décision, infos clés, points en suspens
          et fil des décisions.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.syn}>
      {synthesis.decision?.title && (
        <div className={`${styles.synCard} ${styles.synDecision}`}>
          <div className={styles.synDecisionTop}>
            <span className={styles.synDecisionIcon}>{synthesis.decision.icon ?? "🎯"}</span>
            <div>
              <p className={styles.synTitle}>{synthesis.decision.title}</p>
              {synthesis.decision.sub && <p className={styles.synSub}>{synthesis.decision.sub}</p>}
            </div>
            <span
              className={`${styles.badgeGold} ${
                synthesis.decision.status === "confirmed" ? styles.badgeDone : ""
              }`}
            >
              {synthesis.decision.status === "confirmed"
                ? "✓ Décision confirmée"
                : "⏳ En attente de confirmation"}
            </span>
          </div>
        </div>
      )}

      {synthesis.facts.length > 0 && (
        <div className={styles.synGrid}>
          {synthesis.facts.map((f, i) => (
            <div className={styles.synKv} key={i}>
              <p className={styles.synKvK}>
                {f.icon ? `${f.icon} ` : ""}
                {f.k ?? ""}
              </p>
              <p className={styles.synKvV}>{f.v ?? "—"}</p>
              {f.s && <p className={styles.synKvS}>{f.s}</p>}
            </div>
          ))}
        </div>
      )}

      {synthesis.pending.length > 0 && (
        <div className={styles.synCard}>
          <h3>⏳ Points en suspens</h3>
          <ul className={styles.pendingList}>
            {synthesis.pending.map((p, i) => (
              <li key={i}>
                <span className={styles.pendingDot} />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {synthesis.timeline.length > 0 && (
        <div className={styles.synCard}>
          <h3>🧵 Fil des décisions</h3>
          <div className={styles.tl}>
            {synthesis.timeline.map((t, i) => (
              <div className={styles.tlItem} key={i}>
                <time>{t.at ? formatTime(t.at) : ""}</time>
                <span className={styles.tlRail}>
                  <span className={styles.tlDot} />
                </span>
                <p>{t.text ?? ""}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className={styles.synNote}>
        ✨ Synthèse maintenue automatiquement par <b>{gentName}</b>
        {synthesis.updatedAt ? ` · mise à jour ${formatRelative(synthesis.updatedAt)}` : ""}
      </p>
    </div>
  );
}
