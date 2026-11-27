"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./StudioPubliciste.module.css";

/**
 * Le lecteur audio de la maquette : un bouton rond, une barre, le temps
 * restant. Un seul son à la fois dans toute la page (comme la maquette) :
 * lancer un extrait arrête le précédent.
 */
let actif: { audio: HTMLAudioElement; arreter: () => void } | null = null;

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function Lecteur({ src, libelle, petit }: { src: string; libelle: string; petit?: boolean }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [joue, setJoue] = useState(false);
  const [part, setPart] = useState(0);
  const [reste, setReste] = useState<string>("▶");
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    return () => {
      const a = ref.current;
      if (a) {
        a.pause();
        if (actif?.audio === a) actif = null;
      }
    };
  }, []);
  // Un nouveau fichier (extrait régénéré) : on repart de zéro.
  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    a.pause();
    a.removeAttribute("src");
    ref.current = null;
    setJoue(false);
    setPart(0);
    setReste("▶");
    setErreur(false);
  }, [src]);

  const basculer = () => {
    let a = ref.current;
    if (!a) {
      a = new Audio(src);
      a.preload = "auto";
      a.addEventListener("play", () => setJoue(true));
      a.addEventListener("pause", () => setJoue(false));
      a.addEventListener("ended", () => {
        setJoue(false);
        setPart(1);
      });
      a.addEventListener("timeupdate", () => {
        if (!a!.duration || !Number.isFinite(a!.duration)) return;
        setPart(a!.currentTime / a!.duration);
        setReste(fmt(a!.duration - a!.currentTime));
      });
      a.addEventListener("error", () => setErreur(true));
      ref.current = a;
    }
    if (!a.paused) return a.pause();
    if (actif && actif.audio !== a) actif.arreter();
    actif = { audio: a, arreter: () => a!.pause() };
    setErreur(false);
    a.play().catch(() => setErreur(true));
  };

  return (
    <div className={[styles.lecteur, petit ? styles.lecteurPetit : ""].join(" ")}>
      <button type="button" className={styles.play} aria-label={`${joue ? "Pause" : "Écouter"} ${libelle}`} onClick={basculer}>
        {joue ? (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        )}
      </button>
      <span className={styles.piste}>
        <i style={{ width: `${part * 100}%` }} />
      </span>
      <span className={styles.duree}>{erreur ? "erreur" : reste}</span>
    </div>
  );
}
