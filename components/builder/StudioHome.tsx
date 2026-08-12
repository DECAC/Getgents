"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  allocateDraftFromDescription,
  listVisibleDrafts,
  syncDraftsFromRemote,
} from "@/lib/builderDraftStorage";
import {
  exampleTab,
  STUDIO_CAPABILITY_LABEL,
  STUDIO_EXAMPLES,
  type StudioCreationTab,
  type StudioExample,
} from "@/lib/studioExamples";
import type { GentDraft } from "@/lib/types/builder";
import { ProductBrandMenu } from "@/components/shared/ProductBrandMenu";
import styles from "./StudioHome.module.css";

const MAX_RECENT = 6;

/**
 * Accueil du Gent' studio.
 *
 * Auparavant, /builder redirigeait vers le dernier gent ouvert (ou en créait un
 * au passage) : ouvrir le studio revenait donc à être parachuté dans un gent
 * qu'on n'avait pas demandé, et le bandeau du haut éditait ce gent-là. On part
 * désormais d'une page nue avec un champ unique — comme l'accueil du
 * Gent' space — où le créateur décrit le rôle de son gent. Cette description
 * crée le brouillon et amorce l'échange avec l'assistant du builder, qui le
 * poursuit dans l'interface de création.
 */
export function StudioHome() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [creating, setCreating] = useState(false);
  const [recent, setRecent] = useState<GentDraft[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setRecent(listVisibleDrafts());
    let cancelled = false;
    syncDraftsFromRemote().finally(() => {
      if (!cancelled) setRecent(listVisibleDrafts());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const start = useCallback(
    (description: string, tab: StudioCreationTab = "conversationnel", icon?: string) => {
      const text = description.trim();
      if (!text || creating) return;
      // `creating` reste vrai jusqu'à la navigation : un double clic ne doit
      // pas fabriquer deux brouillons pour une seule intention.
      setCreating(true);
      const id = allocateDraftFromDescription(text, icon);
      router.push(`/builder/${id}?tab=${tab}`);
    },
    [creating, router]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      start(role);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setRole(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
  }

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <ProductBrandMenu surface="studio" />
        {recent.length > 0 && (
          <a href="/builder/mesgents" className={styles.topLink}>
            Mes gents
            <span className={styles.count}>{recent.length}</span>
          </a>
        )}
      </header>

      <div className={styles.body}>
        <section className={styles.hero}>
          <h1 className={styles.title}>Quel gent voulez-vous construire ?</h1>
          <p className={styles.sub}>
            Décrivez son rôle en une phrase. On l&apos;installe dans le studio et on continue ensemble.
          </p>

          <form
            className={styles.composer}
            onSubmit={(e) => {
              e.preventDefault();
              start(role);
            }}
          >
            <textarea
              ref={textareaRef}
              className={styles.input}
              rows={1}
              value={role}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Ex. : un gent qui lit ma boîte Gmail et me prépare des réponses à valider…"
              aria-label="Décrivez le rôle de votre gent"
              disabled={creating}
              autoFocus
            />
            <button
              type="submit"
              className={styles.send}
              disabled={!role.trim() || creating}
              aria-label="Construire ce gent"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>
          <p className={styles.hint}>
            {creating ? "Préparation de votre gent…" : "Entrée pour lancer, Maj + Entrée pour aller à la ligne."}
          </p>
        </section>

        <section className={styles.examples} aria-labelledby="studio-examples-title">
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle} id="studio-examples-title">
              Ou partez d&apos;un exemple
            </h2>
            <p className={styles.sectionSub}>
              Chacun illustre des capacités déjà disponibles — connexion à vos outils, exécution planifiée,
              diffusion, lecture de documents, images, vidéo.
            </p>
          </div>

          <div className={styles.grid}>
            {STUDIO_EXAMPLES.map((example) => (
              <ExampleCard key={example.id} example={example} disabled={creating} onPick={start} />
            ))}
          </div>
        </section>

        {recent.length > 0 && (
          <section className={styles.recent} id="mes-gents" aria-labelledby="studio-recent-title">
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle} id="studio-recent-title">
                Reprendre un gent
              </h2>
              <p className={styles.sectionSub}>Vos gents existants, du plus récemment modifié au plus ancien.</p>
            </div>
            <div className={styles.recentList}>
              {recent.slice(0, MAX_RECENT).map((draft) => (
                <a key={draft.id} href={`/builder/${draft.id}?tab=conversationnel`} className={styles.recentItem}>
                  <span className={styles.recentIcon} aria-hidden="true">
                    {draft.icon}
                  </span>
                  <span className={styles.recentBody}>
                    <span className={styles.recentName}>{draft.name}</span>
                    <span className={styles.recentMeta}>
                      {draft.objective?.trim() || "Objectif à définir"}
                    </span>
                  </span>
                </a>
              ))}
            </div>
            {recent.length > MAX_RECENT && (
              <a href="/builder/mesgents" className={styles.allLink}>
                Voir les {recent.length} gents
              </a>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function ExampleCard({
  example,
  disabled,
  onPick,
}: {
  example: StudioExample;
  disabled: boolean;
  onPick: (description: string, tab: StudioCreationTab, icon?: string) => void;
}) {
  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => onPick(example.prompt, exampleTab(example), example.icon)}
      disabled={disabled}
    >
      <span className={styles.cardIcon} aria-hidden="true">
        {example.icon}
      </span>
      <span className={styles.cardTitle}>{example.title}</span>
      <span className={styles.cardPrompt}>{example.prompt}</span>
      <span className={styles.tags}>
        {example.capabilities.map((capability) => (
          <span key={capability} className={styles.tag}>
            {STUDIO_CAPABILITY_LABEL[capability]}
          </span>
        ))}
      </span>
    </button>
  );
}
