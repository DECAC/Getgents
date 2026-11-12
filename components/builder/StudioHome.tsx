"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  allocateDraftFromDescription,
  listVisibleDrafts,
  ONGLET_DU_FORMAT,
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
import { SelecteurMode } from "@/components/shared/SelecteurMode";
import { cibleDuMode } from "@/lib/navigationModes";
import { LIBELLE_STATUT, peutEtreOuvert, statutGent } from "@/lib/statutGent";
import { BrandIcon } from "@/components/shared/BrandMark";
import type { LignePage } from "@/lib/pagesGetsite";
import styles from "./StudioHome.module.css";

const MAX_RECENT = 6;
const MAX_PAGES = 4;

const dateCourte = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

/**
 * Accueil de Getgents (le logo y ramène, depuis les deux modes).
 *
 * Un nouveau venu y décrit le gent à construire ; qui a déjà des gents les
 * voit d'abord, pour s'en servir — la création reste juste en dessous.
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
  // Pages partagées depuis Claude (rubrique GetSite). Un échec ou une absence
  // de compte laisse la section absente : l'accueil n'en dépend pas.
  const [pages, setPages] = useState<LignePage[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setRecent(listVisibleDrafts());
    let cancelled = false;
    syncDraftsFromRemote().finally(() => {
      if (!cancelled) setRecent(listVisibleDrafts());
    });
    fetch("/api/pages", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { pages?: LignePage[] } | null) => {
        if (!cancelled && d?.pages) setPages(d.pages);
      })
      .catch(() => undefined);
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
      // Le format de l'exemple est ACTIVÉ, pas seulement affiché : arriver sur
      // l'onglet Mini App d'un gent dont la mini-app est éteinte obligeait à
      // trouver l'interrupteur.
      const id = allocateDraftFromDescription(text, icon, tab);
      router.push(`/builder/${id}?tab=${ONGLET_DU_FORMAT[tab]}`);
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
        <SelecteurMode enTete />
        {recent.length > 0 && (
          <a href="/builder/mesgents" className={styles.topLink}>
            Mes gents
            <span className={styles.count}>{recent.length}</span>
          </a>
        )}
      </header>

      <div className={styles.body}>
        {/* L'accueil suit l'utilisateur : qui a déjà des gents vient d'abord
            s'en servir — ils passent devant, la création reste juste dessous. */}
        {recent.length > 0 && (
          <section className={styles.recent} id="mes-gents" aria-labelledby="studio-recent-title">
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle} id="studio-recent-title">
                Vos gents
              </h2>
              <p className={styles.sectionSub}>Ouvrez-en un pour vous en servir, du plus récemment modifié au plus ancien.</p>
            </div>
            <div className={styles.recentList}>
              {recent.slice(0, MAX_RECENT).map((draft) => (
                // Un gent diffusé s'ouvre pour s'en servir ; un brouillon, qui n'a
                // pas encore d'espace, ouvre ses réglages.
                <a
                  key={draft.id}
                  href={peutEtreOuvert(statutGent(draft)) ? cibleDuMode("utiliser", draft) : cibleDuMode("construire", draft)}
                  className={styles.recentItem}
                >
                  <span className={styles.recentIcon} aria-hidden="true">
                    <BrandIcon variant="fillSm" />
                  </span>
                  <span className={styles.recentBody}>
                    <span className={styles.recentName}>{draft.name}</span>
                    <span className={styles.recentMeta}>
                      {LIBELLE_STATUT[statutGent(draft)]} · {draft.objective?.trim() || "Objectif à définir"}
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
        {pages.length > 0 && (
          <section className={styles.recent} aria-labelledby="studio-pages-title">
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle} id="studio-pages-title">
                Vos dernières pages
              </h2>
              <p className={styles.sectionSub}>Partagées depuis Claude. Ouvrez-en une pour voir ses destinataires.</p>
            </div>
            <div className={styles.recentList}>
              {pages.slice(0, MAX_PAGES).map((p) => (
                <a key={p.id} href={`/pages/${p.id}`} className={`${styles.recentItem} ${styles.recentItemPage}`} title={`Mise à jour le ${dateCourte(p.updatedAt)}`}>
                  <span className={`${styles.recentIcon} ${styles.recentIconPage}`} aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                      <path d="M14 3v5h5M9 13h6M9 17h4" />
                    </svg>
                  </span>
                  <span className={styles.recentBody}>
                    <span className={styles.recentName}>{p.titre}</span>
                    <span className={styles.recentMeta}>
                      {/* La date est dans l'info-bulle et dans la rubrique : ici, la ligne
                          coupait au milieu (« mise à jour l… »). */}
                      {[p.actifs ? `${p.actifs} destinataire${p.actifs > 1 ? "s" : ""}` : "Aucun lien actif", p.assistant ? "Assistant IA" : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </a>
              ))}
            </div>
            {pages.length > MAX_PAGES && (
              <a href="/pages" className={styles.allLink}>
                Voir les {pages.length} pages
              </a>
            )}
          </section>
        )}
        <section className={styles.hero}>
          <h1 className={[styles.title, recent.length > 0 ? styles.titleSecond : ""].filter(Boolean).join(" ")}>
            {recent.length > 0 ? "Ou construisez un nouveau gent" : "Quel gent voulez-vous construire ?"}
          </h1>
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
        <BrandIcon variant="fillSm" />
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
