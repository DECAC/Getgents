"use client";

import { ARTEFACT_EXAMPLES } from "@/lib/mock-data/builder";
import { useBuilder } from "@/lib/context/BuilderContext";
import { FREQUENCES_ARTEFACTS, type FrequenceArtefacts } from "@/lib/artefactSignal";
import type { ArtefactKind } from "@/lib/types/builder";
import styles from "./ArtefactExamples.module.css";

// Petites illustrations donnant un exemple visuel de chaque type d'artefact,
// pour que le créateur du gent comprenne d'un coup d'œil ce qui sera généré.
const ARTEFACT_ILLUSTRATION: Record<ArtefactKind, JSX.Element> = {
  report: (
    <svg width="88" height="56" viewBox="0 0 88 56" fill="none">
      <rect x="10" y="4" width="52" height="48" rx="4" fill="var(--card)" stroke="var(--line)" strokeWidth="1.5" />
      <rect x="18" y="14" width="28" height="4" rx="2" fill="var(--sage)" />
      <rect x="18" y="23" width="36" height="3" rx="1.5" fill="var(--line)" />
      <rect x="18" y="30" width="36" height="3" rx="1.5" fill="var(--line)" />
      <rect x="18" y="37" width="24" height="3" rx="1.5" fill="var(--line)" />
      <rect x="30" y="8" width="42" height="48" rx="4" fill="var(--card)" stroke="var(--line)" strokeWidth="1.5" />
      <rect x="38" y="18" width="26" height="4" rx="2" fill="var(--plum)" />
      <rect x="38" y="27" width="26" height="3" rx="1.5" fill="var(--line)" />
      <rect x="38" y="34" width="26" height="3" rx="1.5" fill="var(--line)" />
      <rect x="38" y="41" width="18" height="3" rx="1.5" fill="var(--line)" />
    </svg>
  ),
  checklist: (
    <svg width="88" height="56" viewBox="0 0 88 56" fill="none">
      <rect x="16" y="4" width="56" height="48" rx="5" fill="var(--card)" stroke="var(--line)" strokeWidth="1.5" />
      <rect x="25" y="14" width="9" height="9" rx="2.5" fill="var(--sage)" />
      <path d="M27.5 18.5l1.6 1.6 3-3.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="40" y="16.5" width="24" height="4" rx="2" fill="var(--line)" />
      <rect x="25" y="27" width="9" height="9" rx="2.5" fill="var(--sage)" />
      <path d="M27.5 31.5l1.6 1.6 3-3.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="40" y="29.5" width="24" height="4" rx="2" fill="var(--line)" />
      <rect x="25" y="40" width="9" height="9" rx="2.5" fill="none" stroke="var(--faint)" strokeWidth="1.6" />
      <rect x="40" y="42.5" width="18" height="4" rx="2" fill="var(--line-soft)" />
    </svg>
  ),
  visual: (
    <svg width="88" height="56" viewBox="0 0 88 56" fill="none">
      <rect x="10" y="6" width="68" height="44" rx="5" fill="var(--card)" stroke="var(--line)" strokeWidth="1.5" />
      <circle cx="26" cy="20" r="6" fill="var(--gold)" />
      <path d="M10 44l17-16 13 11 12-10 26 19v2H12a2 2 0 0 1-2-2z" fill="var(--sage)" opacity="0.85" />
      <path d="M40 46l12-10 26 19" fill="var(--sage-700)" opacity="0.5" />
    </svg>
  ),
  chart: (
    <svg width="88" height="56" viewBox="0 0 88 56" fill="none">
      <line x1="12" y1="48" x2="76" y2="48" stroke="var(--line)" strokeWidth="1.5" />
      <rect x="20" y="26" width="12" height="22" rx="2.5" fill="var(--sage)" />
      <rect x="38" y="14" width="12" height="34" rx="2.5" fill="var(--gold)" />
      <rect x="56" y="32" width="12" height="16" rx="2.5" fill="var(--plum)" />
    </svg>
  ),
  dashboard: (
    <svg width="88" height="56" viewBox="0 0 88 56" fill="none">
      <rect x="8" y="6" width="32" height="18" rx="3" fill="var(--card)" stroke="var(--line)" strokeWidth="1.5" />
      <rect x="14" y="11" width="14" height="4" rx="2" fill="var(--sage)" />
      <rect x="14" y="17" width="20" height="3" rx="1.5" fill="var(--line)" />
      <rect x="44" y="6" width="36" height="18" rx="3" fill="var(--card)" stroke="var(--line)" strokeWidth="1.5" />
      <rect x="50" y="11" width="18" height="4" rx="2" fill="var(--gold)" />
      <rect x="50" y="17" width="24" height="3" rx="1.5" fill="var(--line)" />
      <rect x="8" y="28" width="72" height="22" rx="3" fill="var(--card)" stroke="var(--line)" strokeWidth="1.5" />
      <rect x="16" y="40" width="8" height="6" rx="1.5" fill="var(--sage)" />
      <rect x="28" y="36" width="8" height="10" rx="1.5" fill="var(--gold)" />
      <rect x="40" y="38" width="8" height="8" rx="1.5" fill="var(--plum)" />
      <rect x="52" y="34" width="8" height="12" rx="1.5" fill="var(--sage)" />
    </svg>
  ),
  "profile-summary": (
    <svg width="88" height="56" viewBox="0 0 88 56" fill="none">
      <rect x="10" y="6" width="68" height="44" rx="5" fill="var(--card)" stroke="var(--line)" strokeWidth="1.5" />
      <circle cx="28" cy="24" r="8" fill="var(--sage-tint)" stroke="var(--sage)" strokeWidth="1.5" />
      <circle cx="28" cy="21" r="3" fill="var(--sage)" />
      <path d="M21 30c1.5-3 12.5-3 14 0" stroke="var(--sage)" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="42" y="16" width="28" height="4" rx="2" fill="var(--plum)" />
      <rect x="42" y="24" width="24" height="3" rx="1.5" fill="var(--line)" />
      <rect x="42" y="31" width="20" height="3" rx="1.5" fill="var(--line)" />
      <rect x="18" y="40" width="16" height="4" rx="2" fill="var(--gold)" />
      <rect x="38" y="40" width="16" height="4" rx="2" fill="var(--line-soft)" />
    </svg>
  ),
  image: (
    <svg width="88" height="56" viewBox="0 0 88 56" fill="none">
      <rect x="16" y="6" width="56" height="44" rx="5" fill="var(--card)" stroke="var(--line)" strokeWidth="1.5" />
      <circle cx="32" cy="20" r="5" fill="var(--gold)" />
      <path d="M16 42l14-12 10 8 8-7 24 15v4H20a4 4 0 0 1-4-4z" fill="var(--plum)" opacity="0.7" />
    </svg>
  ),
  map: (
    <svg width="88" height="56" viewBox="0 0 88 56" fill="none">
      <rect x="8" y="6" width="72" height="44" rx="5" fill="var(--card)" stroke="var(--line)" strokeWidth="1.5" />
      <path d="M14 40c8-14 12-18 20-14s14 2 20-8 12-6 20 4" stroke="var(--line)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M16 34c9-4 16 2 24-4s16-10 26 2" stroke="var(--sage)" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeDasharray="1 5" />
      <path
        d="M62 16c-4 0-7 3-7 7 0 5 7 12 7 12s7-7 7-12c0-4-3-7-7-7z"
        fill="var(--plum)"
      />
      <circle cx="62" cy="23" r="2.6" fill="#fff" />
    </svg>
  ),
};

const FREQUENCE_META: Record<FrequenceArtefacts, { label: string; aide: string }> = {
  discret: {
    label: "Discret",
    aide: "Seulement quand l'utilisateur le demande. Pour un gent qui converse avant tout.",
  },
  equilibre: {
    label: "Équilibré",
    aide: "Quand l'artefact apporte ce que le texte seul n'apporte pas : à garder, cocher, comparer.",
  },
  proactif: {
    label: "Proactif",
    aide: "Dès qu'une réponse contient une liste, des chiffres, des étapes ou des lieux.",
  },
};

/**
 * Réglage de la fréquence des artefacts, puis galerie des formats que le gent
 * peut produire. Le FORMAT n'est pas réglable, à dessein : personne ne sait
 * d'avance lequel servira. La FRÉQUENCE l'est — un gent vitrine et un gent
 * de démarches n'ont pas le même besoin de livrables. Vit sous « Gent
 * Conversationnel » depuis la disparition de l'onglet Artefacts.
 */
export function ArtefactExamples() {
  const { currentDraft, updateFrequenceArtefacts } = useBuilder();
  const frequence = currentDraft.frequenceArtefacts ?? "equilibre";
  return (
    <div className={styles.wrap}>
      <div className={styles.frequence}>
        <div className={styles.frequenceTitre} id="frequence-artefacts">
          Fréquence des artefacts
        </div>
        <div className={styles.frequenceChoix} role="radiogroup" aria-labelledby="frequence-artefacts">
          {FREQUENCES_ARTEFACTS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={frequence === f}
              className={[styles.frequenceOption, frequence === f ? styles.frequenceOn : ""].filter(Boolean).join(" ")}
              onClick={() => updateFrequenceArtefacts(f)}
            >
              <span className={styles.frequenceLabel}>{FREQUENCE_META[f].label}</span>
              <span className={styles.frequenceAide}>{FREQUENCE_META[f].aide}</span>
            </button>
          ))}
        </div>
        <p className={styles.frequenceNote}>
          Quel que soit le réglage, une demande explicite de l&apos;utilisateur produit toujours un
          artefact, et un artefact jeté n&apos;est jamais reproposé. Pris en compte à la prochaine
          diffusion.
        </p>
      </div>
      <p className={styles.intro}>
        Le gent choisit lui-même le <b>format</b> le plus utile parmi ceux-ci — aucun n&apos;est à
        activer. Exemples illustratifs :
      </p>
      <div className={styles.grid}>
        {ARTEFACT_EXAMPLES.map((tpl) => (
          <div key={tpl.id} className={styles.card}>
            <div className={styles.thumb}>{ARTEFACT_ILLUSTRATION[tpl.kind]}</div>
            <div className={styles.top}>
              <span className={styles.label}>{tpl.label}</span>
              <span className={styles.badge} title="Ce format est toujours disponible, sans configuration">
                Automatique
              </span>
            </div>
            <div className={styles.desc}>{tpl.description}</div>
          </div>
        ))}
      </div>
      <div className={styles.note}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <span>
          L&apos;utilisateur voit chaque artefact avant de le <b>garder</b> ou de le{" "}
          <b>jeter</b> — rien n&apos;est ajouté à son espace sans son accord. S&apos;il demande de
          modifier un artefact gardé, la nouvelle version le remplace au lieu de s&apos;y ajouter.
        </span>
      </div>
    </div>
  );
}
