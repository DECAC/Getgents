"use client";

import { useEffect, useState } from "react";
import {
  abonnerSauvegarde,
  flushRemoteDrafts,
  lireEtatSauvegarde,
  type EtatSauvegarde,
} from "@/lib/builderDraftStorage";
import styles from "./BoutonSauvegarde.module.css";

/**
 * Bouton d'enregistrement flottant, en bas à droite de l'écran central.
 *
 * Une mise au point s'impose, car elle change ce que ce bouton peut honnêtement
 * promettre : LE STUDIO ENREGISTRE DÉJÀ TOUT, SEUL. Chaque frappe part dans le
 * cache local puis, 1,5 s plus tard, vers le serveur. Il n'y a jamais eu de
 * configuration perdue faute d'avoir cliqué quelque part.
 *
 * Ce bouton ne crée donc pas une sauvegarde qui manquait. Il répare deux
 * choses bien réelles :
 *
 *   1. LE SILENCE. Rien à l'écran ne disait que l'enregistrement avait lieu.
 *      Un mécanisme invisible ne se laisse pas croire — d'où le sentiment
 *      légitime qu'il fallait « penser à sauver », et l'inquiétude de devoir
 *      dérouler la page pour chercher un bouton qui n'existait pas.
 *   2. LE DÉLAI. Pendant les 1,5 s d'anti-rebond, la modification n'est que
 *      locale. C'est court mais vrai : fermer l'onglet dans cette fenêtre perd
 *      les derniers caractères. Le clic écrit tout de suite.
 *
 * Il reste donc utile, mais il énonce l'état plutôt que de réclamer une
 * action — un bouton qui exige d'être cliqué pour ne rien perdre serait un
 * mensonge, ici.
 */

const LIBELLE: Record<EtatSauvegarde, string> = {
  repos: "Enregistrer",
  "en-attente": "Enregistrement…",
  enregistre: "Enregistré",
  echec: "Non enregistré",
};

export function BoutonSauvegarde() {
  const [etat, setEtat] = useState<EtatSauvegarde>("repos");

  useEffect(() => {
    setEtat(lireEtatSauvegarde());
    return abonnerSauvegarde(setEtat);
  }, []);

  // « Enregistré » revient au repos au bout de deux secondes : un état de
  // succès permanent finit par ne plus rien dire, et masquerait le passage
  // suivant en « Enregistrement… ».
  useEffect(() => {
    if (etat !== "enregistre") return;
    const t = window.setTimeout(() => setEtat(lireEtatSauvegarde() === "enregistre" ? "repos" : lireEtatSauvegarde()), 2000);
    return () => window.clearTimeout(t);
  }, [etat]);

  return (
    <button
      type="button"
      className={[styles.bouton, styles[etat]].filter(Boolean).join(" ")}
      onClick={() => flushRemoteDrafts()}
      // Le titre porte l'explication que le libellé n'a pas la place de dire.
      title="Vos modifications sont enregistrées automatiquement. Ce bouton écrit tout de suite, sans attendre."
    >
      <span className={styles.pastille} aria-hidden="true" />
      {LIBELLE[etat]}
    </button>
  );
}
