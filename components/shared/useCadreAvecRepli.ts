"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/** Délai, après le chargement du cadre, pour recevoir le signal du document. */
export const DELAI_SIGNAL_MS = 1500;

/** L'adresse du document servi DIRECTEMENT par getgents.ai (sans domaine de contenu). */
export function adresseDirecte(src: string): string {
  return src + (src.includes("?") ? "&" : "?") + "direct=1";
}

/**
 * Repli quand le domaine de contenu est BLOQUÉ (filtre web d'entreprise,
 * « domaine récent », 16/11). Le document envoie `{getgents:"pret"}` dès son
 * premier script (`AMORCE_ARTEFACT`). Si le cadre a fini de charger sans ce
 * signal, ce qu'il affiche n'est pas notre document — une page de blocage, le
 * plus souvent : on le recharge depuis getgents.ai (`?direct=1`), l'état
 * d'avant le domaine séparé, isolé de la même façon (CSP `sandbox`).
 *
 * Seul le PREMIER chargement de chaque `cle` est jugé : une navigation
 * interne de l'artefact ne doit pas déclencher de repli. Le repli est
 * durable pour la vie du composant : un domaine bloqué le reste.
 */
export function useCadreAvecRepli(cle: string, cadreExistant?: RefObject<HTMLIFrameElement>) {
  const interne = useRef<HTMLIFrameElement>(null);
  const cadre = cadreExistant ?? interne;
  const [direct, setDirect] = useState(false);
  const recu = useRef(false);
  const juge = useRef(false);

  useEffect(() => {
    recu.current = false;
    juge.current = false;
  }, [cle]);

  useEffect(() => {
    const surMessage = (e: MessageEvent) => {
      if (e.source && e.source === cadre.current?.contentWindow && (e.data as { getgents?: string } | null)?.getgents) recu.current = true;
    };
    window.addEventListener("message", surMessage);
    return () => window.removeEventListener("message", surMessage);
  }, [cadre]);

  const onLoad = useCallback(() => {
    if (direct || juge.current) return;
    juge.current = true;
    window.setTimeout(() => {
      if (recu.current) return;
      console.info("[getgents] document sans signal : rechargement depuis getgents.ai");
      setDirect(true);
    }, DELAI_SIGNAL_MS);
  }, [direct]);

  return { cadre, direct, onLoad };
}
