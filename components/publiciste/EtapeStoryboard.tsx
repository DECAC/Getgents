"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./StudioPubliciste.module.css";
import { apiFetchInit } from "@/lib/apiFetch";
import type { EtatProjet, FichePubliciste } from "@/lib/publiciste";
import { MA_VOIX, VOIX_GEMINI, type IdVoix } from "@/lib/publicisteDirection";
import {
  aRedessiner,
  coutStoryboardEstime,
  demandeRevision,
  differences,
  dureeTotale,
  fusionnerRevision,
  sceneModifiee,
  COUT_CROQUIS_ESTIME,
  type Scene,
  type Storyboard,
  type TexteScene,
} from "@/lib/publicisteStoryboard";
import { Animatique, Visionneuse } from "./Animatique";
import { lignesManquantes, preparerLignes, urlFichier } from "./lignesVoix";

/**
 * Publiciste, lot 4 : l'étape « Storyboard », conforme à la maquette — une
 * carte par scène (croquis en grand, voix, « On voit », sons, passage),
 * corrections directes gardées scène par scène, « Vos remarques sur
 * l'ensemble » envoyées au Publiciste, l'animatique et la visionneuse.
 * La révision proposée montre ses différences AVANT de remplacer quoi que ce
 * soit (la promesse de la maquette) ; seules les scènes dont « On voit » a
 * changé sont redessinées.
 */

const VOIX_DEFAUT: IdVoix = "charon";
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const euros = (x: number) => x.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
export const nomVoix = (id: string) => (id === MA_VOIX ? "Ma voix" : (VOIX_GEMINI.find((v) => v.id === id)?.nom ?? id));

function Zone({ id, valeur, changer, className, rows = 1, placeholder }: { id: string; valeur: string; changer: (v: string) => void; className?: string; rows?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + 2 + "px";
  }, [valeur]);
  return <textarea ref={ref} id={id} rows={rows} className={className} value={valeur} placeholder={placeholder} onChange={(e) => changer(e.target.value)} />;
}

export function EtapeStoryboard({
  numero,
  projetId,
  etat,
  modifier,
  fiche,
  allerEntretien,
}: {
  numero: number;
  projetId: string | null;
  etat: EtatProjet;
  modifier: (f: (e: EtatProjet) => EtatProjet) => void;
  fiche: FichePubliciste;
  allerEntretien: () => void;
}) {
  const sb = etat.storyboard;
  const [enCours, setEnCours] = useState<"ecrire" | "reviser" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [dessin, setDessin] = useState<Record<string, boolean>>({});
  const [echecs, setEchecs] = useState<Record<string, string>>({});
  const [vue, setVue] = useState<number | null>(null);
  const [anim, setAnim] = useState<{ voix: (string | null)[]; info: string } | null>(null);
  const [prepa, setPrepa] = useState<string | null>(null);

  const univers = (() => {
    const v = etat.direction?.visuel?.visuel?.find((p) => p.id === etat.choix.visuel);
    return v ? `${v.nom} — ${v.desc}` : "";
  })();
  const mettre = (f: (s: Storyboard) => Storyboard) => modifier((e) => (e.storyboard ? { ...e, storyboard: f(e.storyboard) } : e));
  const ajouterCout = (c: number) => (e: EtatProjet) => ({ ...e, depenseTexte: Math.round(((e.depenseTexte ?? 0) + (c ?? 0)) * 10000) / 10000 });

  /** Dessine les croquis demandés, trois à la fois. */
  const dessiner = async (scenes: Scene[]) => {
    if (!projetId) return;
    const file = [...scenes];
    const travailleur = async () => {
      for (let s = file.shift(); s; s = file.shift()) {
        const sc = s;
        setDessin((d) => ({ ...d, [sc.id]: true }));
        setEchecs((d) => ({ ...d, [sc.id]: "" }));
        try {
          const r = await fetch(
            `/api/publiciste/projets/${projetId}/croquis`,
            apiFetchInit({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scene: sc.id, voit: sc.voit, univers }) })
          );
          const j = await r.json().catch(() => null);
          if (!r.ok) throw new Error(j?.message ?? `réf. ${r.status}`);
          mettre((b) => ({
            ...b,
            scenes: b.scenes.map((x) => (x.id === sc.id ? { ...x, croquis: j.nom, dessine: sc.voit, coutCroquis: Math.round(((x.coutCroquis ?? 0) + (j.cout ?? 0)) * 10000) / 10000 } : x)),
          }));
        } catch (e) {
          setEchecs((d) => ({ ...d, [sc.id]: (e as Error).message }));
        } finally {
          setDessin((d) => ({ ...d, [sc.id]: false }));
        }
      }
    };
    await Promise.all([travailleur(), travailleur(), travailleur()]);
  };

  const appeler = async (corps: object) => {
    const r = await fetch(`/api/publiciste/projets/${projetId}/storyboard`, apiFetchInit({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) }));
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(j?.message ?? `Le storyboard n'a pas pu être écrit (réf. ${r.status}).`);
    return j as { bulle: string[]; scenes: Scene[]; cout: number };
  };

  const ecrire = async () => {
    if (!projetId || enCours) return;
    setEnCours("ecrire");
    setErreur(null);
    try {
      const j = await appeler({ mode: "ecrire" });
      modifier((e) => ajouterCout(j.cout)({ ...e, storyboard: { bulle: j.bulle, scenes: j.scenes, commentaire: "" } }));
      void dessiner(j.scenes);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(null);
    }
  };

  const envoyer = async () => {
    if (!projetId || !sb || enCours) return;
    if (!sb.commentaire.trim() && !sb.scenes.some(sceneModifiee)) return document.getElementById("sb-global")?.focus();
    setEnCours("reviser");
    setErreur(null);
    try {
      const j = await appeler({ mode: "reviser", scenes: sb.scenes, commentaire: sb.commentaire });
      const demande = demandeRevision(sb.scenes, sb.commentaire);
      modifier((e) =>
        e.storyboard ? ajouterCout(j.cout)({ ...e, storyboard: { ...e.storyboard, revision: { bulle: j.bulle, scenes: fusionnerRevision(e.storyboard.scenes, j.scenes), demande } } }) : e
      );
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(null);
    }
  };

  const remplacer = () => {
    if (!sb?.revision) return;
    const nouvelles = sb.revision.scenes;
    mettre((b) => (b.revision ? { bulle: b.revision.bulle, scenes: b.revision.scenes, commentaire: "", precedent: { bulle: b.bulle, scenes: b.scenes } } : b));
    void dessiner(nouvelles.filter(aRedessiner));
  };

  const changer = (i: number, k: keyof TexteScene, v: string) => mettre((b) => ({ ...b, scenes: b.scenes.map((s, j) => (j === i ? { ...s, [k]: v } : s)) }));
  const revenir = (i: number) => mettre((b) => ({ ...b, scenes: b.scenes.map((s, j) => (j === i ? { ...s, ...s.origine } : s)) }));

  const voixAnim = (etat.choix.voix as IdVoix | undefined) ?? VOIX_DEFAUT;
  const musique = (() => {
    const m = etat.direction?.musique;
    const p = m?.musique?.find((x) => x.id === etat.choix.musique) ?? m?.musique?.find((x) => x.id === m.recommandee);
    return p?.audio ? { nom: p.nom, url: projetId ? urlFichier(projetId, p.audio) : null, choisie: !!etat.choix.musique } : null;
  })();

  const lancerAnimatique = async () => {
    if (!sb || !projetId || prepa) return;
    const manquantes = lignesManquantes(etat, voixAnim, sb.scenes);
    if (manquantes.length) {
      setPrepa(`Je fais dire les répliques à ${nomVoix(voixAnim)} : 0 sur ${manquantes.length}…`);
      const r = await preparerLignes(projetId, voixAnim, manquantes, modifier, (k) => setPrepa(`Je fais dire les répliques à ${nomVoix(voixAnim)} : ${k} sur ${manquantes.length}…`));
      setPrepa(null);
      if (r.echecs) setErreur(`${r.echecs} réplique${r.echecs > 1 ? "s n'ont" : " n'a"} pas pu être dite${r.echecs > 1 ? "s" : ""} (${r.message}). L'animatique les passe sous silence.`);
      // Les fichiers viennent d'être rangés : l'état sera relu au rendu suivant.
      setAnim({ voix: [], info: "" });
      return;
    }
    ouvrirAnim();
  };
  const ouvrirAnim = () => {
    if (!sb || !projetId) return;
    const l = etat.voix?.lignes?.[voixAnim] ?? {};
    setAnim({
      voix: sb.scenes.map((s) => (s.vo && l[s.id]?.texte === s.vo ? urlFichier(projetId, l[s.id].fichier) : null)),
      info: `${nomVoix(voixAnim)}${musique ? ` · ${musique.nom}` : ""}`,
    });
  };
  // Après la préparation des répliques, l'état porte les fichiers : l'animatique s'ouvre avec eux.
  const attente = !!anim && !anim.info;
  useEffect(() => {
    if (attente) ouvrirAnim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attente]);

  const intro = (
    <div className={styles.intro}>
      <span className={styles.mono}>Étape {numero} sur 7</span>
      <h2 className={styles.titre}>Storyboard</h2>
      <p className={styles.sous}>
        {sb ? `${sb.scenes.length} scènes, ${dureeTotale(sb.scenes)} secondes. ` : ""}Les croquis sont volontairement grossiers : on juge le récit, pas le dessin.
      </p>
    </div>
  );

  if (!sb) {
    return (
      <>
        {intro}
        <div className={styles.bulle}>
          <span className={styles.avatar} aria-hidden="true">
            P
          </span>
          <div className={styles.bulleTxt}>
            <p>{enCours ? "J'écris l'histoire scène par scène…" : "Je raconte l'histoire scène par scène, avec un croquis pour chacune. Vous corrigez directement, et je redessine seulement ce qui change."}</p>
            {!fiche.pret && !enCours && (
              <p>
                Le brief n&apos;est pas terminé : le récit sera moins juste.{" "}
                <button type="button" className={styles.lien} onClick={allerEntretien}>
                  Reprendre le brief
                </button>
              </p>
            )}
          </div>
        </div>
        {erreur && (
          <p className={styles.alerte} role="status">
            {erreur}
          </p>
        )}
        {projetId ? (
          <div className={styles.lancer}>
            <button type="button" className={[styles.bouton, styles.corail].join(" ")} onClick={ecrire} disabled={!!enCours}>
              {enCours ? "Écriture…" : "Écrire le storyboard"}
            </button>
            <span className={styles.note}>≈ {euros(coutStoryboardEstime())} · environ une minute, croquis compris</span>
          </div>
        ) : (
          <div className={styles.aVenir}>Dans l&apos;aperçu, rien n&apos;est généré : ouvrez le gent dans votre espace pour écrire le storyboard.</div>
        )}
      </>
    );
  }

  const total = dureeTotale(sb.scenes);
  const voEditee = sb.scenes.some((s) => s.vo && etat.voix?.lignes?.[voixAnim]?.[s.id] && etat.voix.lignes[voixAnim]![s.id].texte !== s.vo);
  const nbModifiees = sb.scenes.filter(sceneModifiee).length;
  const sansCroquis = sb.scenes.filter((s) => !s.croquis && !dessin[s.id]);
  const diff = sb.revision ? differences(sb.scenes, sb.revision.scenes) : null;

  return (
    <>
      {intro}
      <div className={styles.bulle}>
        <span className={styles.avatar} aria-hidden="true">
          P
        </span>
        <div className={styles.bulleTxt}>
          {sb.bulle.map((b, i) => (
            <p key={i}>{b}</p>
          ))}
          <p>
            Corrigez directement le texte ou la description d&apos;une scène : vos changements sont gardés, scène par scène. Pour <strong>ajouter, supprimer ou déplacer</strong> une
            scène, dites-le en bas, dans vos remarques sur l&apos;ensemble.
          </p>
        </div>
      </div>

      {erreur && (
        <p className={styles.alerte} role="status">
          {erreur}
        </p>
      )}

      <div className={styles.sbTete}>
        <button type="button" className={[styles.bouton, styles.corail].join(" ")} onClick={lancerAnimatique} disabled={!projetId || !!prepa}>
          ▶ Lire l&apos;animatique ({total} s)
        </button>
        <span className={styles.note}>
          {prepa ??
            `Avec ${nomVoix(voixAnim)}${etat.choix.voix ? "" : ", en attendant votre choix de voix,"}${musique ? ` et « ${musique.nom} »${musique.choisie ? "" : " (ma recommandation)"}` : ", sans musique (aucun extrait composé)"}.` +
              (voEditee ? " Les répliques corrigées seront redites avant la lecture." : "")}
        </span>
        {sansCroquis.length > 0 && projetId && (
          <button type="button" className={[styles.bouton, styles.leger].join(" ")} onClick={() => dessiner(sansCroquis)}>
            Dessiner {sansCroquis.length === 1 ? "le croquis manquant" : `les ${sansCroquis.length} croquis manquants`} (≈ {euros(sansCroquis.length * COUT_CROQUIS_ESTIME)})
          </button>
        )}
      </div>

      {sb.revision && diff && (
        <section className={styles.revision} aria-labelledby="titre-revision">
          <h3 id="titre-revision">Storyboard révisé : voici ce qui change</h3>
          {sb.revision.bulle.map((b, i) => (
            <p key={i} style={{ margin: 0 }}>
              {b}
            </p>
          ))}
          <ul>
            {diff.ajoutees.length > 0 && <li>Ajoutée{diff.ajoutees.length > 1 ? "s" : ""} : {diff.ajoutees.map((t) => `« ${t} »`).join(", ")}</li>}
            {diff.supprimees.length > 0 && <li>Supprimée{diff.supprimees.length > 1 ? "s" : ""} : {diff.supprimees.map((t) => `« ${t} »`).join(", ")}</li>}
            {diff.modifiees.length > 0 && <li>Retouchée{diff.modifiees.length > 1 ? "s" : ""} : {diff.modifiees.map((t) => `« ${t} »`).join(", ")}</li>}
            {diff.deplacees && <li>L&apos;ordre des scènes change.</li>}
            {!diff.ajoutees.length && !diff.supprimees.length && !diff.modifiees.length && !diff.deplacees && <li>Aucun changement de scène.</li>}
          </ul>
          <p className={styles.note} style={{ margin: 0 }}>
            {sb.revision.scenes.length} scènes, {dureeTotale(sb.revision.scenes)} secondes.{" "}
            {diff.aDessiner ? `${diff.aDessiner} croquis à redessiner (≈ ${euros(diff.aDessiner * COUT_CROQUIS_ESTIME)}).` : "Aucun croquis à redessiner."}
          </p>
          <div className={styles.mvActions}>
            <button type="button" className={[styles.bouton, styles.corail].join(" ")} onClick={remplacer}>
              Remplacer le storyboard
            </button>
            <button type="button" className={[styles.bouton, styles.leger].join(" ")} onClick={() => mettre((b) => ({ ...b, revision: undefined }))}>
              Garder l&apos;actuel
            </button>
          </div>
        </section>
      )}
      {!sb.revision && sb.precedent && (
        <p className={styles.note} style={{ margin: 0 }}>
          Storyboard révisé.{" "}
          <button type="button" className={styles.lien} onClick={() => mettre((b) => (b.precedent ? { ...b, bulle: b.precedent.bulle, scenes: b.precedent.scenes, precedent: undefined } : b))}>
            Revenir au précédent
          </button>
        </p>
      )}

      <section className={styles.sequences} aria-label="Scènes">
        {(() => {
          let t = 0;
          return sb.scenes.map((s, i) => {
            const debut = t;
            t += s.duree;
            const mod = sceneModifiee(s);
            return (
              <article key={s.id} className={[styles.seq, mod ? styles.seqModifiee : ""].join(" ")} aria-label={`Scène ${i + 1}`}>
                <div className={styles.seqImage}>
                  {s.croquis && projetId ? (
                    <>
                      <button type="button" aria-label={`Agrandir le croquis de la scène ${i + 1}`} onClick={() => setVue(i)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={urlFichier(projetId, s.croquis)} alt={`Croquis de la scène ${i + 1} : ${s.titre}`} loading={i < 2 ? "eager" : "lazy"} width={432} height={768} />
                      </button>
                      <span className={styles.agrandir} aria-hidden="true">
                        Agrandir
                      </span>
                    </>
                  ) : (
                    <span className={styles.croquisAttente}>
                      {dessin[s.id] ? "Je dessine…" : echecs[s.id] ? `Le croquis n'a pas pu être fait (${echecs[s.id]}).` : "Croquis à faire."}{" "}
                      {projetId && !dessin[s.id] && (
                        <button type="button" className={styles.lien} onClick={() => dessiner([s])}>
                          {echecs[s.id] ? "Réessayer" : "Le dessiner"}
                        </button>
                      )}
                    </span>
                  )}
                  {s.croquis && s.dessine !== s.voit && !dessin[s.id] && projetId && (
                    <button type="button" className={styles.redessiner} onClick={() => dessiner([s])}>
                      Redessiner d&apos;après le texte
                    </button>
                  )}
                </div>
                <div className={styles.seqCorps}>
                  <div className={styles.seqTitre}>
                    <span className={styles.num}>{String(i + 1).padStart(2, "0")}</span>
                    <h3>{s.titre}</h3>
                    <span className={styles.temps}>
                      {fmt(debut)}–{fmt(t)} · {Math.round(s.duree)} s
                    </span>
                  </div>
                  <label className={[styles.champ, styles.champVo].join(" ")} htmlFor={`sb-${i}-vo`}>
                    <span className={styles.lab}>Voix</span>
                    <Zone id={`sb-${i}-vo`} className={styles.vo} valeur={s.vo} changer={(v) => changer(i, "vo", v)} placeholder="Pas de voix sur cette scène. Écrivez ici pour en ajouter une." />
                  </label>
                  <label className={styles.champ} htmlFor={`sb-${i}-voit`}>
                    <span className={styles.lab}>On voit</span>
                    <Zone id={`sb-${i}-voit`} rows={2} valeur={s.voit} changer={(v) => changer(i, "voit", v)} />
                  </label>
                  <div className={styles.seq2col}>
                    <label className={styles.champ} htmlFor={`sb-${i}-entend`}>
                      <span className={styles.lab}>Sons et musique</span>
                      <Zone id={`sb-${i}-entend`} className={styles.court} valeur={s.entend} changer={(v) => changer(i, "entend", v)} placeholder="—" />
                    </label>
                    <label className={styles.champ} htmlFor={`sb-${i}-trans`}>
                      <span className={styles.lab}>Passage à la suivante</span>
                      <Zone id={`sb-${i}-trans`} className={styles.court} valeur={s.trans} changer={(v) => changer(i, "trans", v)} />
                    </label>
                  </div>
                  {mod && (
                    <div className={styles.seqEtat}>
                      Modifiée
                      <button type="button" onClick={() => revenir(i)}>
                        Revenir au texte d&apos;origine
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          });
        })()}
      </section>

      <section className={styles.global} aria-labelledby="titre-global">
        <h3 id="titre-global">Vos remarques sur l&apos;ensemble</h3>
        <p className={styles.note} style={{ margin: 0 }}>
          Ajouter, supprimer, déplacer une scène, changer le rythme ou la fin.
        </p>
        <div className={styles.puces}>
          {["Ajouter une scène après la … : ", "Supprimer la scène … ", "Échanger les scènes … et … ", "Le rythme : …"].map((p) => (
            <button
              key={p}
              type="button"
              className={styles.miniB}
              onClick={() => {
                mettre((b) => ({ ...b, commentaire: (b.commentaire ? b.commentaire.replace(/\s*$/, "\n") : "") + p }));
                requestAnimationFrame(() => {
                  const ta = document.getElementById("sb-global") as HTMLTextAreaElement | null;
                  ta?.focus();
                  ta?.setSelectionRange(ta.value.length, ta.value.length);
                });
              }}
            >
              {p.replace(/ …$/, "").replace(/ : $/, "")}
            </button>
          ))}
        </div>
        <textarea
          id="sb-global"
          placeholder="Par exemple : ajoutez une scène où l'on voit l'atelier au petit matin ; supprimez la troisième ; la fin est trop rapide…"
          value={sb.commentaire}
          onChange={(e) => mettre((b) => ({ ...b, commentaire: e.target.value }))}
        />
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className={styles.bouton} onClick={envoyer} disabled={!projetId || !!enCours}>
            {enCours === "reviser" ? "Le Publiciste révise…" : "Envoyer au Publiciste"}
          </button>
          {(nbModifiees > 0 || sb.commentaire.trim()) && (
            <span className={styles.note}>
              {nbModifiees ? `${nbModifiees} scène${nbModifiees > 1 ? "s modifiées" : " modifiée"}` : ""}
              {nbModifiees && sb.commentaire.trim() ? " · " : ""}
              {sb.commentaire.trim() ? "une remarque sur l'ensemble" : ""}. Je vous montre les différences avant de remplacer quoi que ce soit.
            </span>
          )}
        </div>
      </section>

      {vue !== null && (
        <Visionneuse
          scenes={sb.scenes}
          index={vue}
          src={(i) => (sb.scenes[i]?.croquis && projetId ? urlFichier(projetId, sb.scenes[i].croquis!) : null)}
          aller={setVue}
          fermer={() => setVue(null)}
        />
      )}
      {anim && anim.info && projetId && (
        <Animatique
          scenes={sb.scenes}
          croquis={sb.scenes.map((s) => (s.croquis ? urlFichier(projetId, s.croquis) : null))}
          voix={anim.voix}
          musique={musique?.url ?? null}
          info={anim.info}
          fermer={() => setAnim(null)}
        />
      )}
    </>
  );
}
