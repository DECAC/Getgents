import type { Plafonds } from "@/lib/offre";
import type { UsageOffre } from "@/lib/server/offre";
import styles from "@/app/compte/compte.module.css";

const LIGNES: { cle: keyof Plafonds; libelle: string }[] = [
  { cle: "pages", libelle: "Pages" },
  { cle: "liensActifs", libelle: "Liens actifs" },
  { cle: "questionsParMois", libelle: "Questions à l'assistant, ce mois" },
];

/**
 * Offre « Getgents Pages » : où en est le compte de ses plafonds. Dit AVANT
 * d'être atteint, pas découvert au moment de l'erreur.
 */
export default function VotreAcces({ plafonds, usage }: { plafonds: Plafonds; usage: UsageOffre }) {
  return (
    <section className={styles.bloc} aria-labelledby="votre-acces">
      <h2 id="votre-acces" className={styles.sousTitre}>
        Votre accès
      </h2>
      <p className={styles.aide}>
        <span className={styles.offre}>Getgents Pages · sur invitation</span> Accès offert pendant la phase d&apos;essai.
      </p>
      <div className={styles.jauges}>
        {LIGNES.map(({ cle, libelle }) => {
          const n = usage[cle];
          const max = plafonds[cle];
          const part = Math.min(100, Math.round((n / max) * 100));
          return (
            <div key={cle} className={styles.jauge} data-plein={n >= max ? "oui" : undefined}>
              <span>{libelle}</span>
              <span className={styles.jaugeBarre} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={n} aria-label={libelle}>
                <i style={{ width: `${part}%` }} />
              </span>
              <span className={styles.jaugeNombre}>
                {n} / {max}
              </span>
            </div>
          );
        })}
      </div>
      <p className={styles.aide} style={{ marginBottom: 0, marginTop: 12 }}>
        Plafond atteint : vos pages restent en ligne, seule la création (ou l&apos;assistant) s&apos;arrête — l&apos;assistant reprend le 1er du mois.
      </p>
    </section>
  );
}
