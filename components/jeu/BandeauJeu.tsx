"use client";

/**
 * Tableau de bord d'une partie en cours, en bandeau pleine largeur.
 *
 * Il n'affiche RIEN qu'il calcule lui-même : toutes les valeurs viennent du
 * bloc `ETAT_JEU` produit par le moteur déterministe, et les seuils viennent
 * de `lib/elysee2027/types`. Une règle de jeu recopiée dans du JSX finirait
 * par contredire le moteur, et le joueur verrait deux vérités.
 */
import { useMemo } from "react";
import { useEspace } from "@/lib/context/EspaceContext";
import { DIFFICULTES, JAUGES, SEUILS, type EtatJeuPublic, type JaugeId } from "@/lib/elysee2027/types";
import {
  enTension,
  franchissements,
  menaceLaPlusProche,
  objectifVictoire,
  tonFin,
  zoneJauge,
} from "@/lib/jeuEtat";
import styles from "./BandeauJeu.module.css";

/** Seuil de défaite propre à une jauge, s'il existe (repère rouge). */
const SEUIL_DEFAITE: Partial<Record<JaugeId, number>> = {
  [SEUILS.revolution.jauge]: SEUILS.revolution.max,
  [SEUILS.guerreCivile.jauge]: SEUILS.guerreCivile.max,
  [SEUILS.tutelle.jauge]: SEUILS.tutelle.max,
};

const JAUGE_MAITRESSE: JaugeId = "bonheur";

/** Une image par issue : le joueur reconnaît sa fin avant de lire le titre. */
const ICONE_FIN: Record<NonNullable<EtatJeuPublic["fin"]>, string> = {
  revolution: "🔥",
  guerre_civile: "💥",
  tutelle: "🏦",
  victoire: "🏆",
  victoire_mandat: "🎖️",
  bilan_mitige: "🏛️",
};

function signeDelta(d: number): string {
  if (d > 0) return `+${d}`;
  if (d < 0) return `−${Math.abs(d)}`;
  return "=";
}

function classeDelta(d: number | undefined): string {
  if (d === undefined) return styles.stable;
  if (d > 0) return styles.hausse;
  if (d < 0) return styles.baisse;
  return styles.stable;
}

function Jauge({
  id,
  label,
  valeur,
  delta,
  maitresse,
}: {
  id: JaugeId;
  label: string;
  valeur: number;
  delta?: number;
  maitresse?: boolean;
}) {
  const zone = zoneJauge(valeur);
  const seuil = SEUIL_DEFAITE[id];
  const classes = [
    styles.jauge,
    maitresse ? styles.maitresse : "",
    zone === "alerte" ? styles.alerte : zone === "recompense" ? styles.recompense : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <div className={styles.label}>
        {label}
        {maitresse && <span className={styles.etiquette}>jauge maîtresse</span>}
      </div>
      <div className={styles.chiffres}>
        <span className={styles.valeur}>{valeur}</span>
        <span className={[styles.delta, classeDelta(delta)].join(" ")}>
          {delta === undefined ? "=" : signeDelta(delta)}
        </span>
      </div>
      <div
        className={styles.piste}
        role="meter"
        aria-label={label}
        aria-valuenow={valeur}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={styles.zoneBasse} />
        <div className={styles.zoneHaute} />
        <div className={styles.remplissage} style={{ width: `${valeur}%` }} />
        {seuil !== undefined && (
          <div className={styles.seuil} style={{ left: `${seuil}%` }} title={`Seuil de défaite : ${seuil}`} />
        )}
      </div>
    </div>
  );
}

export function BandeauJeu({ etat }: { etat: EtatJeuPublic }) {
  const tension = enTension(etat);
  const menace = menaceLaPlusProche(etat);
  const objectif = objectifVictoire(etat);
  const signaux = franchissements(etat);
  const maitresse = JAUGES.find((j) => j.id === JAUGE_MAITRESSE);
  const autres = JAUGES.filter((j) => j.id !== JAUGE_MAITRESSE);

  return (
    <section
      className={[styles.panneau, tension ? styles.tension : ""].filter(Boolean).join(" ")}
      aria-label="Tableau de bord de la partie"
    >
      <div className={styles.tete}>
        <span className={styles.titre}>🏛️ Conseil de défense</span>
        <span className={styles.frise}>
          <span className={styles.plots} aria-hidden="true">
            {Array.from({ length: etat.duree }, (_, i) => (
              <span
                key={i}
                className={[
                  styles.plot,
                  i + 1 < etat.tour ? styles.plotJoue : "",
                  i + 1 === etat.tour && !etat.fin ? styles.plotCourant : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            ))}
          </span>
          <span className={styles.tour}>
            Tour {etat.tour} / {etat.duree}
            {!etat.fin && ` · ${Math.max(0, etat.duree - etat.tour)} restants`}
          </span>
        </span>
        <span className={[styles.badge, tension ? styles.badgeAlerte : ""].filter(Boolean).join(" ")}>
          {tension ? "⚠ État de tension" : DIFFICULTES[etat.difficulte]?.label ?? etat.difficulte}
        </span>
      </div>

      <div className={styles.jauges}>
        {maitresse && (
          <Jauge
            id={maitresse.id}
            label="Bonheur des Français"
            valeur={etat.jauges[maitresse.id]}
            delta={etat.deltas?.[maitresse.id]}
            maitresse
          />
        )}
        {autres.map((j) => (
          <Jauge key={j.id} id={j.id} label={j.label} valeur={etat.jauges[j.id]} delta={etat.deltas?.[j.id]} />
        ))}
      </div>

      {signaux.length > 0 && (
        <div className={styles.signaux} aria-live="polite">
          {signaux.map((s) => (
            <span
              key={s.jauge}
              className={[
                styles.signal,
                s.sens === "alerte" ? styles.signalAlerte : styles.signalRecompense,
              ].join(" ")}
            >
              {s.sens === "alerte" ? `⚠ Alerte — ${s.label} ${s.valeur}` : `✦ ${s.label} ${s.valeur}`}
            </span>
          ))}
        </div>
      )}

      <div className={styles.bande}>
        <div className={[styles.case, menace.marge <= 15 ? styles.menaceChaude : ""].filter(Boolean).join(" ")}>
          <span className={styles.caseTitre}>Menace la plus proche</span>
          {menace.issue} — {menace.label} {menace.valeur}, seuil {menace.seuil} ·{" "}
          <strong>{menace.marge} points de marge</strong>
        </div>

        <div
          className={[
            styles.case,
            objectif.bonheurAtteint && objectif.confianceAtteinte ? styles.objectifProche : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className={styles.caseTitre}>Objectif du mandat</span>
          <span className={[styles.condition, objectif.bonheurAtteint ? styles.conditionTenue : ""].join(" ")}>
            <span className={styles.pastille} aria-hidden="true" />
            Bonheur ≥ {SEUILS.victoire.bonheur}
          </span>
          <span
            className={[styles.condition, objectif.confianceAtteinte ? styles.conditionTenue : ""].join(" ")}
          >
            <span className={styles.pastille} aria-hidden="true" />
            Confiance ≥ {SEUILS.victoire.confiance}
          </span>
          <span className={styles.serie}>
            Tenu {objectif.serie} tour{objectif.serie > 1 ? "s" : ""} sur {objectif.requis} consécutifs
          </span>
        </div>

        <div className={styles.case}>
          <span className={styles.caseTitre}>Trois derniers tours</span>
          {etat.derniers.length === 0 ? (
            <span className={styles.vide}>Votre mandat commence.</span>
          ) : (
            <div className={styles.tours}>
              {etat.derniers.map((t) => (
                <span key={t.tour} className={styles.tourJoue}>
                  <span className={styles.tourJoueTitre}>
                    Tour {t.tour} · {t.titre}
                  </span>
                  <span className={styles.tourJoueDetail}>
                    {JAUGES.filter((j) => t.deltas[j.id] !== 0)
                      .map((j) => `${j.label} ${signeDelta(t.deltas[j.id])}`)
                      .join(" · ") || "Aucun effet"}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {etat.fin && (
        <div
          className={[
            styles.fin,
            tonFin(etat.fin) === "gagnee"
              ? styles.finGagnee
              : tonFin(etat.fin) === "perdue"
                ? styles.finPerdue
                : styles.finNeutre,
          ].join(" ")}
          role="status"
        >
          <span aria-hidden="true" className={styles.finIcone}>
            {ICONE_FIN[etat.fin]}
          </span>
          <span>
            <span className={styles.finTitre}>{etat.finTitre ?? "Fin de partie"}</span>
            <span className={styles.finDetail}>
              {" "}
              — mandat terminé au tour {etat.tour} sur {etat.duree}. Le bilan est dans la conversation.
            </span>
          </span>
        </div>
      )}
    </section>
  );
}

/**
 * État de la partie affichée : le plus récent porté par un message du fil
 * actif. Il vit sur les messages (et non sur l'espace) pour suivre la
 * conversation, jusque dans son enregistrement — là où le fil est conservé,
 * le bandeau revient au rechargement sans rejouer la partie.
 */
export function useEtatJeuActif(): EtatJeuPublic | null {
  const { currentEspace } = useEspace();
  const conversations = currentEspace.conversations;
  const actif = currentEspace.activeConversationId;
  return useMemo(() => {
    const fil = conversations.find((c) => c.id === actif) ?? conversations[0];
    if (!fil) return null;
    for (let i = fil.messages.length - 1; i >= 0; i--) {
      const etat = fil.messages[i].jeuEtat;
      if (etat) return etat;
    }
    return null;
  }, [conversations, actif]);
}

/** Monte le bandeau seulement si une partie est en cours dans le fil actif. */
export function BandeauJeuActif() {
  const etat = useEtatJeuActif();
  if (!etat) return null;
  return <BandeauJeu etat={etat} />;
}
