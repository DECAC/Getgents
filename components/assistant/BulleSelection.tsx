"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { extraitSelection } from "@/lib/enSavoirPlus";
import styles from "./BulleSelection.module.css";

interface Position {
  x: number;
  y: number;
  dessous: boolean;
}

/**
 * Bulle d'action sur le texte SURLIGNÉ d'une réponse du gent.
 *
 * N'apparaît que si la sélection tient entière dans une réponse du gent
 * (`[data-reponse-gent]`) : surligner sa propre question ou l'en-tête ne
 * propose rien. Rendue dans un portail : le panneau de conversation est un
 * tiroir TRANSFORMÉ sur téléphone, où un `position: fixed` serait confiné.
 *
 * Sur écran tactile, la bulle se place SOUS la sélection : au-dessus, le menu
 * natif du système (copier, rechercher…) la recouvrirait.
 */
export function BulleSelection({
  conteneur,
  onEnSavoirPlus,
  desactive,
}: {
  conteneur: RefObject<HTMLElement>;
  onEnSavoirPlus: (extrait: string) => void;
  desactive?: boolean;
}) {
  const [position, setPosition] = useState<Position | null>(null);
  const extraitRef = useRef<string | null>(null);

  const evaluer = useCallback(() => {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (!sel || sel.isCollapsed || !sel.rangeCount || !conteneur.current) {
      setPosition(null);
      return;
    }
    const noeud = (n: Node | null) => (n && n.nodeType === 1 ? (n as Element) : n?.parentElement ?? null);
    const debut = noeud(sel.anchorNode)?.closest("[data-reponse-gent]");
    const fin = noeud(sel.focusNode)?.closest("[data-reponse-gent]");
    if (!debut || debut !== fin || !conteneur.current.contains(debut)) {
      setPosition(null);
      return;
    }
    const extrait = extraitSelection(sel.toString());
    if (!extrait) {
      setPosition(null);
      return;
    }
    extraitRef.current = extrait;
    const r = sel.getRangeAt(0).getBoundingClientRect();
    const tactile = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const x = Math.min(Math.max(r.left + r.width / 2, 90), window.innerWidth - 90);
    setPosition({ x, y: tactile ? r.bottom + 10 : r.top - 10, dessous: tactile });
  }, [conteneur]);

  useEffect(() => {
    // `mouseup`/`touchend` : la sélection est finie ; `keyup` : sélection au
    // clavier ; `selectionchange` : pour la faire disparaître quand elle s'efface.
    const differe = () => window.setTimeout(evaluer, 0);
    const surChangement = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setPosition(null);
    };
    document.addEventListener("mouseup", differe);
    document.addEventListener("touchend", differe);
    document.addEventListener("keyup", differe);
    document.addEventListener("selectionchange", surChangement);
    const zone = conteneur.current;
    const masquer = () => setPosition(null);
    zone?.addEventListener("scroll", masquer, { passive: true });
    return () => {
      document.removeEventListener("mouseup", differe);
      document.removeEventListener("touchend", differe);
      document.removeEventListener("keyup", differe);
      document.removeEventListener("selectionchange", surChangement);
      zone?.removeEventListener("scroll", masquer);
    };
  }, [evaluer, conteneur]);

  if (!position || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={[styles.bulle, position.dessous ? styles.dessous : ""].filter(Boolean).join(" ")}
      style={{ left: position.x, top: position.y }}
      role="toolbar"
      aria-label="Actions sur le passage sélectionné"
    >
      <button
        type="button"
        className={styles.action}
        disabled={desactive}
        // Garder la sélection au clic : sans cela, elle s'efface avant l'action.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const extrait = extraitRef.current;
          if (!extrait) return;
          onEnSavoirPlus(extrait);
          window.getSelection()?.removeAllRanges();
          setPosition(null);
        }}
        title={desactive ? "Le gent répond encore" : "Le gent approfondit ce passage"}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
        </svg>
        En savoir plus
      </button>
    </div>,
    document.body
  );
}
