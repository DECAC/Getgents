"use client";

import { useRouter } from "next/navigation";
import { COOKIE_LANGUE, LANGUES, type Langue } from "@/lib/langueLecteur";
import styles from "./partage.module.css";

/**
 * FR | EN dans le bandeau : le choix EXPLICITE du lecteur, gardé un an dans
 * un cookie fonctionnel (aucune mesure), lu par la page et par ses routes.
 * La page se rafraîchit côté serveur : le cadre du document n'est pas
 * rechargé, l'artefact garde son état.
 */
export function ChoixLangue({ langue, libelle }: { langue: Langue; libelle: string }) {
  const router = useRouter();
  const choisir = (l: Langue) => {
    if (l === langue) return;
    document.cookie = `${COOKIE_LANGUE}=${l}; Path=/; Max-Age=31536000; SameSite=Lax`;
    router.refresh();
  };
  return (
    <span className={styles.langue} role="group" aria-label={libelle}>
      {LANGUES.map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={l === langue} onClick={() => choisir(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </span>
  );
}
