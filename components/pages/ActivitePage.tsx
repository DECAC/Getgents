"use client";

import { useEffect, useState } from "react";
import { dureeLisible, ilYA, type Activite } from "@/lib/activitePage";
import { initiales } from "@/lib/pagesGetsite";
import styles from "./pages.module.css";

const jourLisible = (jour: string) => {
  const r = ilYA(jour);
  return r === "aujourd'hui" || r === "hier" ? r.toUpperCase() : new Date(jour + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" }).toUpperCase();
};

const quand = (iso: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return jourLisible(iso).toLowerCase();
  const d = new Date(iso);
  const jour = ilYA(iso).startsWith("il y a") || ilYA(iso) === "à l'instant" ? "Aujourd'hui" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
  return `${jour}, ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}`;
};

/**
 * Onglet « Activité » d'une page : à gauche les lectures, nominatives
 * seulement pour qui a accepté ; à droite les questions, sans nom ni lien.
 * Les deux colonnes ne partagent AUCUNE clé : on ne peut pas rattacher une
 * question à un lecteur.
 */
export function ActivitePage({ id }: { id: string }) {
  const [a, setA] = useState<Activite | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    (async () => {
      const r = await fetch(`/api/pages/${encodeURIComponent(id)}/activite`, { credentials: "include" });
      const j = await r.json().catch(() => ({}));
      if (!vivant) return;
      if (!r.ok) setErreur((j as { error?: string }).error || "L'activité n'a pas pu être chargée.");
      else setA(j as Activite);
    })();
    return () => {
      vivant = false;
    };
  }, [id]);

  if (erreur) return <p className={styles.erreur}>{erreur}</p>;
  if (!a) return <p className={styles.sous}>Chargement…</p>;

  return (
    <div className={styles.activite}>
      <div className={styles.tuiles}>
        <div className={styles.tuile}>
          <b>{a.ouvertures}</b>
          <span>
            ouverture{a.ouvertures > 1 ? "s" : ""} de la page{a.anonymes ? `, dont ${a.anonymes} anonyme${a.anonymes > 1 ? "s" : ""}` : ""}
          </span>
        </div>
        <div className={styles.tuile}>
          <b>
            {a.partages} / {a.destinataires}
          </b>
          <span>destinataires ont partagé leurs données</span>
        </div>
        <div className={styles.tuile}>
          <b>{a.totalQuestions}</b>
          <span>
            question{a.totalQuestions > 1 ? "s" : ""} posée{a.totalQuestions > 1 ? "s" : ""}
            {a.horsPage ? ` · ${a.horsPage} sans réponse dans la page` : ""}
          </span>
        </div>
        <div className={styles.tuile}>
          <b>{ilYA(a.derniere)}</b>
          <span>dernière ouverture</span>
        </div>
      </div>

      <div className={styles.activiteCols}>
        <section className={styles.bloc} aria-label="Lectures partagées">
          <h2 className={styles.blocTitre}>
            Lectures partagées <small>avec l&apos;accord du destinataire</small>
          </h2>
          {a.lecteurs.length === 0 && <p className={styles.aide}>Aucun destinataire actif.</p>}
          <ul className={styles.lecteurs}>
            {a.lecteurs.map((l) => (
              <li key={l.jeton} className={styles.lecteur}>
                <div className={styles.lecteurLigne}>
                  <span className={styles.avatar} aria-hidden="true">
                    {initiales(l.destinataire)}
                  </span>
                  <div className={styles.lecteurTexte}>
                    <b>{l.destinataire}</b>
                    <span>
                      {l.partage
                        ? [
                            `${l.ouvertures} ouverture${l.ouvertures > 1 ? "s" : ""}`,
                            dureeLisible(l.duree),
                            l.profondeur === null ? null : l.profondeur >= 95 ? "a lu jusqu'en bas" : `a lu ${l.profondeur} %`,
                            l.version ? `version ${l.version}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : "N'a pas partagé ses données"}
                    </span>
                  </div>
                  <span className={styles.lecteurEtat} data-partage={l.partage ? "oui" : "non"}>
                    {l.partage ? ilYA(l.derniere) : "—"}
                  </span>
                </div>
                {l.partage && (
                  <ol className={styles.frise}>
                    {l.visites.slice(0, 8).map((v, i) => (
                      <li key={i}>
                        <b>{quand(v.debut)}</b> · {dureeLisible(v.duree)}
                        {v.appareil ? ` · ${v.appareil === "telephone" ? "téléphone" : "ordinateur"}` : ""}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ul>
          <p className={styles.aide}>« N&apos;a pas partagé » ne dit pas si la page a été ouverte : un destinataire qui refuse ne laisse rien deviner.</p>
        </section>

        <section className={styles.bloc} aria-label="Questions posées sur la page">
          <h2 className={styles.blocTitre}>
            Questions posées sur la page <small>sans nom ni lien</small>
          </h2>
          {a.questions.length === 0 && <p className={styles.aide}>Aucune question pour l&apos;instant. Activez l&apos;assistant IA pour que vos destinataires puissent en poser.</p>}
          {a.questions.map((j) => (
            <div key={j.jour}>
              <div className={styles.jour}>{jourLisible(j.jour)}</div>
              {j.items.map((q, i) => (
                <div key={i} className={styles.question} data-hors-page={q.horsPage ? "oui" : "non"}>
                  <span>{q.question}</span>
                  <small>{q.horsPage === true ? "la page ne le dit pas" : q.horsPage === false ? "répondu" : "—"}</small>
                </div>
              ))}
            </div>
          ))}
          {a.horsPage > 0 && <p className={styles.aide}>« La page ne le dit pas » : l&apos;information manquait. C&apos;est ce qu&apos;il faudrait ajouter à la page.</p>}
        </section>
      </div>
    </div>
  );
}
