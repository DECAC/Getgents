"use client";

import { useCallback, useEffect, useState } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { appAccessHeaders } from "@/lib/appAccess";
import { AppAccessPrompt } from "@/components/shared/AppAccessPrompt";
import { describeShareLink, shareLinkState, shareLinkUrl, type ShareLink, type ShareLinkStats } from "@/lib/shareLink";
import styles from "./ShareLinksSection.module.css";

const EXPIRY_CHOICES = [
  { label: "7 jours", days: 7 },
  { label: "30 jours", days: 30 },
  { label: "90 jours", days: 90 },
  { label: "Sans expiration", days: 0 },
];

/**
 * Diffusion par lien personnalisé : un lien par cible, révocable, avec le
 * suivi de ce que la cible en a fait (ouverture, échanges, régénérations).
 */
export function ShareLinksSection() {
  const { currentDraft } = useBuilder();
  const gentId = currentDraft.id;

  const [links, setLinks] = useState<ShareLink[]>([]);
  const [stats, setStats] = useState<Record<string, ShareLinkStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAccessKey, setNeedsAccessKey] = useState(false);
  const [target, setTarget] = useState("");
  const [expiryDays, setExpiryDays] = useState(30);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedsAccessKey(false);
    try {
      const res = await fetch(`/api/links?gentId=${encodeURIComponent(gentId)}`, {
        cache: "no-store",
        headers: appAccessHeaders(),
      });
      const data = (await res.json()) as {
        links?: ShareLink[];
        stats?: Record<string, ShareLinkStats>;
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        if (res.status === 401) setNeedsAccessKey(true);
        else setError(data.hint ?? `Erreur : ${data.error ?? res.status}`);
        setLinks([]);
        return;
      }
      setLinks(data.links ?? []);
      setStats(data.stats ?? {});
    } catch (e) {
      setError(`Erreur réseau : ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [gentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createLink() {
    const label = target.trim();
    if (!label) return;
    setCreating(true);
    setError(null);
    try {
      const expiresAt =
        expiryDays > 0 ? new Date(Date.now() + expiryDays * 86_400_000).toISOString() : null;
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...appAccessHeaders() },
        body: JSON.stringify({ gentId, targetLabel: label, expiresAt }),
      });
      const data = (await res.json()) as { link?: ShareLink; error?: string; hint?: string };
      if (!res.ok) {
        if (res.status === 401) setNeedsAccessKey(true);
        else setError(data.hint ?? `Erreur : ${data.error ?? res.status}`);
        return;
      }
      setTarget("");
      await load();
    } catch (e) {
      setError(`Erreur réseau : ${(e as Error).message}`);
    } finally {
      setCreating(false);
    }
  }

  async function revoke(token: string) {
    setError(null);
    try {
      const res = await fetch(`/api/links/${encodeURIComponent(token)}`, {
        method: "DELETE",
        headers: appAccessHeaders(),
      });
      if (!res.ok) {
        if (res.status === 401) {
          setNeedsAccessKey(true);
          return;
        }
        const data = (await res.json()) as { error?: string };
        setError(`Erreur : ${data.error ?? res.status}`);
        return;
      }
      await load();
    } catch (e) {
      setError(`Erreur réseau : ${(e as Error).message}`);
    }
  }

  async function copy(token: string) {
    const url = shareLinkUrl(window.location.origin, token);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError(`Copie impossible — lien : ${url}`);
    }
  }

  const published = currentDraft.status === "published";

  return (
    <div className={styles.card}>
      <div className={styles.headRow}>
        <div>
          <h4 className={styles.title}>Lien personnalisé</h4>
          <div className={styles.sub}>
            Chaque cible reçoit son propre lien vers le gent en <b>utilisation simple</b> (artefact
            et conversation, sans accès au studio). Vous voyez si elle l&apos;a ouvert et ce
            qu&apos;elle en a fait.
          </div>
        </div>
      </div>

      {!published && (
        <div className={styles.warn}>
          Publiez d&apos;abord le gent : un lien pointe vers sa version publiée.
        </div>
      )}

      <div className={styles.createRow}>
        <input
          className={styles.input}
          placeholder="Cible (ex. Marie Dupont — Doctolib)"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void createLink()}
          aria-label="Libellé de la cible"
        />
        <select
          className={styles.select}
          value={expiryDays}
          onChange={(e) => setExpiryDays(parseInt(e.target.value, 10))}
          aria-label="Expiration du lien"
        >
          {EXPIRY_CHOICES.map((c) => (
            <option key={c.days} value={c.days}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.createBtn}
          onClick={() => void createLink()}
          disabled={creating || !target.trim()}
        >
          {creating ? "Création…" : "+ Créer le lien"}
        </button>
      </div>

      {needsAccessKey && <AppAccessPrompt onSaved={() => void load()} />}
      {error && <div className={styles.error}>{error}</div>}

      {needsAccessKey ? null : loading ? (
        <div className={styles.muted}>Chargement des liens…</div>
      ) : links.length === 0 ? (
        <div className={styles.muted}>Aucun lien pour ce gent.</div>
      ) : (
        <div className={styles.list}>
          {links.map((link) => {
            const state = shareLinkState(link);
            return (
              <div className={styles.row} key={link.token}>
                <div className={styles.rowMain}>
                  <div className={styles.rowTitle}>
                    <span className={[styles.dot, styles[`dot_${state}`]].join(" ")} aria-hidden="true" />
                    {link.targetLabel}
                  </div>
                  <div className={styles.rowStatus}>{describeShareLink(link, stats[link.token])}</div>
                </div>
                <button type="button" className={styles.smallBtn} onClick={() => void copy(link.token)}>
                  {copied === link.token ? "✓ Copié" : "Copier"}
                </button>
                {!link.revokedAt && (
                  <button
                    type="button"
                    className={styles.revokeBtn}
                    onClick={() => void revoke(link.token)}
                    title="Révoquer définitivement ce lien"
                  >
                    Révoquer
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.note}>
        Les liens exigent la persistance serveur (Supabase) : le destinataire n&apos;a pas votre
        cache local. Chaque mise à jour déclenchée par la cible consomme un appel au modèle — un
        quota par lien limite l&apos;usage.
      </div>
    </div>
  );
}
