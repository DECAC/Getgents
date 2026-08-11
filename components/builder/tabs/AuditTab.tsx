"use client";

import { useCallback, useEffect, useState } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { readPublishedGents } from "@/lib/publishedGents";
import { MODEL_CATALOG } from "@/lib/mock-data/builder";
import { describeMessage, buildEspaceReport } from "@/lib/testReport";
import { ReportMenu } from "@/components/shared/ReportMenu";
import { appAccessHeaders } from "@/lib/appAccess";
import { AppAccessPrompt } from "@/components/shared/AppAccessPrompt";
import { describeShareLink, type ShareLink, type ShareLinkStats } from "@/lib/shareLink";
import type { Espace, ConversationThread } from "@/lib/types";
import styles from "./AuditTab.module.css";

function formatWhen(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function modelLabel(id?: string): string {
  if (!id) return "Modèle par défaut";
  return MODEL_CATALOG.find((m) => m.id === id)?.label ?? id;
}

/** Sources de données réellement sollicitées pendant un run (appels d'outils + web). */
function runDatasources(thread: ConversationThread, espace: Espace): { label: string; ok: boolean }[] {
  const sources: { label: string; ok: boolean }[] = [];
  const seen = new Set<string>();
  for (const m of thread.messages) {
    if (m.role !== "tool" || !m.what) continue;
    const key = `${m.kind} ${m.what}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({ label: `${m.kind === "MCP" ? "Connecteur" : m.kind} · ${m.what}`, ok: m.ok !== false });
  }
  if (espace.webSearch) sources.push({ label: "Recherche web (plugin OpenRouter)", ok: true });
  return sources;
}

function reasoningKind(thread: ConversationThread): string {
  const hasReasoning = thread.messages.some((m) => m.role === "agent" && !!m.reasoning);
  const hasTools = thread.messages.some((m) => m.role === "tool");
  if (hasReasoning && hasTools) return "Raisonnement étendu + boucle d'outils";
  if (hasReasoning) return "Raisonnement étendu (chaîne visible)";
  if (hasTools) return "Boucle d'outils (appels de sources)";
  return "Réponse directe";
}

export function AuditTab() {
  const { currentDraft } = useBuilder();
  const [espace, setEspace] = useState<Espace | null>(null);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [linkStats, setLinkStats] = useState<Record<string, ShareLinkStats>>({});
  const [linksNeedAccessKey, setLinksNeedAccessKey] = useState(false);

  // Les runs côté user sont persistés dans localStorage à chaque échange
  // (voir EspaceContext) : on relit à l'affichage de l'onglet.
  useEffect(() => {
    setEspace(readPublishedGents()[currentDraft.id] ?? null);
  }, [currentDraft.id, currentDraft.updatedAt]);

  // Les liens de partage vivent en base (pas dans l'espace) : requête dédiée.
  const loadLinks = useCallback(() => {
    setLinksNeedAccessKey(false);
    fetch(`/api/links?gentId=${encodeURIComponent(currentDraft.id)}`, {
      cache: "no-store",
      credentials: "include",
      headers: appAccessHeaders(),
    })
      .then((res) => {
        if (res.status === 401) {
          setLinksNeedAccessKey(true);
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data: { links?: ShareLink[]; stats?: Record<string, ShareLinkStats> } | null) => {
        if (!data) return;
        setLinks(data.links ?? []);
        setLinkStats(data.stats ?? {});
      })
      .catch(() => {
        // Partage non configuré : la section reste simplement vide.
      });
  }, [currentDraft.id]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const runs = (espace?.conversations ?? []).filter((t) => t.messages.length > 0);
  const pinnedRuns = espace?.pinnedArtefact?.runs ?? [];

  if (!espace) {
    return (
      <div className={styles.wrap}>
        <h4 className={styles.sectionTitle}>Audit des runs</h4>
        <div className={styles.empty}>
          Ce gent n&apos;a pas encore été publié. Publiez-le puis testez-le côté utilisateur : chaque
          conversation apparaîtra ici avec son détail complet.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <h4 className={styles.sectionTitle}>Audit des runs</h4>
      <p className={styles.sectionSub}>
        Chaque conversation menée côté utilisateur avec « {espace.name} », avec le type de
        raisonnement, les sources de données réellement sollicitées et le modèle utilisé.
      </p>

      {runs.length === 0 ? (
        <div className={styles.empty}>
          Aucun run pour l&apos;instant. Ouvrez l&apos;espace côté utilisateur (« Voir côté
          utilisateur ») et conversez avec le gent : les runs s&apos;afficheront ici.
        </div>
      ) : (
        runs.map((thread, idx) => {
          const sources = runDatasources(thread, espace);
          const userMsgs = thread.messages.filter((m) => m.role === "user").length;
          const failures = thread.messages.filter((m) => m.role === "tool" && m.ok === false).length;
          return (
            <details className={styles.run} key={thread.id}>
              <summary className={styles.runHead}>
                <span className={styles.runTitle}>
                  Run {runs.length - idx} <span className={styles.runDate}>· {thread.startedAt}</span>
                </span>
                <span className={styles.runMeta}>
                  {userMsgs} message{userMsgs > 1 ? "s" : ""} utilisateur
                  {failures > 0 && <span className={styles.runFail}> · {failures} appel(s) en échec</span>}
                </span>
              </summary>
              <dl className={styles.factList}>
                <div><dt>Modèle LLM</dt><dd>{modelLabel(espace.chatModelId)}</dd></div>
                <div><dt>Type de raisonnement</dt><dd>{reasoningKind(thread)}</dd></div>
                <div>
                  <dt>Sources de données</dt>
                  <dd>
                    {sources.length === 0
                      ? "Aucune source externe sollicitée (réponse sur connaissances du modèle)"
                      : sources.map((s, i) => (
                          <span key={i} className={[styles.sourceChip, s.ok ? "" : styles.sourceKo].join(" ")}>
                            {s.ok ? "●" : "✕"} {s.label}
                          </span>
                        ))}
                  </dd>
                </div>
              </dl>
              <div className={styles.transcript}>
                {thread.messages.map((m, i) => (
                  <div className={styles.line} key={i}>
                    {describeMessage(m).replace(/\*\*/g, "")}
                  </div>
                ))}
              </div>
            </details>
          );
        })
      )}

      <h4 className={styles.sectionTitle}>Artefact figé</h4>
      <p className={styles.sectionSub}>
        Chaque génération du tableau de bord, succès comme échec, avec le modèle réellement utilisé
        et le diagnostic renvoyé par le fournisseur.
      </p>
      {!espace.pinnedArtefact?.enabled ? (
        <div className={styles.empty}>
          L&apos;artefact figé n&apos;est pas activé pour ce gent (onglet Prompt).
        </div>
      ) : pinnedRuns.length === 0 ? (
        <div className={styles.empty}>
          Aucune génération enregistrée. Ouvrez l&apos;espace utilisateur et lancez une mise à jour
          de l&apos;artefact.
        </div>
      ) : (
        pinnedRuns.map((run, idx) => (
          <details className={styles.run} key={`${run.at}-${idx}`}>
            <summary className={styles.runHead}>
              <span className={styles.runTitle}>
                {run.ok ? "✓" : "✕"} Génération <span className={styles.runDate}>· {formatWhen(run.at)}</span>
              </span>
              <span className={styles.runMeta}>
                {run.source === "lien" ? "via lien de partage" : "depuis l'espace"}
                {!run.ok && <span className={styles.runFail}> · échec</span>}
              </span>
            </summary>
            <dl className={styles.factList}>
              <div><dt>Résultat</dt><dd>{run.note}</dd></div>
              <div><dt>Modèle utilisé</dt><dd>{modelLabel(run.model)}</dd></div>
              <div>
                <dt>Durée</dt>
                <dd>{run.durationMs != null ? `${(run.durationMs / 1000).toFixed(1)} s` : "—"}</dd>
              </div>
              <div>
                <dt>Tentatives</dt>
                <dd>{run.attempts ?? "—"}{run.attempts && run.attempts > 1 ? " (repli déclenché)" : ""}</dd>
              </div>
              <div><dt>Blocs produits</dt><dd>{run.blocks ?? "—"}</dd></div>
              <div><dt>Tokens</dt><dd>{run.totalTokens ?? "—"}</dd></div>
              {run.httpStatus != null && run.httpStatus >= 400 && (
                <div><dt>Statut HTTP</dt><dd>{run.httpStatus}</dd></div>
              )}
            </dl>
          </details>
        ))
      )}

      <div className={styles.reportRow}>
        <ReportMenu
          getMarkdown={() =>
            buildEspaceReport(
              espace,
              links.map((link) => ({ link, stats: linkStats[link.token] }))
            )
          }
          baseName={espace.name}
        />
      </div>

      <h4 className={styles.sectionTitle}>Diffusion par lien</h4>
      <p className={styles.sectionSub}>
        Les liens personnalisés émis pour ce gent et ce que chaque cible en a fait.
      </p>
      {linksNeedAccessKey ? (
        <AppAccessPrompt onSaved={loadLinks} />
      ) : links.length === 0 ? (
        <div className={styles.empty}>
          Aucun lien émis (onglet Diffusion). Le partage exige la persistance serveur.
        </div>
      ) : (
        links.map((link) => (
          <details className={styles.run} key={link.token}>
            <summary className={styles.runHead}>
              <span className={styles.runTitle}>{link.targetLabel}</span>
              <span className={styles.runMeta}>{describeShareLink(link, linkStats[link.token])}</span>
            </summary>
            <dl className={styles.factList}>
              <div><dt>Créé le</dt><dd>{formatWhen(link.createdAt)}</dd></div>
              <div><dt>Expiration</dt><dd>{link.expiresAt ? formatWhen(link.expiresAt) : "sans expiration"}</dd></div>
              <div><dt>Ouvertures</dt><dd>{linkStats[link.token]?.openCount ?? 0}</dd></div>
              <div><dt>Échanges</dt><dd>{linkStats[link.token]?.chatCount ?? 0}</dd></div>
              <div>
                <dt>Mises à jour</dt>
                <dd>{link.refreshCount} / {link.maxRefresh}</dd>
              </div>
              <div><dt>Dernière activité</dt><dd>{formatWhen(linkStats[link.token]?.lastEventAt)}</dd></div>
            </dl>
          </details>
        ))
      )}
    </div>
  );
}
