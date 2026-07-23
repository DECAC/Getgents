"use client";

import { ARTEFACT_EXAMPLES } from "@/lib/mock-data/builder";
import type { ArtefactKind } from "@/lib/types/builder";
import { PinnedArtefactConfig } from "./PinnedArtefactConfig";
import styles from "./ArtefactsTab.module.css";

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
  timeline: (
    <svg width="88" height="56" viewBox="0 0 88 56" fill="none">
      <line x1="24" y1="10" x2="24" y2="46" stroke="var(--line)" strokeWidth="2" />
      <circle cx="24" cy="10" r="5.5" fill="var(--sage)" />
      <rect x="36" y="6.5" width="34" height="7" rx="3.5" fill="var(--line)" />
      <circle cx="24" cy="28" r="5.5" fill="var(--sage)" />
      <rect x="36" y="24.5" width="26" height="7" rx="3.5" fill="var(--line)" />
      <circle cx="24" cy="46" r="5.5" fill="none" stroke="var(--faint)" strokeWidth="2" />
      <rect x="36" y="42.5" width="30" height="7" rx="3.5" fill="var(--line-soft)" />
    </svg>
  ),
  budget: (
    <svg width="88" height="56" viewBox="0 0 88 56" fill="none">
      <line x1="12" y1="48" x2="76" y2="48" stroke="var(--line)" strokeWidth="1.5" />
      <rect x="20" y="26" width="12" height="22" rx="2.5" fill="var(--sage)" />
      <rect x="38" y="14" width="12" height="34" rx="2.5" fill="var(--gold)" />
      <rect x="56" y="32" width="12" height="16" rx="2.5" fill="var(--plum)" />
      <path d="M18 22l16-10 16 8 16-12" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="3 3" />
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

export function ArtefactsTab() {
  return (
    <div className={styles.wrap}>
      <PinnedArtefactConfig />
      <p className={styles.intro}>
        Ces artefacts sont générés <b>automatiquement</b> par le gent, au moment le plus pertinent
        de la conversation — aucune activation à faire ici : tous les types sont éligibles pour
        tous les gents. Voici des exemples illustratifs des formats disponibles.
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
          Le gent décide seul, au fil de la conversation, quel format produire s&apos;il détecte un
          contenu structurable (liste, chiffres, procédure, lieux…). L&apos;utilisateur final voit
          toujours une proposition qu&apos;il peut <b>ajouter</b> ou <b>ignorer</b> avant qu&apos;elle
          ne rejoigne son espace de travail — rien n&apos;est jamais ajouté sans son accord.
        </span>
      </div>
    </div>
  );
}
