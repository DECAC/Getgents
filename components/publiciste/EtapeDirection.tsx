"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./StudioPubliciste.module.css";
import { apiFetchInit } from "@/lib/apiFetch";
import type { EtatProjet, FichePubliciste } from "@/lib/publiciste";
import {
  POLICES,
  adressePolices,
  coutEstime,
  type EtapeDirection,
  type PistePalette,
  type PisteTypo,
  type PisteVisuel,
  type Proposition,
  type Specimen,
} from "@/lib/publicisteDirection";

/**
 * Publiciste, lot 2 : les étapes « Direction visuelle », « Typographie » et
 * « Couleurs », conformes à la maquette (`mockups/recit/publiciste/index.html`) :
 * trois cartes, « Ma recommandation », « Choisir », et « Autre proposition ».
 * Les pistes viennent d'un appel au modèle ; les planches, d'un appel par
 * piste, lancés ensemble. Rien n'est généré sans un clic : l'estimation du
 * coût est affichée avant.
 */

const TEXTES: Record<EtapeDirection, { titre: string; sous: string; attente: string; autre: string }> = {
  visuel: {
    titre: "Direction visuelle",
    sous: "Trois planches d'ambiance. On juge un univers, pas une image finale.",
    attente: "Je relève votre univers et je prépare trois pistes…",
    autre: "Une autre idée d'univers ? (ex. : plus de photos, moins de dessin)",
  },
  typo: {
    titre: "Typographie",
    sous: "Les lettres de l'étiquette, de la page finale et de la phrase de fin.",
    attente: "Je choisis trois associations de lettres pour votre projet…",
    autre: "Une autre envie de lettres ? (ex. : plus manuscrit, plus moderne)",
  },
  couleurs: {
    titre: "Couleurs",
    sous: "La palette de l'histoire et de la page à son nom.",
    attente: "Je compose trois palettes à partir de votre marque…",
    autre: "Une autre envie de couleurs ? (ex. : plus chaud, moins de rouge)",
  },
};

const euros = (x: number) => x.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";

export function EtapeDirection({
  etape,
  numero,
  projetId,
  etat,
  modifier,
  fiche,
  allerEntretien,
}: {
  etape: EtapeDirection;
  numero: number;
  projetId: string | null;
  etat: EtatProjet;
  modifier: (f: (e: EtatProjet) => EtatProjet) => void;
  fiche: FichePubliciste;
  allerEntretien: () => void;
}) {
  const t = TEXTES[etape];
  const proposition = etat.direction?.[etape];
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [remarque, setRemarque] = useState("");
  // Planches en cours de génération, et leurs échecs (ce qui se passe dans CET onglet).
  const [planchesEnCours, setPlanchesEnCours] = useState<Record<string, boolean>>({});
  const [planchesEchec, setPlanchesEchec] = useState<Record<string, string>>({});

  const genererPlanche = async (p: PisteVisuel) => {
    if (!projetId) return;
    setPlanchesEnCours((s) => ({ ...s, [p.id]: true }));
    setPlanchesEchec((s) => ({ ...s, [p.id]: "" }));
    try {
      const r = await fetch(
        `/api/publiciste/projets/${projetId}/planche`,
        apiFetchInit({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ piste: p.id, prompt: p.prompt }) })
      );
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? `réf. ${r.status}`);
      // La planche rejoint SA piste, si la proposition n'a pas été remplacée entre-temps.
      modifier((e) => {
        const v = e.direction?.visuel;
        if (!v?.visuel?.some((x) => x.id === p.id && x.prompt === p.prompt)) return e;
        return {
          ...e,
          direction: { ...e.direction, visuel: { ...v, visuel: v.visuel.map((x) => (x.id === p.id ? { ...x, image: j.nom, cout: j.cout } : x)) } },
        };
      });
    } catch (e) {
      setPlanchesEchec((s) => ({ ...s, [p.id]: (e as Error).message }));
    } finally {
      setPlanchesEnCours((s) => ({ ...s, [p.id]: false }));
    }
  };

  const preparer = async (avecRemarque?: string) => {
    if (!projetId || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      const r = await fetch(
        `/api/publiciste/projets/${projetId}/pistes`,
        apiFetchInit({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ etape, remarque: avecRemarque || undefined }) })
      );
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? `Les pistes n'ont pas pu être préparées (réf. ${r.status}).`);
      const p: Proposition = j.proposition;
      modifier((e) => {
        const choix = { ...e.choix };
        delete choix[etape];
        return { ...e, choix, direction: { ...e.direction, [etape]: p }, depenseTexte: Math.round(((e.depenseTexte ?? 0) + (j.cout ?? 0)) * 10000) / 10000 };
      });
      setRemarque("");
      if (etape === "visuel") p.visuel?.forEach((x) => void genererPlanche(x));
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  };

  const choisir = (id: string) => modifier((e) => ({ ...e, choix: { ...e.choix, [etape]: e.choix[etape] === id ? undefined : id } }));

  return (
    <>
      <div className={styles.intro}>
        <span className={styles.mono}>Étape {numero} sur 7</span>
        <h2 className={styles.titre}>{t.titre}</h2>
        <p className={styles.sous}>{t.sous}</p>
      </div>

      {!proposition && (
        <div className={styles.bulle}>
          <span className={styles.avatar} aria-hidden="true">
            P
          </span>
          <div className={styles.bulleTxt}>
            <p>{enCours ? t.attente : "Je vous propose trois pistes, chacune avec ce qu'elle apporte et ce qu'elle risque, et ma recommandation."}</p>
            {!fiche.pret && !enCours && (
              <p>
                L&apos;entretien n&apos;est pas terminé : les pistes seront moins justes.{" "}
                <button type="button" className={styles.lien} onClick={allerEntretien}>
                  Reprendre l&apos;entretien
                </button>
              </p>
            )}
          </div>
        </div>
      )}
      {proposition && (
        <div className={styles.bulle}>
          <span className={styles.avatar} aria-hidden="true">
            P
          </span>
          <div className={styles.bulleTxt}>
            {proposition.bulle.map((b, i) => (
              <p key={i}>{b}</p>
            ))}
          </div>
        </div>
      )}

      {erreur && (
        <p className={styles.alerte} role="status">
          {erreur}
        </p>
      )}

      {!proposition &&
        (projetId ? (
          <div className={styles.lancer}>
            <button type="button" className={[styles.bouton, styles.corail].join(" ")} onClick={() => preparer()} disabled={enCours}>
              {enCours ? "Préparation…" : "Préparer les trois pistes"}
            </button>
            <span className={styles.note}>
              ≈ {euros(coutEstime(etape))}
              {etape === "visuel" ? " · environ une minute, planches comprises" : " · une trentaine de secondes"}
            </span>
          </div>
        ) : (
          <div className={styles.aVenir}>Dans l&apos;aperçu, rien n&apos;est généré : ouvrez le gent dans votre espace pour préparer les pistes.</div>
        ))}

      {proposition && (
        <div className={styles.choix}>
          {etape === "visuel" &&
            proposition.visuel?.map((p) => (
              <Carte key={p.id} reco={proposition.recommandee === p.id} choisie={etat.choix.visuel === p.id} nom={p.nom} choisir={() => choisir(p.id)}>
                <div className={styles.planche}>
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/publiciste/projets/${projetId}/fichiers/${p.image}`} alt={`Planche d'ambiance : ${p.nom}`} loading="lazy" />
                  ) : planchesEnCours[p.id] ? (
                    <span className={styles.plancheAttente}>Je dessine la planche…</span>
                  ) : (
                    <span className={styles.plancheAttente}>
                      {planchesEchec[p.id] ? `La planche n'a pas pu être faite (${planchesEchec[p.id]}).` : "Planche à faire."}{" "}
                      {projetId && (
                        <button type="button" className={styles.lien} onClick={() => genererPlanche(p)}>
                          {planchesEchec[p.id] ? "Réessayer" : "La dessiner"}
                        </button>
                      )}
                    </span>
                  )}
                </div>
                <h3>{p.nom}</h3>
                <p className={styles.desc}>{p.desc}</p>
                <div className={styles.pourContre}>
                  <span className={styles.p}>{p.pour}</span>
                  <span className={styles.c}>{p.contre}</span>
                </div>
              </Carte>
            ))}
          {etape === "typo" && proposition.typo && proposition.specimen && <Typos pistes={proposition.typo} specimen={proposition.specimen} reco={proposition.recommandee} choisi={etat.choix.typo} choisir={choisir} />}
          {etape === "couleurs" &&
            proposition.couleurs?.map((p) => (
              <Carte key={p.id} reco={proposition.recommandee === p.id} choisie={etat.choix.couleurs === p.id} nom={p.nom} choisir={() => choisir(p.id)}>
                <Palette p={p} titre={fiche.projet || "Votre histoire"} />
              </Carte>
            ))}
        </div>
      )}

      {proposition && projetId && (
        <div className={styles.autre}>
          <textarea id={`autre-${etape}`} rows={1} placeholder={t.autre} value={remarque} onChange={(e) => setRemarque(e.target.value)} />
          <button type="button" className={[styles.bouton, styles.leger].join(" ")} onClick={() => preparer(remarque)} disabled={enCours || !remarque.trim()}>
            {enCours ? "Préparation…" : "Autre proposition"}
          </button>
          <span className={styles.note}>≈ {euros(coutEstime(etape))}. La proposition actuelle sera remplacée.</span>
        </div>
      )}
    </>
  );
}

function Carte({ reco, choisie, nom, choisir, children }: { reco: boolean; choisie: boolean; nom: string; choisir: () => void; children: React.ReactNode }) {
  return (
    <div className={[styles.carte, choisie ? styles.carteChoisie : ""].join(" ")} role="group" aria-label={nom}>
      {reco && <span className={styles.badgeReco}>Ma recommandation</span>}
      {choisie && <span className={styles.badgeChoisi}>Votre choix</span>}
      {children}
      <button type="button" className={styles.action} aria-pressed={choisie} onClick={choisir}>
        {choisie ? "Choisie" : "Choisir"}
      </button>
    </div>
  );
}

function Typos({ pistes, specimen, reco, choisi, choisir }: { pistes: PisteTypo[]; specimen: Specimen; reco: string; choisi?: string; choisir: (id: string) => void }) {
  // Les polices des trois spécimens, chargées depuis Google Fonts (autorisé par la CSP).
  const lien = useRef<HTMLLinkElement | null>(null);
  useEffect(() => {
    const href = adressePolices(pistes.map((p) => p.id));
    if (!href) return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    document.head.appendChild(l);
    lien.current = l;
    return () => l.remove();
  }, [pistes]);
  return (
    <>
      {pistes.map((p) => {
        const police = POLICES.find((x) => x.id === p.id)!;
        const main = police.main ?? police.titre;
        return (
          <Carte key={p.id} reco={reco === p.id} choisie={choisi === p.id} nom={p.nom} choisir={() => choisir(p.id)}>
            <div className={styles.specimen} style={{ fontFamily: `"${police.texte}", sans-serif` }}>
              <span className={styles.etq} style={{ fontFamily: `"${main}", cursive` }}>
                {specimen.etiquette}
              </span>
              <p className={styles.specH} style={{ fontFamily: `"${police.titre}", serif`, fontWeight: police.poidsTitre }}>
                {specimen.titre}
              </p>
              <p className={styles.specB}>{specimen.corps}</p>
              <p className={styles.specDev} style={{ fontFamily: `"${main}", cursive` }}>
                {specimen.fin}
              </p>
              <span className={styles.specBtn}>{specimen.bouton}</span>
            </div>
            <h3>{p.nom}</h3>
            <p className={styles.mono} style={{ margin: "0 4px" }}>
              {police.detail}
            </p>
            {p.note && <p className={styles.desc}>{p.note}</p>}
          </Carte>
        );
      })}
    </>
  );
}

function Palette({ p, titre }: { p: PistePalette; titre: string }) {
  const couv = p.couleurs.find((c) => ![p.fond, p.encre, p.accent].includes(c.hex))?.hex ?? p.accent;
  return (
    <>
      <div className={styles.nuancier} aria-hidden="true">
        {p.couleurs.map((c) => (
          <span key={c.hex + c.nom} style={{ background: c.hex }} />
        ))}
      </div>
      <div className={styles.mini} style={{ background: p.fond, color: p.encre }}>
        <div className={styles.couv} style={{ background: couv }}>
          <i style={{ background: p.fond, color: p.encre }}>{titre}</i>
        </div>
        <div className={styles.filet} style={{ background: `linear-gradient(90deg, ${p.encre} 0 33%, ${p.fond} 33% 66%, ${p.accent} 66%)` }} />
        <span style={{ fontWeight: 800, fontSize: 17 }}>{titre}</span>
        <span className={styles.miniBtn} style={{ background: p.encre, color: p.fond }}>
          Découvrir
        </span>
      </div>
      <h3>{p.nom}</h3>
      <div className={styles.teintes}>
        {p.couleurs.map((c) => (
          <div key={c.hex + c.nom}>
            <span>{c.nom}</span>
            <code>{c.hex}</code>
          </div>
        ))}
      </div>
      {p.note && <p className={styles.desc}>{p.note}</p>}
    </>
  );
}
