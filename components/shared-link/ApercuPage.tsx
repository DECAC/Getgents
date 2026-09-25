"use client";

import { useEffect, useState } from "react";
import type { Espace } from "@/lib/types";
import { readPublishedGents, syncPublishedGentsFromRemote } from "@/lib/publishedGents";
import { espacePourApercu } from "@/lib/espaceApiPayload";
import { ApercuGentShell } from "./SharedGentShell";
import { CollabPreviewShell } from "@/components/collab/CollabPreviewShell";

type Etat = { espace: Espace } | "chargement" | "introuvable";

const centre: React.CSSProperties = {
  minHeight: "100dvh",
  display: "grid",
  placeItems: "center",
  padding: 16,
  textAlign: "center",
  color: "var(--muted)",
  fontSize: 14,
};

/**
 * Aperçu d'un gent tel qu'un visiteur le découvrirait.
 *
 * La version de travail vient du cache local — le bouton Preview du studio
 * vient de l'y écrire — et, à défaut (autre appareil), du serveur. On ne lit
 * JAMAIS la version diffusée : l'aperçu sert justement à voir ce qui ne l'est
 * pas encore.
 */
export function ApercuPage({ gentId }: { gentId: string }) {
  const [etat, setEtat] = useState<Etat>("chargement");

  useEffect(() => {
    let annule = false;
    const local = readPublishedGents()[gentId];
    if (local) {
      setEtat({ espace: espacePourApercu(local) });
      return;
    }
    syncPublishedGentsFromRemote()
      .catch(() => null)
      .then(() => {
        if (annule) return;
        const distant = readPublishedGents()[gentId];
        setEtat(distant ? { espace: espacePourApercu(distant) } : "introuvable");
      });
    return () => {
      annule = true;
    };
  }, [gentId]);

  if (etat === "chargement") return <div style={centre}>Ouverture de l&apos;aperçu…</div>;
  if (etat === "introuvable") {
    return (
      <div style={centre}>
        <p>
          Ce gent n&apos;a pas encore de version de travail à prévisualiser.
          <br />
          Ouvrez-le dans le studio, puis cliquez sur Preview.
        </p>
      </div>
    );
  }
  // Event Manager : le salon a sa propre coquille d'aperçu, déjà fidèle à
  // celle des participants.
  if (etat.espace.collab?.enabled) return <CollabPreviewShell espace={etat.espace} />;
  return <ApercuGentShell gentId={gentId} espace={etat.espace} />;
}
