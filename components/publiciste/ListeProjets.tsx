"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./StudioPubliciste.module.css";
import { useEspace } from "@/lib/context/EspaceContext";
import { apiFetchInit } from "@/lib/apiFetch";
import { ETAPES_PUBLICISTE, filDuProjet, nomAffiche, resumeProjet, NOM_MAX, type EtatProjet, type StatutProjet } from "@/lib/publiciste";

/**
 * « Vos projets » : l'accueil du gent Le Publiciste, CONFORME À LA MAQUETTE
 * validée par l'éditeur (`mockups/recit/publiciste/projets.html`). Une carte
 * par projet, du plus récent au plus ancien ; « Reprendre » rouvre le projet
 * à son étape ; ⋯ Renommer / Supprimer (avec confirmation) ; « ‹ » ramène à
 * « Mes gents ».
 */

interface Ligne {
  id: string;
  nom: string;
  etat: EtatProjet;
  modifieLe: string;
  cout: number;
}

const LIBELLE_STATUT: Record<StatutProjet, string> = {
  entretien: "Entretien en cours",
  direction: "Direction artistique",
  validee: "Direction validée",
};

const eur = (x: number) => x.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";

/** « Aujourd'hui, 14:12 », « Hier, 18:40 », sinon « 12 novembre ». */
function quand(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const jour = (x: Date) => x.toDateString();
  const hier = new Date(Date.now() - 86_400_000);
  if (jour(d) === jour(new Date())) return `Aujourd'hui, ${heure}`;
  if (jour(d) === jour(hier)) return `Hier, ${heure}`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

export function ListeProjets({ gentId, ouvrir }: { gentId: string; ouvrir: (id: string) => void }) {
  const { retirerFil } = useEspace();
  const [projets, setProjets] = useState<Ligne[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cree, setCree] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [renommage, setRenommage] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);

  const lire = useCallback(async () => {
    try {
      const r = await fetch(`/api/publiciste/projets?gent=${encodeURIComponent(gentId)}`, apiFetchInit());
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        setMessage(j?.message ?? `Vos projets n'ont pas pu être lus (réf. ${r.status}).`);
        setProjets([]);
        return;
      }
      setProjets(j.projets);
    } catch {
      setMessage("Vos projets n'ont pas pu être lus (réseau).");
      setProjets([]);
    }
  }, [gentId]);
  useEffect(() => {
    lire();
  }, [lire]);

  useEffect(() => {
    if (!menu) return;
    const fermer = () => setMenu(null);
    document.addEventListener("click", fermer);
    return () => document.removeEventListener("click", fermer);
  }, [menu]);

  const nouveau = async () => {
    if (cree) return;
    setCree(true);
    try {
      const r = await fetch("/api/publiciste/projets", apiFetchInit({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gent: gentId }) }));
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        setMessage(j?.message ?? `Le projet n'a pas pu être créé (réf. ${r.status}).`);
        return;
      }
      ouvrir(j.id);
    } catch {
      setMessage("Le projet n'a pas pu être créé (réseau).");
    } finally {
      setCree(false);
    }
  };

  const renommer = async (p: Ligne, nom: string) => {
    setRenommage(null);
    const r = await fetch(`/api/publiciste/projets/${p.id}`, apiFetchInit({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nom }) })).catch(() => null);
    if (!r?.ok) return setMessage("Le projet n'a pas pu être renommé. Réessayez.");
    setProjets((l) => l?.map((x) => (x.id === p.id ? { ...x, nom: nom.trim() } : x)) ?? l);
  };

  const supprimer = async (p: Ligne) => {
    setASupprimer(null);
    const r = await fetch(`/api/publiciste/projets/${p.id}`, apiFetchInit({ method: "DELETE" })).catch(() => null);
    if (!r?.ok && r?.status !== 404) return setMessage("Le projet n'a pas pu être supprimé. Réessayez.");
    retirerFil(filDuProjet(p.id));
    setProjets((l) => l?.filter((x) => x.id !== p.id) ?? l);
  };

  const n = projets?.length ?? 0;
  return (
    <div className={styles.studio}>
      <header className={styles.barre}>
        <div className={[styles.barreIn, styles.barreSeule].join(" ")}>
          <div className={styles.ident}>
            <a href="/myspace" className={styles.retour} title="Tous mes gents" aria-label="Retour à Mes gents">
              ‹
            </a>
            <span className={styles.avatar} aria-hidden="true">
              P
            </span>
            <span className={styles.identTexte}>
              <b>Le Publiciste</b>
              <small>{projets === null ? "…" : n ? `${n} projet${n > 1 ? "s" : ""}` : "Aucun projet"}</small>
            </span>
          </div>
        </div>
      </header>
      <main className={[styles.main, styles.mainListe].join(" ")}>
        <div className={styles.listeTete}>
          <div className={styles.intro}>
            <span className={styles.mono}>Vos projets</span>
            <h2 className={styles.titre}>Ce que nous racontons ensemble</h2>
            <p className={styles.sous}>Chaque projet suit les huit étapes : l&apos;entretien, la direction artistique, puis la validation. Reprenez là où vous vous étiez arrêté.</p>
          </div>
          {n > 0 && (
            <button type="button" className={[styles.bouton, styles.corail].join(" ")} onClick={nouveau} disabled={cree}>
              {cree ? "Création…" : "+ Nouveau projet"}
            </button>
          )}
        </div>
        {message && (
          <p className={styles.alerte} role="status">
            {message}
          </p>
        )}
        {projets !== null && n === 0 && (
          <div className={styles.videEtat}>
            <h2>Votre premier projet commence par un entretien</h2>
            <p>Une quinzaine de minutes pour parler de votre marque. Ensuite, je vous propose la direction artistique, étape par étape.</p>
            <ol>
              <li>L&apos;entretien : le fond, puis la forme.</li>
              <li>La direction artistique : univers, lettres, couleurs, musique, voix, storyboard.</li>
              <li>Vous validez, puis on produit.</li>
            </ol>
            <button type="button" className={[styles.bouton, styles.corail].join(" ")} onClick={nouveau} disabled={cree}>
              {cree ? "Création…" : "Commencer un projet"}
            </button>
          </div>
        )}
        <section className={styles.liste} aria-label="Projets">
          {projets?.map((p) => {
            const r = resumeProjet(p.etat);
            const nom = nomAffiche(p.nom, p.etat.fiche);
            return (
              <article key={p.id} className={styles.projet} aria-label={nom}>
                {renommage !== p.id && <button type="button" className={styles.lienCarte} onClick={() => ouvrir(p.id)} aria-label={`Ouvrir ${nom}`} />}
                <div className={[styles.vignette, styles.vignetteVide].join(" ")}>{r.statut === "entretien" ? "L'univers viendra après l'entretien" : "—"}</div>
                <div className={styles.corpsProjet}>
                  {renommage === p.id ? (
                    <Renommer initial={nom} valider={(v) => renommer(p, v)} annuler={() => setRenommage(null)} />
                  ) : (
                    <div className={styles.nomProjet}>
                      <h3>{nom}</h3>
                      <span className={styles.marque}>{p.etat.fiche.marque || "Marque à préciser"}</span>
                    </div>
                  )}
                  <span className={[styles.statut, styles[`statut_${r.statut}`]].join(" ")}>{LIBELLE_STATUT[r.statut]}</span>
                  <div className={styles.avancement}>
                    <span className={styles.points} aria-hidden="true">
                      {ETAPES_PUBLICISTE.map((e, i) => (
                        <i key={e.id} className={r.statut === "validee" || i < r.index ? styles.pointFait : i === r.index ? styles.pointCours : undefined} />
                      ))}
                    </span>
                    <span className={styles.etapeTxt}>{r.libelle}</span>
                  </div>
                  <div className={styles.metaProjet}>
                    <span>Modifié : {quand(p.modifieLe)}</span>
                    <span>Dépensé : {eur(p.cout)}</span>
                  </div>
                </div>
                <div className={styles.actionsProjet}>
                  <button type="button" className={[styles.bouton, styles.leger].join(" ")} onClick={() => ouvrir(p.id)}>
                    {r.statut === "validee" ? "Revoir" : "Reprendre"}
                  </button>
                  <button
                    type="button"
                    className={styles.plus}
                    aria-label={`Plus d'actions pour ${nom}`}
                    aria-expanded={menu === p.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenu(menu === p.id ? null : p.id);
                    }}
                  >
                    ⋯
                  </button>
                  {menu === p.id && (
                    <div className={styles.menu} role="menu">
                      <button type="button" role="menuitem" onClick={() => setRenommage(p.id)}>
                        Renommer
                      </button>
                      <button type="button" role="menuitem" className={styles.danger} onClick={() => setASupprimer(p.id)}>
                        Supprimer…
                      </button>
                    </div>
                  )}
                </div>
                {aSupprimer === p.id && (
                  <div className={styles.confirmer} role="alert">
                    <span>Supprimer « {nom} » ? Son entretien, ses planches, musiques, voix et croquis seront effacés. Rien ne pourra être récupéré.</span>
                    <button type="button" className={[styles.bouton, styles.leger].join(" ")} onClick={() => setASupprimer(null)}>
                      Annuler
                    </button>
                    <button type="button" className={[styles.bouton, styles.corail].join(" ")} onClick={() => supprimer(p)}>
                      Supprimer
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}

function Renommer({ initial, valider, annuler }: { initial: string; valider: (v: string) => void; annuler: () => void }) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <div className={styles.renommer}>
      <input
        ref={ref}
        id="renommer-projet"
        aria-label="Nom du projet"
        maxLength={NOM_MAX}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") valider(v);
          if (e.key === "Escape") annuler();
        }}
      />
      <button type="button" className={styles.bouton} onClick={() => valider(v)}>
        Renommer
      </button>
      <button type="button" className={[styles.bouton, styles.leger].join(" ")} onClick={annuler}>
        Annuler
      </button>
    </div>
  );
}
