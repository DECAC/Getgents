"use client";

import { Component, type ReactNode } from "react";
import styles from "./Prompteur.module.css";

/**
 * Un incident dans le prompteur (API du navigateur absente ou capricieuse —
 * caméra, micro, reconnaissance vocale) ne doit jamais emporter la page : sans
 * cette limite, React démontait l'espace entier, conversation comprise. Le
 * message d'erreur est AFFICHÉ, pour qu'il puisse être rapporté : sur un
 * téléphone, la console n'est pas à portée de main.
 */
export class LimitePrompteur extends Component<{ onClose: () => void; children: ReactNode }, { erreur: string | null }> {
  state = { erreur: null as string | null };

  static getDerivedStateFromError(e: unknown) {
    return { erreur: e instanceof Error ? `${e.name} : ${e.message}` : String(e) };
  }

  componentDidCatch(e: unknown) {
    console.error("[getgents:prompteur]", e);
  }

  render() {
    if (!this.state.erreur) return this.props.children;
    return (
      <div className={styles.voile} role="alertdialog" aria-label="Le prompteur a rencontré un problème">
        <div className={styles.resultat}>
          <div className={styles.carte}>
            <h2 className={styles.carteTitre}>Le prompteur n&apos;a pas pu démarrer</h2>
            <p className={styles.note}>
              Votre texte est gardé dans l&apos;espace (« Le gent »). Détail à transmettre :
            </p>
            <code className={styles.detailErreur}>{this.state.erreur}</code>
            <div className={styles.actions}>
              <button type="button" className={styles.bouton} onClick={this.props.onClose}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
