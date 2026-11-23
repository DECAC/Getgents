"use client";

import { cleInvite } from "@/lib/groupesPages";
import { textes, type Langue } from "@/lib/langueLecteur";
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
  langue,
}: {
  invites: string[];
  repondus: string[];
  onChoisir: (prenom: string) => void;
  /** Absent à la première ouverture : il faut choisir. Présent quand on « change ». */
  onFermer?: () => void;
  langue: Langue;
}) {
  const t = textes(langue);
  const fait = new Set(repondus.map(cleInvite));
  return (
    <div className={styles.confVoile} data-flou="oui">
      <div className={styles.quiBoite} role="dialog" aria-modal="true" aria-labelledby="qui-titre">
        {onFermer && (
          <button type="button" className={styles.confFermer} aria-label={t.fermer} onClick={onFermer}>
            ✕
          </button>
        )}
        <h2 id="qui-titre" className={styles.engagementTitre}>
          {t.quiTitre}
        </h2>
        <p className={styles.quiTexte}>{t.quiTexte}</p>
        <div className={styles.quiPrenoms}>
          {invites.map((p) => {
            const deja = fait.has(cleInvite(p));
            return (
              <button key={p} type="button" className={styles.quiPrenom} data-fait={deja ? "oui" : "non"} disabled={deja} onClick={() => onChoisir(p)}>
                {p}
                {deja && <small>{t.dejaRepondu}</small>}
              </button>
            );
          })}
        </div>
        <p className={styles.quiPied}>
          {t.quiPied}
        </p>
      </div>
    </div>
  );
}
