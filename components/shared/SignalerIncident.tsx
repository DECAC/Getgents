"use client";

import { useState } from "react";
import {
  MOTIFS,
  MOTIF_EXIGEANT_PRECISION,
  PRECISION_MAX,
  type Appreciation,
  type MotifId,
} from "@/lib/signalement";
import styles from "./SignalerIncident.module.css";

/**
 * Bouton « Signaler un incident », pour l'utilisateur d'un gent partagé.
 *
 * Ces gens n'ont aucun moyen de joindre le créateur : ni compte, ni adresse,
 * ni bouton. Quand la réponse est à côté de la plaque ou que la conversation
 * refuse de fonctionner, ils partent, et le créateur ne l'apprend jamais —
 * il croit son gent en bon état parce que rien ne lui dit le contraire.
 *
 * Le formulaire tient en deux questions, et c'est délibéré : un questionnaire
 * long ne se remplit pas au moment où l'on est agacé, c'est-à-dire exactement
 * le moment où l'on aurait quelque chose à dire.
 *
 * N'apparaît QUE sur un lien de partage. Dans le studio, le créateur a le
 * gent sous les yeux : se signaler un incident à soi-même n'aurait pas de
 * sens.
 */
/**
 * Le jeton arrive en PROP, jamais d'un contexte.
 *
 * Première version : il était lu dans `useEspace()`. Deux défauts, découverts
 * en production sur un signalement qui n'arrivait jamais. D'abord le bouton
 * avait été monté dans `CenterHeader`, que la page de partage n'utilise pas —
 * il ne s'affichait donc nulle part. Ensuite `useEspace()` LÈVE hors de son
 * fournisseur : le monter dans le salon collaboratif, qui n'en a pas, aurait
 * fait planter la page entière pour un bouton secondaire.
 *
 * Une prop supprime les deux problèmes : la coquille qui affiche le bouton
 * connaît forcément son jeton, et rien ne dépend plus d'un contexte qui peut
 * être absent.
 */
export function SignalerIncident({ token }: { token: string }) {
  const jeton = token;
  const [ouvert, setOuvert] = useState(false);
  const [appreciation, setAppreciation] = useState<Appreciation | null>(null);
  const [motif, setMotif] = useState<MotifId | null>(null);
  const [precision, setPrecision] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);

  if (!jeton) return null;

  async function envoyer() {
    setOccupe(true);
    setErreur(null);
    try {
      const res = await fetch(`/api/links/${encodeURIComponent(jeton)}/signalement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appreciation, motif, precision }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErreur(data.error ?? "Votre signalement n'est pas parti. Réessayez.");
        return;
      }
      setEnvoye(true);
    } catch {
      setErreur("Le serveur n'a pas répondu. Réessayez.");
    } finally {
      setOccupe(false);
    }
  }

  function fermer() {
    setOuvert(false);
    // On remet le formulaire à zéro APRÈS la fermeture : garder les réponses
    // ferait rouvrir un formulaire déjà rempli, qu'on renverrait par mégarde.
    setEnvoye(false);
    setAppreciation(null);
    setMotif(null);
    setPrecision("");
    setErreur(null);
  }

  return (
    <>
      <button type="button" className={styles.declencheur} onClick={() => setOuvert(true)}>
        Signaler un incident
      </button>

      {ouvert && (
        <div className={styles.voile} role="dialog" aria-modal="true" aria-label="Signaler un incident">
          <div className={styles.carte}>
            {envoye ? (
              <>
                <h2 className={styles.titre}>Merci</h2>
                <p className={styles.texte}>
                  Votre signalement a été transmis à la personne qui gère ce gent. Elle ne peut
                  pas vous répondre — rien ne vous identifie — mais elle sait maintenant ce qui
                  s&apos;est passé.
                </p>
                <div className={styles.actions}>
                  <button type="button" className={styles.principal} onClick={fermer}>
                    Fermer
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className={styles.titre}>Signaler un incident</h2>

                <fieldset className={styles.groupe}>
                  <legend className={styles.question}>Appréciez-vous ce type de service ?</legend>
                  <div className={styles.choix}>
                    {(["oui", "non"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={`${styles.pastille} ${appreciation === v ? styles.pastilleOn : ""}`}
                        aria-pressed={appreciation === v}
                        onClick={() => setAppreciation(appreciation === v ? null : v)}
                      >
                        {v.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className={styles.groupe}>
                  <legend className={styles.question}>
                    Informer l&apos;administrateur d&apos;un problème rencontré ?
                  </legend>
                  <div className={styles.choixColonne}>
                    {MOTIFS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`${styles.pastille} ${motif === m.id ? styles.pastilleOn : ""}`}
                        aria-pressed={motif === m.id}
                        onClick={() => setMotif(motif === m.id ? null : m.id)}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                {/* Le champ apparaît pour tous, mais n'est EXIGÉ que pour une
                    anomalie : « il y a un bug » sans description est
                    inexploitable, alors qu'un résultat non pertinent se
                    comprend sans un mot. */}
                <label className={styles.question} htmlFor="signalement-precision">
                  Précisions
                  {motif === MOTIF_EXIGEANT_PRECISION ? " (nécessaires)" : " (facultatives)"}
                </label>
                <textarea
                  id="signalement-precision"
                  className={styles.zone}
                  value={precision}
                  maxLength={PRECISION_MAX}
                  onChange={(e) => setPrecision(e.target.value)}
                  placeholder="Ce que vous attendiez, ce que vous avez obtenu."
                />

                {erreur && <p className={styles.erreur}>{erreur}</p>}

                <p className={styles.mention}>
                  Rien ne vous identifie : ni compte, ni adresse, ni contenu de votre
                  conversation. Seules vos réponses ci-dessus sont transmises.
                </p>

                <div className={styles.actions}>
                  <button type="button" className={styles.secondaire} onClick={fermer}>
                    Annuler
                  </button>
                  <button
                    type="button"
                    className={styles.principal}
                    disabled={occupe}
                    onClick={envoyer}
                  >
                    {occupe ? "Envoi…" : "Envoyer"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
