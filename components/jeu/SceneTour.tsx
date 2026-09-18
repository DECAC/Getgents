"use client";

/**
 * La surface d'un tour d'« Élysée 2027 » — la maquette « salon vert ».
 *
 * Elle REMPLACE la bulle de conversation quand le message porte un tour de
 * jeu. C'est le point essentiel : rendue en bulle, la mise en scène retombait
 * dans la typographie du produit, et il ne restait qu'un texte avec des
 * boutons. Une décision présidentielle doit avoir sa propre page.
 *
 * Elle ne calcule RIEN. Tout — décor, situation, question, libellés,
 * conséquence, une du lendemain — vient du bloc `ETAT_JEU` produit par le
 * moteur déterministe. Une règle recopiée ici finirait par contredire le
 * moteur, et le joueur verrait deux vérités.
 */
import type { EtatJeuPublic } from "@/lib/elysee2027/types";
import styles from "./SceneTour.module.css";

/**
 * Le format d'une réponse, IDENTIQUE à celui des réponses rapides
 * (`QuickReplyQuestions`) : « question → libellé ». Le moteur apparie sur le
 * texte qui suit la flèche ; deux formats concurrents finiraient par diverger.
 */
function ligneReponse(question: string, libelle: string): string {
  return `${question} → ${libelle}`;
}

export function SceneTour({
  etat,
  onRepondre,
  actif,
}: {
  etat: EtatJeuPublic;
  onRepondre: (texte: string) => void;
  /** Faux sur un tour déjà passé : on le relit, on n'y rejoue pas. */
  actif: boolean;
}) {
  const { decision, consequence } = etat;
  if (!decision && !consequence) return null;

  return (
    <section className={styles.scene} aria-label="Tour de jeu">
      <div className={styles.tour}>
        Tour {etat.tour} / {etat.duree}
      </div>

      {decision && (
        <>
          <h3 className={styles.titre}>
            {decision.theme} — {decision.titre}
          </h3>

          {(decision.lieu || decision.urgence) && (
            <div className={styles.didascalie}>
              {decision.lieu && <span>{decision.lieu}</span>}
              {/* La minuterie EST la pression : c'est la seule chose qui porte
                  le rouge, et c'est ce qui l'empêche d'être un décor. */}
              {decision.urgence && <span className={styles.minuterie}>{decision.urgence}</span>}
            </div>
          )}

          {decision.scenette && <p className={styles.scenette}>{decision.scenette}</p>}

          <p className={styles.situation}>{decision.situation}</p>
          <p className={styles.question}>{decision.question}</p>

          <div className={styles.options}>
            {decision.options.map((libelle) => (
              <button
                key={libelle}
                type="button"
                className={styles.option}
                disabled={!actif}
                onClick={() => onRepondre(ligneReponse(decision.question, libelle))}
              >
                {libelle}
              </button>
            ))}
          </div>
        </>
      )}

      {consequence && (
        <>
          <p className={styles.choisi}>Vous avez tranché — {consequence.choisi}</p>
          <p className={styles.consequence}>{consequence.texte}</p>

          {(consequence.une || consequence.reaction) && (
            <figure className={styles.une}>
              <div className={styles.manchette}>
                <span>Le lendemain</span>
                <span>Quotidien de fiction</span>
              </div>
              {consequence.une && <blockquote className={styles.titraille}>{consequence.une}</blockquote>}
              {consequence.reaction && (
                <figcaption className={styles.reaction}>{consequence.reaction}</figcaption>
              )}
            </figure>
          )}

          <div className={styles.options}>
            <button
              type="button"
              className={styles.option}
              disabled={!actif}
              onClick={() => onRepondre(ligneReponse(consequence.question, consequence.action))}
            >
              {consequence.action}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
