"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./AtelierFilm.module.css";
import {
  MOTS_PAR_SECONDE,
  DUREE_SCENE_MAX,
  DUREE_SCENE_MIN,
  VOIX_PAR_DEFAUT,
  VOIX_PUBLICISTE,
  type SceneFilm,
  type Storyboard,
  type VoixPubliciste,
} from "@/lib/publiciste";
import { calendrier, nomFichierFilm, FORMAT_VERTICAL } from "@/lib/filmRendu";
import { formatDuree } from "@/lib/prompteur";
import { apiFetchInit } from "@/lib/apiFetch";
import {
  brancherSon,
  capacites,
  dessinerImage,
  fabriquerMp4,
  mixer,
  preparerImage,
  type CapacitesEncodage,
  type ImageScene,
} from "./rendu";

/**
 * Atelier du film (gent « Le Publiciste », lot 1). Le storyboard écrit dans la
 * conversation devient un film : voix Mistral générée scène par scène (un
 * appel court chacune, enchaînés ici), images importées (le lot 2 les
 * générera), musique importée, aperçu en direct, puis MP4 vertical fabriqué
 * dans le navigateur. Rien n'est envoyé au serveur hormis le texte des voix.
 *
 * Gardé dans ce navigateur : les retouches du storyboard et la voix choisie.
 * Perdu à la fermeture : images, musique, voix générées, film — d'où la
 * confirmation avant de fermer un film non enregistré.
 */

interface VoixScene {
  texte: string;
  voix: VoixPubliciste;
  buffer: AudioBuffer;
}

const cleStockage = (cle: string) => `getgents:atelier-film:${cle}`;
const motsDe = (t: string) => t.split(/\s+/).filter(Boolean).length;
const mo = (octets: number) => `${(octets / 1e6).toFixed(1).replace(".", ",")} Mo`;

function lireRetouches(cle: string): { scenes?: SceneFilm[]; voix?: VoixPubliciste } {
  try {
    const brut = localStorage.getItem(cleStockage(cle));
    return brut ? JSON.parse(brut) : {};
  } catch {
    return {};
  }
}

export function AtelierFilm({ storyboard, cle, onClose }: { storyboard: Storyboard; cle: string; onClose: () => void }) {
  const retouches = useMemo(() => lireRetouches(cle), [cle]);
  const [scenes, setScenes] = useState<SceneFilm[]>(() =>
    retouches.scenes?.length === storyboard.scenes.length ? retouches.scenes : storyboard.scenes
  );
  const [voix, setVoix] = useState<VoixPubliciste>(retouches.voix ?? VOIX_PAR_DEFAUT);
  const [images, setImages] = useState<(ImageScene | null)[]>(() => storyboard.scenes.map(() => null));
  const [vignettes, setVignettes] = useState<(string | null)[]>(() => storyboard.scenes.map(() => null));
  const [voixScenes, setVoixScenes] = useState<(VoixScene | undefined)[]>([]);
  const [musique, setMusique] = useState<{ buffer: AudioBuffer; nom: string } | null>(null);
  const [volumeMusique, setVolumeMusique] = useState(1);
  const [sousTitres, setSousTitres] = useState(true);
  const [generation, setGeneration] = useState<{ fait: number; total: number } | null>(null);
  const [message, setMessage] = useState<{ ton: "info" | "erreur"; texte: string } | null>(null);
  const [lecture, setLecture] = useState(false);
  const [instant, setInstant] = useState(0);
  const [caps, setCaps] = useState<CapacitesEncodage | null>(null);
  const [rendu, setRendu] = useState<{ part: number } | null>(null);
  const [film, setFilm] = useState<{ blob: Blob; url: string; nom: string; enregistre: boolean } | null>(null);

  const toileRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const lectureRef = useRef<{ sources: AudioScheduledSourceNode[]; t0: number; depuis: number; raf: number } | null>(null);
  const annulerRef = useRef(false);
  const instantRef = useRef(0);

  // Retouches gardées dans ce navigateur, par gent et par réponse.
  useEffect(() => {
    try {
      localStorage.setItem(cleStockage(cle), JSON.stringify({ scenes, voix }));
    } catch {
      /* stockage indisponible : les retouches durent le temps de la fenêtre */
    }
  }, [cle, scenes, voix]);

  useEffect(() => {
    capacites(FORMAT_VERTICAL.largeur, FORMAT_VERTICAL.hauteur).then(setCaps, () => setCaps({ video: null, audio: null, audioOpus: false }));
  }, []);

  // Une voix ne vaut que pour le texte et la voix avec lesquels elle a été générée.
  const voixValides = useMemo(
    () => scenes.map((s, i) => {
      const v = voixScenes[i];
      return v && v.texte === s.voix.trim() && v.voix === voix ? v.buffer : undefined;
    }),
    [scenes, voixScenes, voix]
  );
  const cal = useMemo(() => calendrier(scenes, voixValides.map((b) => b?.duration)), [scenes, voixValides]);
  const aGenerer = scenes.filter((s, i) => s.voix.trim() && !voixValides[i]).length;

  const contexteAudio = useCallback(() => {
    if (!audioRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioRef.current = new AC();
    }
    return audioRef.current;
  }, []);

  // --- Aperçu -------------------------------------------------------------
  const dessiner = useCallback(
    (t: number) => {
      const c = toileRef.current;
      const g = c?.getContext("2d");
      if (!c || !g) return;
      dessinerImage(g, c.width, c.height, t, cal, scenes, images, sousTitres);
    },
    [cal, scenes, images, sousTitres]
  );
  // Au repos sur 0 s, l'aperçu montre la première scène déjà apparue : l'image 0
  // du film est le début d'un fondu au noir, un aperçu noir ne dirait rien.
  const dessinerAuRepos = useCallback((t: number) => dessiner(t === 0 ? Math.min(0.9, cal.total) : t), [dessiner, cal.total]);
  useEffect(() => {
    if (!lecture) dessinerAuRepos(instantRef.current);
  }, [dessinerAuRepos, lecture]);

  const arreter = useCallback(() => {
    const l = lectureRef.current;
    if (!l) return;
    cancelAnimationFrame(l.raf);
    for (const s of l.sources) {
      try {
        s.stop();
      } catch {
        /* déjà arrêtée */
      }
    }
    lectureRef.current = null;
    setLecture(false);
  }, []);

  const lire = useCallback(async () => {
    if (lectureRef.current) return arreter();
    const ctx = contexteAudio();
    await ctx.resume();
    const depuis = instantRef.current >= cal.total - 0.05 ? 0 : instantRef.current;
    const t0 = ctx.currentTime + 0.08;
    const sources = brancherSon(ctx, ctx.destination, cal, voixValides, musique?.buffer ?? null, t0, depuis, volumeMusique);
    const l = { sources, t0, depuis, raf: 0 };
    lectureRef.current = l;
    setLecture(true);
    const boucle = () => {
      if (lectureRef.current !== l) return;
      const t = Math.max(0, ctx.currentTime - t0) + depuis;
      instantRef.current = Math.min(t, cal.total);
      dessiner(instantRef.current);
      setInstant(instantRef.current);
      if (t >= cal.total) return arreter();
      l.raf = requestAnimationFrame(boucle);
    };
    boucle();
  }, [arreter, cal, contexteAudio, dessiner, musique, voixValides, volumeMusique]);

  // Toute retouche arrête la lecture : l'aperçu repartirait sur un calendrier périmé.
  useEffect(() => arreter, [arreter, cal, musique, volumeMusique]);

  const allerA = (t: number) => {
    arreter();
    instantRef.current = t;
    setInstant(t);
    dessinerAuRepos(t);
  };

  // --- Voix ---------------------------------------------------------------
  const genererVoix = async () => {
    arreter();
    const ctx = contexteAudio();
    const aFaire = scenes.map((s, i) => ({ s, i })).filter(({ s, i }) => s.voix.trim() && !voixValides[i]);
    if (!aFaire.length) return;
    setMessage(null);
    setGeneration({ fait: 0, total: aFaire.length });
    const nouvelles = [...voixScenes];
    for (let k = 0; k < aFaire.length; k++) {
      const { s, i } = aFaire[k];
      const texte = s.voix.trim();
      let reponse: Response | null = null;
      // Une reprise par phrase : un refus passager de Mistral ne doit pas tout arrêter.
      for (let essai = 0; essai < 2 && !reponse?.ok; essai++) {
        try {
          reponse = await fetch("/api/publiciste/voix", apiFetchInit({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texte, voix }),
          }));
        } catch {
          reponse = null;
        }
        if (reponse && (reponse.status === 401 || reponse.status === 403 || reponse.status === 429 || reponse.status === 503)) break;
      }
      if (!reponse?.ok) {
        const detail = reponse ? await reponse.json().catch(() => null) : null;
        setMessage({
          ton: "erreur",
          texte:
            (detail && typeof detail.message === "string" ? detail.message : "La voix n'a pas pu être générée.") +
            ` (scène ${i + 1}, voix ${VOIX_PUBLICISTE.find((v) => v.id === voix)?.nom ?? voix}, réf. ${
              detail && typeof detail.ref === "string" ? detail.ref : reponse ? reponse.status : "réseau"
            }). Les voix déjà prêtes sont gardées.`,
        });
        break;
      }
      try {
        const buffer = await ctx.decodeAudioData(await reponse.arrayBuffer());
        nouvelles[i] = { texte, voix, buffer };
        setVoixScenes([...nouvelles]);
      } catch {
        setMessage({ ton: "erreur", texte: `La voix de la scène ${i + 1} est illisible. Réessayez.` });
        break;
      }
      setGeneration({ fait: k + 1, total: aFaire.length });
    }
    setGeneration(null);
  };

  // --- Images et musique --------------------------------------------------
  const importerImage = async (i: number, f: File | undefined) => {
    if (!f) return;
    try {
      const img = await preparerImage(f);
      setImages((prev) => prev.map((x, k) => (k === i ? img : x)));
      setVignettes((prev) => {
        if (prev[i]) URL.revokeObjectURL(prev[i]!);
        return prev.map((x, k) => (k === i ? URL.createObjectURL(f) : x));
      });
    } catch {
      setMessage({ ton: "erreur", texte: "Cette image n'a pas pu être lue. Essayez un fichier JPEG ou PNG." });
    }
  };
  const retirerImage = (i: number) => {
    setImages((prev) => prev.map((x, k) => (k === i ? null : x)));
    setVignettes((prev) => {
      if (prev[i]) URL.revokeObjectURL(prev[i]!);
      return prev.map((x, k) => (k === i ? null : x));
    });
  };
  const importerMusique = async (f: File | undefined) => {
    if (!f) return;
    try {
      const buffer = await contexteAudio().decodeAudioData(await f.arrayBuffer());
      setMusique({ buffer, nom: f.name });
    } catch {
      setMessage({ ton: "erreur", texte: "Cette musique n'a pas pu être lue. Essayez un fichier MP3 ou M4A." });
    }
  };

  const modifierScene = (i: number, patch: Partial<SceneFilm>) =>
    setScenes((prev) => prev.map((s, k) => (k === i ? { ...s, ...patch } : s)));

  // --- Fabrication --------------------------------------------------------
  const fabriquer = async () => {
    if (!caps?.video) return;
    arreter();
    annulerRef.current = false;
    setMessage(null);
    setRendu({ part: 0 });
    try {
      const son = voixValides.some(Boolean) || musique ? await mixer(cal, voixValides, musique?.buffer ?? null, volumeMusique) : null;
      const blob = await fabriquerMp4({
        largeur: FORMAT_VERTICAL.largeur,
        hauteur: FORMAT_VERTICAL.hauteur,
        cal,
        scenes,
        images,
        son,
        caps,
        sousTitres,
        progression: (part) => setRendu({ part }),
        annule: () => annulerRef.current,
      });
      if (film) URL.revokeObjectURL(film.url);
      setFilm({ blob, url: URL.createObjectURL(blob), nom: nomFichierFilm(storyboard.titre, new Date()), enregistre: false });
    } catch (e) {
      if ((e as Error).message !== "annule") {
        setMessage({ ton: "erreur", texte: `La fabrication a échoué : ${(e as Error).message}` });
        console.error("[getgents:publiciste] rendu", e);
      }
    }
    setRendu(null);
  };

  const telecharger = () => {
    if (!film) return;
    const a = document.createElement("a");
    a.href = film.url;
    a.download = film.nom;
    document.body.append(a);
    a.click();
    a.remove();
    setFilm({ ...film, enregistre: true });
  };
  const fichierFilm = film ? new File([film.blob], film.nom, { type: "video/mp4" }) : null;
  const peutPartager = !!fichierFilm && typeof navigator !== "undefined" && !!navigator.canShare && navigator.canShare({ files: [fichierFilm] });
  const partager = async () => {
    if (!film || !fichierFilm) return;
    try {
      await navigator.share({ files: [fichierFilm], title: storyboard.titre });
      setFilm({ ...film, enregistre: true });
    } catch {
      /* partage annulé */
    }
  };

  // --- Fermeture ----------------------------------------------------------
  const fermer = useCallback(() => {
    if (rendu) annulerRef.current = true;
    if (film && !film.enregistre && !window.confirm("Le film n'est pas enregistré : il n'existe que dans cette fenêtre. Fermer quand même ?")) return;
    arreter();
    onClose();
  }, [arreter, film, onClose, rendu]);
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [fermer]);
  useEffect(
    () => () => {
      arreter();
      audioRef.current?.close().catch(() => {});
    },
    [arreter]
  );

  const allongees = cal.scenes.filter((p) => p.allongee).length;

  return (
    <div className={styles.voile} role="dialog" aria-modal="true" aria-label={`Atelier du film : ${storyboard.titre}`}>
      <header className={styles.entete}>
        <div className={styles.titre}>
          <span className={styles.titreTexte}>{storyboard.titre}</span>
          <span className={styles.duree}>
            {scenes.length} scènes · {formatDuree(Math.round(cal.total))}
          </span>
        </div>
        <button type="button" className={styles.fermer} onClick={fermer} aria-label="Fermer l'atelier">
          ×
        </button>
      </header>

      <div className={styles.corps}>
        <section className={styles.apercu} aria-label="Aperçu du film">
          <canvas ref={toileRef} width={432} height={768} className={styles.toile} />
          <div className={styles.lecteur}>
            <button type="button" className={styles.lire} onClick={lire} aria-label={lecture ? "Pause" : "Lire l'aperçu"}>
              {lecture ? "❚❚" : "▶"}
            </button>
            <input
              id="atelier-instant"
              type="range"
              min={0}
              max={cal.total}
              step={0.1}
              value={instant}
              onChange={(e) => allerA(parseFloat(e.target.value))}
              aria-label="Position dans le film"
              className={styles.curseur}
            />
            <span className={styles.temps}>{formatDuree(Math.floor(instant))}</span>
          </div>

          <div className={styles.reglages}>
            <label className={styles.reglage} htmlFor="atelier-voix">
              <span>Voix</span>
              <select id="atelier-voix" value={voix} onChange={(e) => setVoix(e.target.value as VoixPubliciste)}>
                {VOIX_PUBLICISTE.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nom}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className={styles.bouton} onClick={genererVoix} disabled={!!generation || !aGenerer}>
              {generation ? `Voix ${generation.fait} / ${generation.total}…` : aGenerer ? `Générer ${aGenerer > 1 ? `les ${aGenerer} voix` : "la voix"}` : "Voix prêtes"}
            </button>
            <div className={styles.reglage}>
              <span>Musique</span>
              <label className={styles.boutonSecondaire} htmlFor="atelier-musique">
                {musique ? "Changer" : "Importer"}
              </label>
              <input id="atelier-musique" type="file" accept="audio/*" className={styles.cache} onChange={(e) => importerMusique(e.target.files?.[0])} />
              {musique && <span className={styles.nomFichier}>{musique.nom}</span>}
            </div>
            {musique && (
              <label className={styles.reglage} htmlFor="atelier-volume">
                <span>Volume musique</span>
                <input id="atelier-volume" type="range" min={0} max={1.5} step={0.05} value={volumeMusique} onChange={(e) => setVolumeMusique(parseFloat(e.target.value))} />
              </label>
            )}
            <label className={styles.case} htmlFor="atelier-st">
              <input id="atelier-st" type="checkbox" checked={sousTitres} onChange={(e) => setSousTitres(e.target.checked)} />
              Sous-titres incrustés
            </label>
          </div>

          {message && <p className={message.ton === "erreur" ? styles.erreur : styles.info}>{message.texte}</p>}
          {allongees > 0 && (
            <p className={styles.info}>
              {allongees > 1 ? `${allongees} scènes ont été allongées` : "Une scène a été allongée"} pour que la voix y tienne.
            </p>
          )}

          <div className={styles.fabrication}>
            {caps && !caps.video && <p className={styles.erreur}>Ce navigateur ne sait pas fabriquer de vidéo. Ouvrez l&apos;atelier dans Chrome ou Safari, à jour.</p>}
            {caps?.audioOpus && <p className={styles.info}>Ce navigateur n&apos;encode pas le son en AAC : le film aura un son Opus, que certains réseaux refusent.</p>}
            {rendu ? (
              <div className={styles.progression}>
                <div className={styles.barre} aria-hidden="true">
                  <i style={{ width: `${Math.round(rendu.part * 100)}%` }} />
                </div>
                <span>Fabrication… {Math.round(rendu.part * 100)} %</span>
                <button type="button" className={styles.boutonSecondaire} onClick={() => (annulerRef.current = true)}>
                  Annuler
                </button>
              </div>
            ) : (
              <button type="button" className={styles.boutonPrincipal} onClick={fabriquer} disabled={!caps?.video || !!generation}>
                Fabriquer le film (vertical, MP4)
              </button>
            )}
            {aGenerer > 0 && !rendu && <p className={styles.note}>Sans voix générée, le film sera muet sur ces scènes.</p>}
            {film && (
              <div className={styles.resultat}>
                <video src={film.url} controls playsInline className={styles.video} />
                <span className={styles.note}>
                  {film.nom} · {mo(film.blob.size)}
                </span>
                <div className={styles.actions}>
                  {peutPartager && (
                    <button type="button" className={styles.boutonPrincipal} onClick={partager}>
                      Enregistrer / partager
                    </button>
                  )}
                  <button type="button" className={peutPartager ? styles.boutonSecondaire : styles.boutonPrincipal} onClick={telecharger}>
                    Télécharger
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className={styles.scenes} aria-label="Scènes">
          <p className={styles.note}>
            Retouchez le texte de chaque scène : vos retouches sont gardées dans ce navigateur. Les images et la musique importées restent dans
            cette fenêtre.
          </p>
          {scenes.map((s, i) => {
            const p = cal.scenes[i];
            const capacite = Math.floor(s.duree * MOTS_PAR_SECONDE);
            const mots = motsDe(s.voix);
            return (
              <article key={i} className={styles.scene}>
                <div className={styles.sceneTete}>
                  <span className={styles.num}>{String(i + 1).padStart(2, "0")}</span>
                  <input
                    id={`scene-${i}-titre`}
                    className={styles.sceneTitre}
                    value={s.titre}
                    onChange={(e) => modifierScene(i, { titre: e.target.value })}
                    aria-label={`Titre de la scène ${i + 1}`}
                  />
                  <button type="button" className={styles.temps} onClick={() => allerA(p?.debut ?? 0)} title="Voir cette scène dans l'aperçu">
                    {formatDuree(Math.floor(p?.debut ?? 0))}
                  </button>
                </div>
                <div className={styles.sceneCorps}>
                  <div className={styles.sceneImage}>
                    {vignettes[i] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={vignettes[i]!} alt={`Image de la scène ${i + 1}`} />
                    ) : (
                      <span className={styles.sansImage}>Pas d&apos;image</span>
                    )}
                    <label className={styles.boutonSecondaire} htmlFor={`scene-${i}-image`}>
                      {vignettes[i] ? "Changer" : "Importer"}
                    </label>
                    <input id={`scene-${i}-image`} type="file" accept="image/*" className={styles.cache} onChange={(e) => importerImage(i, e.target.files?.[0])} />
                    {vignettes[i] && (
                      <button type="button" className={styles.lien} onClick={() => retirerImage(i)}>
                        Retirer
                      </button>
                    )}
                  </div>
                  <div className={styles.champs}>
                    <label className={styles.champ} htmlFor={`scene-${i}-voix`}>
                      <span>
                        Voix off
                        <em className={mots > capacite ? styles.alerte : undefined}>
                          {s.voix.trim()
                            ? ` · ${mots} mots${mots > capacite ? `, ${capacite} tiennent en ${s.duree} s` : ""}${voixValides[i] ? ` · voix prête (${voixValides[i]!.duration.toFixed(1).replace(".", ",")} s)` : " · à générer"}`
                            : " · scène muette"}
                        </em>
                      </span>
                      <textarea id={`scene-${i}-voix`} rows={3} value={s.voix} onChange={(e) => modifierScene(i, { voix: e.target.value })} />
                    </label>
                    <label className={styles.champ} htmlFor={`scene-${i}-voit`}>
                      <span>On voit</span>
                      <textarea id={`scene-${i}-voit`} rows={3} value={s.voit} onChange={(e) => modifierScene(i, { voit: e.target.value })} />
                    </label>
                    <div className={styles.ligneDuree}>
                      <label htmlFor={`scene-${i}-duree`}>Durée</label>
                      <input
                        id={`scene-${i}-duree`}
                        type="number"
                        min={DUREE_SCENE_MIN}
                        max={DUREE_SCENE_MAX}
                        step={0.5}
                        value={s.duree}
                        onChange={(e) => {
                          const d = parseFloat(e.target.value);
                          if (Number.isFinite(d)) modifierScene(i, { duree: Math.min(DUREE_SCENE_MAX, Math.max(DUREE_SCENE_MIN, d)) });
                        }}
                      />
                      <span>s{p?.allongee ? ` (portée à ${(p.fin - p.debut).toFixed(1).replace(".", ",")} s pour la voix)` : ""}</span>
                      {s.son && <span className={styles.son}>Sons : {s.son}</span>}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
