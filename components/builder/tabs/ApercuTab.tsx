"use client";

import { useBuilder } from "@/lib/context/BuilderContext";
import { buildAppPreviewEvolveRequest, buildAppPreviewRequest } from "@/lib/appPreview";
import { AppPreview } from "@/components/appPreview/AppPreview";
import styles from "./ApercuTab.module.css";

/**
 * Aperçu de l'application : ce que produira le gent à l'usage, dessiné avec
 * des données simulées. L'aperçu n'est pas un écran de configuration — il se
 * construit en discutant avec l'assistant du builder, qui émet des modules
 * (onglets thématiques + blocs typés) appliqués ici immédiatement. Le créateur
 * voit donc son application prendre forme au fil de la conversation, au lieu
 * de devoir publier puis ouvrir l'espace pour découvrir le résultat.
 */
export function ApercuTab() {
  const { currentDraft, sendBuilderMessage, clearAppPreview, isThinking } = useBuilder();
  const preview = currentDraft.appPreview;
  const hasPreview = !!preview?.modules.length;

  function requestPreview() {
    if (hasPreview && preview) {
      sendBuilderMessage(buildAppPreviewEvolveRequest(preview), { mode: "apercu-ask" });
      return;
    }
    sendBuilderMessage(buildAppPreviewRequest(currentDraft.objective ?? ""), { mode: "apercu" });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.intro}>
        <div className={styles.introText}>
          <h4 className={styles.title}>Aperçu de l&apos;application</h4>
          <div className={styles.sub}>
            Voici l&apos;application que votre gent produira à l&apos;usage, remplie de données
            simulées. « Faire évoluer l&apos;aperçu » propose des pistes cliquables dans la
            conversation — y compris « Autre » pour préciser votre idée.
          </div>
        </div>
        <div className={styles.introActions}>
          {hasPreview && (
            <button type="button" className={styles.ghostBtn} onClick={clearAppPreview} disabled={isThinking}>
              Vider
            </button>
          )}
          <button type="button" className={styles.primaryBtn} onClick={requestPreview} disabled={isThinking}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
            </svg>
            {isThinking ? "Génération…" : hasPreview ? "Faire évoluer l'aperçu" : "Générer l'aperçu"}
          </button>
        </div>
      </div>

      {hasPreview ? (
        <div className={styles.frame}>
          <div className={styles.frameBar}>
            <div className={styles.frameMark}>{currentDraft.icon || "✦"}</div>
            <div>
              <div className={styles.frameName}>
                {preview?.appName || currentDraft.name || "Application du gent"}
              </div>
              <div className={styles.frameSub}>
                {preview?.modules.length} module{(preview?.modules.length ?? 0) > 1 ? "s" : ""} ·{" "}
                {preview?.themes.length} onglet{(preview?.themes.length ?? 0) > 1 ? "s" : ""}
              </div>
            </div>
            <span className={styles.frameBadge}>
              <span className={styles.liveDot} />
              données simulées
            </span>
          </div>
          <div className={styles.frameBody}>
            <AppPreview
              spec={preview!}
              freshIds={currentDraft.appPreviewFreshIds ?? []}
              building={isThinking}
              onAsk={(prompt) => sendBuilderMessage(prompt, { mode: "apercu" })}
            />
          </div>
        </div>
      ) : (
        <div className={styles.empty}>
          <div className={styles.emptyMark}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <path d="M3 9h18M8 4v5" />
            </svg>
          </div>
          <div className={styles.emptyTitle}>Rien à montrer pour l&apos;instant</div>
          <div className={styles.emptyText}>
            {isThinking
              ? "L'assistant réfléchit — les premiers modules apparaîtront ici dès qu'il aura répondu."
              : "Lancez la génération, ou demandez simplement à l'assistant « montre-moi à quoi ressemblera l'application » : les onglets et les modules se dessineront ici."}
          </div>
          <div className={styles.hint}>
            <span className={styles.hintDot} />
            Tout ce qui s&apos;affiche ici est une démonstration — aucune donnée réelle n&apos;est
            appelée.
          </div>
        </div>
      )}
    </div>
  );
}
