"use client";

import { useEffect, useState } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { readPublishedGents } from "@/lib/publishedGents";
import { MODEL_CATALOG } from "@/lib/mock-data/builder";
import { describeMessage } from "@/lib/testReport";
import type { Espace, ConversationThread } from "@/lib/types";
import styles from "./AuditTab.module.css";

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

  // Les runs côté user sont persistés dans localStorage à chaque échange
  // (voir EspaceContext) : on relit à l'affichage de l'onglet.
  useEffect(() => {
    setEspace(readPublishedGents()[currentDraft.id] ?? null);
  }, [currentDraft.id, currentDraft.updatedAt]);

  const runs = (espace?.conversations ?? []).filter((t) => t.messages.length > 0);

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
    </div>
  );
}
