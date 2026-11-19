"use client";

import { cleInvite } from "@/lib/groupesPages";
import styles from "./partage.module.css";

/**
 * Lien de groupe : « Qui êtes-vous ? » par-dessus la page. Les prénoms qui
 * ont déjà répondu sont grisés et ne se choisissent plus (choix de l'éditeur :
 * visible de tous, c'est ce qui pousse les retardataires). Le choix n'est
 * PAS vérifié — l'auteur le sait, la création du lien le dit.
 */
export function ChoixPrenom({
  invites,
  repondus,
  onChoisir,
  onFermer,
}: {
  invites: string[];
  repondus: string[];
  onChoisir: (prenom: string) => void;
  /** Absent à la première ouverture : il faut choisir. Présent quand on « change ». */
  onFermer?: () => void;
}) {
  const fait = new Set(repondus.map(cleInvite));
  return (
    <div className={styles.confVoile} data-flou="oui">
      <div className={styles.quiBoite} role="dialog" aria-modal="true" aria-labelledby="qui-titre">
        {onFermer && (
          <button type="button" className={styles.confFermer} aria-label="Fermer" onClick={onFermer}>
            ✕
          </button>
        )}
        <h2 id="qui-titre" className={styles.engagementTitre}>
          Qui êtes-vous ?
        </h2>
        <p className={styles.quiTexte}>Choisissez votre prénom : votre réponse sera transmise à l&apos;auteur sous ce nom.</p>
        <div className={styles.quiPrenoms}>
          {invites.map((p) => {
            const deja = fait.has(cleInvite(p));
            return (
              <button key={p} type="button" className={styles.quiPrenom} data-fait={deja ? "oui" : "non"} disabled={deja} onClick={() => onChoisir(p)}>
                {p}
                {deja && <small>a déjà répondu</small>}
              </button>
            );
          })}
        </div>
        <p className={styles.quiPied}>
          Vous n&apos;êtes pas dans la liste ? Demandez à l&apos;auteur de vous ajouter. Votre choix est retenu sur cet appareil ; « Changer » dans le bandeau.
        </p>
      </div>
    </div>
  );
}
