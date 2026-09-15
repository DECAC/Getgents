"use client";

import { useEffect, useState } from "react";
import { useEspace } from "@/lib/context/EspaceContext";
import type { Artefact } from "@/lib/types";
import {
  GMAIL_NOT_CONNECTED_MESSAGE,
  artefactSharePayload,
  parseEmailRecipients,
} from "@/lib/workspaceArtefacts";
import styles from "./Modal.module.css";

export function ShareArtefactDialog({
  artefact,
  onClose,
}: {
  artefact: Artefact;
  onClose: () => void;
}) {
  const { currentId } = useEspace();
  const payload = artefactSharePayload(artefact);
  const [to, setTo] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    fetch(`/api/gmail/status?gentId=${encodeURIComponent(currentId)}`)
      .then((r) => r.json())
      .then((data: { connected?: boolean }) => {
        if (!cancelled) setConnected(!!data.connected);
      })
      .catch(() => {
        if (!cancelled) setConnected(false);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentId]);

  async function send() {
    const { emails, invalid } = parseEmailRecipients(to);
    if (invalid.length) {
      setError(`Adresse e-mail invalide : ${invalid.join(", ")}`);
      return;
    }
    if (!emails.length) {
      setError("Indiquez au moins une adresse e-mail.");
      return;
    }
    if (!confirmed) {
      setError("Cochez la case pour confirmer l'envoi.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gentId: currentId,
          to: emails,
          subject: payload.subject,
          body: payload.body,
          htmlBody: payload.htmlBody,
          imageUrl: payload.imageUrl,
        }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || data.error) {
        setError(data.error || GMAIL_NOT_CONNECTED_MESSAGE);
        return;
      }
      setDone(true);
    } catch {
      setError("L'envoi a échoué. Vérifiez votre connexion, puis réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-artefact-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <div className={styles.head}>
          <div>
            <h3 className={styles.title} id="share-artefact-title">
              Partager l&apos;artefact
            </h3>
            <div className={styles.meta}>
              Seul le contenu de « {artefact.title} » sera envoyé — pas l&apos;espace entier.
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fermer" type="button">
            ✕
          </button>
        </div>
        <div className={styles.body}>
          {checking ? (
            <p>Vérification de Gmail…</p>
          ) : !connected ? (
            <p>{GMAIL_NOT_CONNECTED_MESSAGE}</p>
          ) : done ? (
            <p>E-mail envoyé.</p>
          ) : (
            <>
              <label className={styles.shareLabel} htmlFor="share-artefact-to">
                Destinataires
              </label>
              <textarea
                id="share-artefact-to"
                className={styles.shareInput}
                rows={3}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="ex. marie@exemple.fr, paul@exemple.fr"
              />
              <p className={styles.shareHint}>Plusieurs adresses : séparez-les par une virgule.</p>
              <label className={styles.shareConfirm}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Je confirme l&apos;envoi de cet artefact par e-mail.
              </label>
              {error ? <p className={styles.shareError}>{error}</p> : null}
            </>
          )}
        </div>
        <div className={styles.foot}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            {done || !connected ? "Fermer" : "Annuler"}
          </button>
          {connected && !done ? (
            <button type="button" className={styles.btnPrim} onClick={() => void send()} disabled={busy}>
              {busy ? "Envoi…" : "Envoyer"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
