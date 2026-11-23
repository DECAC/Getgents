"use client";

import { useState } from "react";
import type { Langue, ReglageLangue } from "@/lib/langueLecteur";
import styles from "./pages.module.css";

export interface LangueLecteurs {
  reglage: ReglageLangue;
  detectee: Langue;
  /** La langue vient de la déclaration de la page (`<html lang>`), pas du texte. */
  declaree: boolean;
}

const NOM: Record<Langue, string> = { fr: "français", en: "anglais" };

/** Langue effective des lecteurs : le réglage, sinon ce que la page dit d'elle-même. */
export function langueDesLecteurs(l: LangueLecteurs | undefined): Langue {
  if (!l) return "fr";
  return l.reglage === "auto" ? l.detectee : l.reglage;
}

/**
 * « Langue pour vos lecteurs » (lot anglais 1), onglet Page de la fiche. Le
 * plus souvent rien à faire : la langue détectée s'affiche. L'interface de
 * l'auteur, elle, reste en français.
 */
export function BlocLangue({
  pageId,
  valeur,
  onChange,
  onMessage,
}: {
  pageId: string;
  valeur: LangueLecteurs;
  onChange: (v: LangueLecteurs) => void;
  onMessage: (m: string) => void;
}) {
  const [enCours, setEnCours] = useState(false);
  const effective = langueDesLecteurs(valeur);
  const choisir = async (reglage: ReglageLangue) => {
    setEnCours(true);
    try {
      const r = await fetch(`/api/pages/${encodeURIComponent(pageId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ langueLecteurs: reglage }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? "La langue n'a pas pu être modifiée.");
      onChange({ ...valeur, reglage });
      onMessage("Langue des lecteurs enregistrée.");
    } catch (e) {
      onMessage((e as Error).message);
    } finally {
      setEnCours(false);
    }
  };
  return (
    <section className={styles.bloc}>
      <h2 className={styles.blocTitre}>Langue pour vos lecteurs</h2>
      <div className={styles.langueLigne}>
        <select
          className={styles.champ}
          value={valeur.reglage}
          disabled={enCours}
          onChange={(e) => void choisir(e.target.value as ReglageLangue)}
          aria-label="Langue pour vos lecteurs"
        >
          <option value="auto">Automatique — {NOM[valeur.detectee]}</option>
          <option value="fr">Français</option>
          <option value="en">Anglais</option>
        </select>
        <span className={styles.languePastille}>{effective.toUpperCase()}</span>
      </div>
      {valeur.reglage === "auto" && (
        <p className={styles.aide}>
          Détecté : {NOM[valeur.detectee]}, {valeur.declaree ? "déclaré par la page" : "d'après son texte"}.
        </p>
      )}
      <p className={styles.aide}>
        Boutons, assistant, aperçu du lien, e-mails de vos lecteurs et modèles de message. Ce que vous écrivez vous-même (intitulé du bouton, questions
        suggérées) reste tel quel. Le lecteur peut aussi basculer FR | EN.
      </p>
    </section>
  );
}
