"use client";

import { useCallback, useEffect, useState } from "react";
import { CorpsArtefact } from "@/components/shared/ArtefactModal";
import { OutilsArtefact } from "@/components/shared/outils/OutilsArtefact";
import { cleOnglet, ID_ONGLET, lireMessageOnglet, type MessageOnglet } from "@/lib/ongletArtefact";
import type { Artefact } from "@/lib/types";
import styles from "./page.module.css";

/**
 * Un artefact ouvert dans son propre onglet, pour y travailler au large.
 *
 * Aucun espace ici : l'artefact arrive par le localStorage (voir
 * lib/ongletArtefact), et chaque modification y repart — l'onglet d'origine
 * l'applique, en créant une version pour une édition. Fermer cet onglet ne
 * perd donc rien.
 */
export default function PageArtefact({ params }: { params: { cle: string } }) {
  const [message, setMessage] = useState<MessageOnglet | null>(null);
  const [etat, setEtat] = useState<"chargement" | "pret" | "introuvable">("chargement");
  const [outils, setOutils] = useState(false);
  const [brouillon, setBrouillon] = useState<Artefact | null>(null);
  const suivreBrouillon = useCallback((b: Artefact | null) => setBrouillon(b), []);
  const [envoye, setEnvoye] = useState<string | null>(null);

  useEffect(() => {
    if (!ID_ONGLET.test(params.cle)) {
      setEtat("introuvable");
      return;
    }
    let m: MessageOnglet | null = null;
    try {
      m = lireMessageOnglet(window.localStorage.getItem(cleOnglet(params.cle)));
    } catch {
      m = null;
    }
    setMessage(m);
    setEtat(m ? "pret" : "introuvable");
    if (m) document.title = `${m.artefact.title} — Getgents`;
  }, [params.cle]);

  /** Renvoie l'artefact à l'onglet d'origine ; `resume` = une édition, donc une version. */
  const renvoyer = useCallback(
    (artefact: Artefact, resume?: string) => {
      if (!message) return;
      const suivant: MessageOnglet = { ...message, artefact, source: "onglet", resume, maj: Date.now() };
      setMessage(suivant);
      try {
        window.localStorage.setItem(cleOnglet(params.cle), JSON.stringify(suivant));
        setEnvoye(resume ? "Enregistré — une nouvelle version est créée dans votre espace." : null);
      } catch {
        setEnvoye("Impossible d'enregistrer : le stockage du navigateur est plein ou bloqué.");
      }
    },
    [message, params.cle]
  );

  if (etat === "chargement") return <main className={styles.page} />;
  if (etat === "introuvable" || !message) {
    return (
      <main className={styles.page}>
        <div className={styles.vide}>
          <h1>Artefact introuvable</h1>
          <p>
            Cet artefact n&apos;est plus disponible dans ce navigateur. Rouvrez-le depuis la conversation, avec
            « Ouvrir dans un onglet ».
          </p>
        </div>
      </main>
    );
  }

  const artefact = message.artefact;
  const affiche = outils && brouillon ? brouillon : artefact;

  return (
    <main className={styles.page}>
      <header className={styles.tete}>
        <div className={styles.teteTexte}>
          <h1 className={styles.titre}>{affiche.title}</h1>
          <div className={styles.meta}>
            <span className={styles.pill}>{affiche.type}</span>
            <span>Les modifications reviennent dans l&apos;onglet de la conversation.</span>
          </div>
        </div>
        <div className={styles.actions}>
          {message.modifiable !== false && (
            <button
              type="button"
              className={[styles.bouton, outils ? styles.boutonActif : ""].filter(Boolean).join(" ")}
              onClick={() => setOutils((o) => !o)}
              aria-pressed={outils}
            >
              Outils
            </button>
          )}
          <button type="button" className={styles.bouton} onClick={() => window.print()}>
            Télécharger en PDF
          </button>
        </div>
      </header>
      {envoye && (
        <p className={styles.bandeau} role="status">
          {envoye}
        </p>
      )}
      <div className={styles.corps}>
        <div className={styles.contenu}>
          <div className={styles.colonne}>
            <CorpsArtefact
              artefact={affiche}
              actions={
                outils && brouillon
                  ? {}
                  : {
                      cocher: (i) =>
                        renvoyer({
                          ...artefact,
                          checklistItems: artefact.checklistItems?.map((it, j) =>
                            j === i ? { ...it, checked: !it.checked } : it
                          ),
                        }),
                      cocherBloc: (blocId, i) =>
                        artefact.dashboard &&
                        renvoyer({
                          ...artefact,
                          dashboard: {
                            ...artefact.dashboard,
                            blocks: artefact.dashboard.blocks.map((b) =>
                              b.id === blocId && b.type === "checklist"
                                ? { ...b, items: b.items.map((it, j) => (j === i ? { ...it, checked: !it.checked } : it)) }
                                : b
                            ),
                          },
                        }),
                    }
              }
            />
          </div>
        </div>
        {outils && message.modifiable !== false && (
          <OutilsArtefact
            artefact={artefact}
            onApercu={suivreBrouillon}
            onEnregistrer={(apres, resume) => {
              renvoyer(apres, resume);
              setOutils(false);
            }}
            onFermer={() => setOutils(false)}
          />
        )}
      </div>
    </main>
  );
}
