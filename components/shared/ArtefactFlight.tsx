"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEspace } from "@/lib/context/EspaceContext";
import styles from "./ArtefactFlight.module.css";

/**
 * Overlay « vol vers le canvas » : au moment où l'utilisateur ajoute un
 * artefact depuis le chat, une carte fantôme s'anime depuis la proposition
 * jusqu'à l'emplacement final de la carte dans le canvas, puis se fond dans
 * la carte réelle (qui joue sa propre animation de matérialisation).
 *
 * Robuste par conception : si la carte cible est introuvable (vue par thème
 * masquant l'artefact, hors écran non résolu…) ou si l'utilisateur préfère
 * les animations réduites, le vol est simplement ignoré — la matérialisation
 * et le badge « Nouveau » assurent seuls le retour visuel.
 */
export function ArtefactFlight() {
  const { artefactFlight, clearArtefactFlight } = useEspace();
  const [mounted, setMounted] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties | null>(null);
  const flightIdRef = useRef<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!artefactFlight) {
      setStyle(null);
      return;
    }

    flightIdRef.current = artefactFlight.id;
    const from = artefactFlight.from;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let done = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const finish = () => {
      if (done) return;
      done = true;
      clearArtefactFlight();
    };

    const start = () => {
      const target = document.querySelector<HTMLElement>(`[data-artefact-id="${artefactFlight.id}"]`);
      if (!target || reduce) {
        finish();
        return;
      }
      target.scrollIntoView({ block: "nearest", behavior: "auto" });

      requestAnimationFrame(() => {
        const to = target.getBoundingClientRect();
        // Position de départ (sur la proposition dans le chat).
        setStyle({ top: from.top, left: from.left, width: from.width, height: from.height, opacity: 1 });
        // Frame suivante : transition vers la carte cible.
        requestAnimationFrame(() => {
          setStyle({
            top: to.top,
            left: to.left,
            width: to.width,
            height: Math.min(to.height, 132),
            opacity: 0.12,
          });
        });
        timers.push(setTimeout(finish, 640));
      });
    };

    // Laisse le canvas rendre la nouvelle carte avant de mesurer la cible.
    timers.push(setTimeout(start, 40));
    return () => {
      done = true;
      timers.forEach(clearTimeout);
    };
  }, [artefactFlight, clearArtefactFlight]);

  if (!mounted || !artefactFlight || !style) return null;

  return createPortal(
    <div className={styles.ghost} style={style} aria-hidden="true">
      <span className={styles.ghostIcon}>{artefactFlight.icon}</span>
      <span className={styles.ghostTitle}>{artefactFlight.title}</span>
    </div>,
    document.body
  );
}
