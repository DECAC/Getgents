"use client";

import { BrandIcon } from "@/components/shared/BrandMark";
import { cibleDuMode, MODES, ORDRE_MODES, type GentOuvert, type Mode } from "@/lib/navigationModes";
import styles from "./SelecteurMode.module.css";

/**
 * Navigation principale : le logo ramène à l'accueil, et trois modes,
 * toujours visibles — Utiliser (GetSpace), Construire (GetStudio) et Pages
 * (GetSite).
 *
 * Elle remplace un menu déroulant caché derrière le logo, qui ne montrait
 * jamais la section où l'on était et proposait trois marques pour deux
 * gestes. Changer de mode garde le gent ouvert (`cibleDuMode`).
 */
export function SelecteurMode({
  mode,
  gent,
  compact = false,
  enTete = false,
  aCote,
  produitSeul,
}: {
  /** Mode courant ; absent sur l'accueil, qui n'appartient à aucun des deux. */
  mode?: Mode;
  /** Gent ouvert : changer de mode le garde. */
  gent?: GentOuvert | null;
  /** Rail replié : icônes seules, empilées. */
  compact?: boolean;
  /** Dans un en-tête de page : largeur bornée, libellés masqués sur téléphone. */
  enTete?: boolean;
  /** Commande posée sur la ligne du logo, à droite (le repli du rail). */
  aCote?: React.ReactNode;
  /**
   * Compte limité à un seul produit (offre « Getgents Pages », lib/offre.ts) :
   * son nom à la place des modes, et le logo y ramène.
   */
  produitSeul?: { nom: string; sousTitre: string; href: string };
}) {
  if (produitSeul)
    return (
      <div className={[styles.wrap, compact ? styles.compact : ""].filter(Boolean).join(" ")}>
        <a href={produitSeul.href} className={styles.logo} title={produitSeul.nom} aria-label={produitSeul.nom}>
          <BrandIcon size={22} />
        </a>
        {!compact && (
          <span className={styles.produit}>
            <b>{produitSeul.nom}</b>
            <small>{produitSeul.sousTitre}</small>
          </span>
        )}
        {aCote && <span className={styles.aCote}>{aCote}</span>}
      </div>
    );
  return (
    <div className={[styles.wrap, compact ? styles.compact : "", enTete ? styles.enTete : ""].filter(Boolean).join(" ")}>
      <a href="/accueil" className={styles.logo} title="Accueil Getgents" aria-label="Accueil Getgents">
        <BrandIcon size={22} />
      </a>
      {aCote && <span className={styles.aCote}>{aCote}</span>}
      <nav className={styles.modes} aria-label="Mode">
        {ORDRE_MODES.map((m) => {
          const d = MODES[m];
          const actif = m === mode;
          return (
            <a
              key={m}
              href={cibleDuMode(m, gent)}
              className={[styles.mode, actif ? styles.actif : ""].filter(Boolean).join(" ")}
              aria-current={actif ? "page" : undefined}
              title={`${d.libelle} — ${d.sous} (${d.marque})`}
            >
              <span className={styles.icone} aria-hidden="true">
                {m === "pages" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                    <path d="M14 3v5h5M9 13h6M9 17h4" />
                  </svg>
                ) : m === "utiliser" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-4.6A8.4 8.4 0 1 1 21 11.5z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
                  </svg>
                )}
              </span>
              {!compact && <span className={styles.libelle}>{d.libelle}</span>}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
