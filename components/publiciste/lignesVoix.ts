"use client";

import { apiFetchInit } from "@/lib/apiFetch";
import type { EtatProjet } from "@/lib/publiciste";
import type { IdVoix } from "@/lib/publicisteDirection";
import type { Scene } from "@/lib/publicisteStoryboard";

/**
 * Publiciste, lot 4 : les répliques du storyboard dites par une voix. Chaque
 * réplique est UN fichier (une scène), généré à la demande et gardé dans le
 * projet tant que son texte ne change pas : l'animatique place chaque phrase
 * sur sa scène, « Texte entier » les enchaîne avec leurs silences.
 */
export const urlFichier = (projetId: string, nom: string) => `/api/publiciste/projets/${projetId}/fichiers/${nom}`;

/** Les scènes dont la réplique manque (ou a changé) pour cette voix. */
export function lignesManquantes(etat: EtatProjet, voix: IdVoix, scenes: Scene[]): Scene[] {
  const l = etat.voix?.lignes?.[voix] ?? {};
  return scenes.filter((s) => s.vo && l[s.id]?.texte !== s.vo);
}

/** Fait dire les répliques manquantes, deux à la fois (au-delà, Gemini répond 429). Rend le nombre d'échecs. */
export async function preparerLignes(
  projetId: string,
  voix: IdVoix,
  manquantes: Scene[],
  modifier: (f: (e: EtatProjet) => EtatProjet) => void,
  progres?: (faites: number) => void
): Promise<{ echecs: number; message?: string }> {
  const file = [...manquantes];
  let faites = 0;
  let echecs = 0;
  let message: string | undefined;
  const travailleur = async () => {
    for (let s = file.shift(); s; s = file.shift()) {
      try {
        const r = await fetch(
          `/api/publiciste/projets/${projetId}/voix`,
          apiFetchInit({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voix, texte: s.vo }) })
        );
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.message ?? `réf. ${r.status}`);
        const sc = s;
        modifier((e) => {
          const v = e.voix ?? { texte: "", extraits: {}, ecartees: [] };
          const lignes = { ...(v.lignes ?? {}) };
          lignes[voix] = { ...(lignes[voix] ?? {}), [sc.id]: { fichier: j.nom, texte: sc.vo } };
          return { ...e, voix: { ...v, lignes } };
        });
      } catch (e) {
        echecs++;
        message = (e as Error).message;
      }
      progres?.(++faites);
    }
  };
  await Promise.all([travailleur(), travailleur()]);
  return { echecs, message };
}

// ── Lecture enchaînée (« Texte entier ») : un seul lecteur pour la page ──
let enCours: { stop: () => void } | null = null;

export function arreterLecture() {
  enCours?.stop();
  enCours = null;
}

/** Enchaîne des fichiers avec un silence entre eux. `fin` est appelé à la fin, ou à l'arrêt. */
export function enchainer(urls: string[], silence = 0.8, fin?: () => void) {
  arreterLecture();
  let i = 0;
  let minuteur: ReturnType<typeof setTimeout> | null = null;
  const a = new Audio();
  let arrete = false;
  const suivant = () => {
    if (arrete) return;
    if (i >= urls.length) {
      enCours = null;
      return fin?.();
    }
    a.src = urls[i++];
    a.play().catch(() => suivant());
  };
  a.onended = () => {
    minuteur = setTimeout(suivant, silence * 1000);
  };
  enCours = {
    stop: () => {
      arrete = true;
      a.pause();
      if (minuteur) clearTimeout(minuteur);
      fin?.();
    },
  };
  suivant();
}
