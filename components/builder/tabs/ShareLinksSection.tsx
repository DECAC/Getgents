"use client";

import { useCallback, useEffect, useState } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { appAccessHeaders } from "@/lib/appAccess";
import { AppAccessPrompt } from "@/components/shared/AppAccessPrompt";
import {
  describeShareLink,
  shareLinkState,
  shareLinkUrl,
  shareLinkEmbedCode,
  type ShareLink,
  type ShareLinkStats,
} from "@/lib/shareLink";
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
  const [gentPublished, setGentPublished] = useState(true);
  const [target, setTarget] = useState("");
  const [expiryDays, setExpiryDays] = useState(30);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [embedToken, setEmbedToken] = useState<string | null>(null);
  // window n'existe pas au rendu serveur : l'origine est lue après montage.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

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
        gentPublished?: boolean;
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
      setGentPublished(data.gentPublished ?? true);
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

  // Canal « intégration web » : le même lien, livré sous forme d'iframe à
  // coller sur un site. Il en garde révocation, expiration et compteurs.
  function embedSnippet(token: string): string {
    return shareLinkEmbedCode(origin || "https://votre-domaine", token, currentDraft.name || "Gent");
  }

  async function copyEmbed(token: string) {
    const code = embedSnippet(token);
    try {
      await navigator.clipboard.writeText(code);
      setCopied(`embed:${token}`);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError(`Copie impossible — code d'intégration :\n${code}`);
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
            et conversation, sans accès au studio). <b>Intégrer</b> livre le même lien sous forme
            d&apos;<code>iframe</code> à coller sur un site. Vous voyez si elle l&apos;a ouvert et
            ce qu&apos;elle en a fait.
          </div>
        </div>
      </div>

      {!published && (
        <div className={styles.warn}>
          Diffusez d&apos;abord le gent : un lien pointe vers sa version diffusée.
        </div>
      )}

      {published && !loading && !needsAccessKey && !gentPublished && (
        <div className={styles.warn}>
          ⚠ Ce gent est marqué publié ici, mais <b>absent de la base serveur</b> — les liens
          pointeront vers du vide (« Contenu indisponible » côté visiteur). Cause fréquente :
          Supabase n&apos;était pas configuré au moment de la dernière publication. Cliquez à
          nouveau sur <b>Diffuser le gent</b> pour le pousser vers le serveur.
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
                  {copied === link.token ? "✓ Copié" : "Copier le lien"}
                </button>
                <button
                  type="button"
                  className={styles.smallBtn}
                  onClick={() => setEmbedToken((t) => (t === link.token ? null : link.token))}
                  aria-expanded={embedToken === link.token}
                  title="Afficher le code à coller sur un site web"
                >
                  {embedToken === link.token ? "Masquer l’intégration" : "Intégrer"}
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

                {embedToken === link.token && (
                  <div className={styles.embedPanel}>
                    <div className={styles.embedTitle}>Intégrer sur un site web</div>
                    <div className={styles.embedSub}>
                      Collez ce code dans le HTML de votre page, à l&apos;endroit où le gent doit
                      apparaître. Il fonctionne sur n&apos;importe quel site (WordPress, Webflow,
                      Notion, Squarespace…) et ne demande aucune installation.
                    </div>
                    <textarea
                      className={styles.embedCode}
                      readOnly
                      rows={5}
                      value={embedSnippet(link.token)}
                      onFocus={(e) => e.currentTarget.select()}
                      aria-label="Code d'intégration iframe"
                    />
                    <div className={styles.embedActions}>
                      <button
                        type="button"
                        className={styles.embedCopyBtn}
                        onClick={() => void copyEmbed(link.token)}
                      >
                        {copied === `embed:${link.token}` ? "✓ Code copié" : "Copier le code"}
                      </button>
                      <a
                        href={shareLinkUrl(origin, link.token)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.embedPreviewLink}
                      >
                        Ouvrir en plein écran ↗
                      </a>
                    </div>
                    <div className={styles.embedNote}>
                      Ce cadre affiche exactement le lien ci-dessus : le révoquer désactive aussi
                      l&apos;intégration, et le quota de régénérations reste celui du lien.
                    </div>
                  </div>
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
