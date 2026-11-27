"use client";

import { Component, type ReactNode } from "react";
import styles from "./AtelierFilm.module.css";

/**
 * Un incident dans l'atelier (API audio ou vidéo du navigateur capricieuse)
 * ne doit jamais emporter la conversation : le détail est AFFICHÉ, pour être
 * rapporté — sur un téléphone, la console n'est pas à portée de main.
 */
export class LimiteAtelier extends Component<{ onClose: () => void; children: ReactNode }, { erreur: string | null }> {
  state = { erreur: null as string | null };

  static getDerivedStateFromError(e: unknown) {
    return { erreur: e instanceof Error ? `${e.name} : ${e.message}` : String(e) };
  }

  componentDidCatch(e: unknown) {
    console.error("[getgents:publiciste]", e);
  }

  render() {
    if (!this.state.erreur) return this.props.children;
    return (
      <div className={styles.voile} role="alertdialog" aria-label="L'atelier du film a rencontré un problème">
        <div className={styles.corps}>
          <div className={styles.resultat}>
            <p>L&apos;atelier du film n&apos;a pas pu s&apos;ouvrir. Le storyboard reste dans la conversation. Détail à transmettre :</p>
            <code className={styles.note}>{this.state.erreur}</code>
            <div className={styles.actions}>
              <button type="button" className={styles.boutonPrincipal} onClick={this.props.onClose}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
