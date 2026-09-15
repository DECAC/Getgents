"use client";

import { useEffect, useState } from "react";
import styles from "@/app/compte/compte.module.css";

/**
 * Ce qui a été consommé dans l'heure en cours.
 *
 * Un plafond invisible qui refuse en 429 est vécu comme une panne : la
 * personne ne sait ni ce qu'elle a consommé, ni quand elle pourra reprendre.
 * On le montre — et on dit que la clé personnelle le fait disparaître.
 */

interface Compteur {
  utilise: number;
  plafond: number;
}
interface Etat {
  plafonne: boolean;
  compteurs: Record<string, Compteur>;
}

const LIBELLES: Record<string, string> = {
  llm: "Requêtes",
  image: "Générations d'image",
  video: "Analyses vidéo",
};

export default function Consommation() {
  const [etat, setEtat] = useState<Etat | null>(null);

  useEffect(() => {
    let vivant = true;
    fetch("/api/compte/consommation")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (vivant && d) setEtat(d);
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, []);

  return (
    <section className={styles.bloc}>
      <h2 className={styles.sousTitre}>Consommation de l'heure en cours</h2>

      {!etat && <p className={styles.aide}>Chargement…</p>}

      {etat && !etat.plafonne && (
        <p className={styles.aide}>
          Vos appels passent par votre clé OpenRouter : aucun plafond de notre côté, et rien
          n'est décompté ici. Votre consommation réelle est visible sur openrouter.ai.
        </p>
      )}

      {etat && etat.plafonne && (
        <>
          <div className={styles.jauges}>
            {Object.entries(etat.compteurs).map(([kind, c]) => {
              const part = c.plafond > 0 ? Math.min(100, (c.utilise / c.plafond) * 100) : 0;
              return (
                <div key={kind} className={styles.jauge}>
                  <div className={styles.jaugeEntete}>
                    <span>{LIBELLES[kind] ?? kind}</span>
                    <span className={styles.jaugeChiffre}>
                      {c.utilise} / {c.plafond}
                    </span>
                  </div>
                  <div className={styles.jaugePiste}>
                    <div className={styles.jaugeRemplie} style={{ width: `${part}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className={styles.aide} style={{ marginTop: 14, marginBottom: 0 }}>
            Ces plafonds bornent la dépense de la clé commune. Ils se remettent à zéro au
            début de chaque heure, et ne s'appliquent plus si vous branchez votre clé.
          </p>
        </>
      )}
    </section>
  );
}
