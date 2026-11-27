"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./StudioPubliciste.module.css";
import { apiFetchInit } from "@/lib/apiFetch";
import { Lecteur } from "./Lecteur";
import type { EtatProjet, FichePubliciste } from "@/lib/publiciste";
import {
  ACCORD_MA_VOIX,
  JEUX_VOIX,
  MA_VOIX,
  TEXTE_ESSAI_MAX,
  VOIX_GEMINI,
  texteEssaiParDefaut,
  type EtatVoix,
  type IdVoix,
} from "@/lib/publicisteDirection";

/**
 * Publiciste, lot 3 : l'étape « Voix », conforme à la maquette — le tableau
 * des voix (Écarter / Choisir), « Ma voix » et « Comment la voix doit-elle
 * jouer ? ». Six voix Gemini (décision de l'éditeur, 27/11) ; « Ma voix » est
 * recomposée par Mistral à partir d'un enregistrement de l'auteur. Seul ajout
 * à la maquette : le texte d'essai, modifiable — le texte du film n'existe
 * qu'au storyboard (lot 4), et « Texte entier » attend ce lot.
 */

const MICRO = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

const TEXTE_MA_VOIX =
  "J'autorise la reproduction de ma voix pour mes propres projets. Je vais vous raconter une histoire simple. Elle commence un matin, dans un atelier où l'on prend son temps. On y fabrique des choses qui durent, avec des mains patientes. Il y a des objets qu'on n'oublie pas, parce qu'ils portent un souvenir. C'est ce souvenir que je veux partager avec vous.";

/** Durée maximale envoyée à Mistral (il refuse au-delà de 30 s). */
const DUREE_MAX = 29.5;
const TAUX = 24000;

/** Un enregistrement quelconque (webm, m4a, mp3…) → WAV mono 16 bits 24 kHz, coupé à 29,5 s. */
async function versWav(blob: Blob): Promise<{ wav: Blob; duree: number }> {
  const brut = await blob.arrayBuffer();
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const son = await ctx.decodeAudioData(brut.slice(0));
  void ctx.close();
  const duree = Math.min(son.duration, DUREE_MAX);
  const hors = new OfflineAudioContext(1, Math.ceil(duree * TAUX), TAUX);
  const src = hors.createBufferSource();
  src.buffer = son;
  src.connect(hors.destination);
  src.start(0);
  const rendu = await hors.startRendering();
  const pcm = rendu.getChannelData(0);
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const d = new DataView(buf);
  const ecr = (o: number, s: string) => [...s].forEach((c, i) => d.setUint8(o + i, c.charCodeAt(0)));
  ecr(0, "RIFF");
  d.setUint32(4, 36 + pcm.length * 2, true);
  ecr(8, "WAVEfmt ");
  d.setUint32(16, 16, true);
  d.setUint16(20, 1, true);
  d.setUint16(22, 1, true);
  d.setUint32(24, TAUX, true);
  d.setUint32(28, TAUX * 2, true);
  d.setUint16(32, 2, true);
  d.setUint16(34, 16, true);
  ecr(36, "data");
  d.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) d.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  return { wav: new Blob([buf], { type: "audio/wav" }), duree: son.duration };
}

export function EtapeVoix({
  numero,
  projetId,
  etat,
  modifier,
  fiche,
}: {
  numero: number;
  projetId: string | null;
  etat: EtatProjet;
  modifier: (f: (e: EtatProjet) => EtatProjet) => void;
  fiche: FichePubliciste;
}) {
  const defaut = texteEssaiParDefaut(etat.direction?.typo?.specimen, fiche.marque, fiche.projet);
  const v: EtatVoix = etat.voix ?? { texte: defaut, extraits: {}, ecartees: [] };
  const texte = v.texte || defaut;
  const choisie = etat.choix.voix as IdVoix | undefined;
  const [enCours, setEnCours] = useState<Partial<Record<IdVoix, boolean>>>({});
  const [echecs, setEchecs] = useState<Partial<Record<IdVoix, string>>>({});
  const [maVoix, setMaVoix] = useState<{ presente: boolean; duree: number | null } | null>(null);

  useEffect(() => {
    if (!projetId) return;
    fetch("/api/publiciste/ma-voix", apiFetchInit())
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setMaVoix(j ? { presente: !!j.presente, duree: j.duree ?? null } : { presente: false, duree: null }))
      .catch(() => setMaVoix({ presente: false, duree: null }));
  }, [projetId]);

  const ecrire = (f: (x: EtatVoix) => EtatVoix) => modifier((e) => ({ ...e, voix: f(e.voix ?? { texte: defaut, extraits: {}, ecartees: [] }) }));

  const faireLire = async (id: IdVoix, t = texte) => {
    if (!projetId) return;
    setEnCours((s) => ({ ...s, [id]: true }));
    setEchecs((s) => ({ ...s, [id]: undefined }));
    try {
      const r = await fetch(
        `/api/publiciste/projets/${projetId}/voix`,
        apiFetchInit({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voix: id, texte: t }) })
      );
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? `réf. ${r.status}`);
      ecrire((x) => ({ ...x, texte: x.texte || t, extraits: { ...x.extraits, [id]: { fichier: j.nom, texte: j.texte } } }));
    } catch (e) {
      setEchecs((s) => ({ ...s, [id]: (e as Error).message }));
    } finally {
      setEnCours((s) => ({ ...s, [id]: false }));
    }
  };

  const aJour = (id: IdVoix) => v.extraits[id]?.texte === texte;
  const aFaire = VOIX_GEMINI.map((x) => x.id as IdVoix).filter((id) => !v.ecartees.includes(id) && !aJour(id));
  const toutesEnCours = Object.values(enCours).some(Boolean);

  /** Fait lire les voix manquantes, deux à la fois (Gemini plafonne les appels par minute : 429 à trois). */
  const faireLireTout = async () => {
    ecrire((x) => ({ ...x, texte }));
    const file = [...aFaire];
    const travailleur = async () => {
      for (let id = file.shift(); id; id = file.shift()) await faireLire(id);
    };
    await Promise.all([travailleur(), travailleur()]);
  };

  const basculerEcart = (id: IdVoix) =>
    modifier((e) => {
      const x = e.voix ?? { texte: defaut, extraits: {}, ecartees: [] };
      const ecartee = x.ecartees.includes(id);
      const choix = { ...e.choix };
      if (!ecartee && choix.voix === id) delete choix.voix;
      return { ...e, choix, voix: { ...x, ecartees: ecartee ? x.ecartees.filter((y) => y !== id) : [...x.ecartees, id] } };
    });
  const choisir = (id: IdVoix) =>
    modifier((e) => {
      const x = e.voix ?? { texte: defaut, extraits: {}, ecartees: [] };
      const choix = { ...e.choix };
      if (choix.voix === id) delete choix.voix;
      else choix.voix = id;
      return { ...e, choix, voix: { ...x, ecartees: x.ecartees.filter((y) => y !== id) } };
    });

  const extrait = (id: IdVoix, nom: string) => {
    const ex = v.extraits[id];
    if (enCours[id]) return <span className={styles.extraitAttente}>La voix lit le texte…</span>;
    if (ex && projetId)
      return (
        <>
          <Lecteur petit src={`/api/publiciste/projets/${projetId}/fichiers/${ex.fichier}`} libelle={`${nom}, texte d'essai`} />
          {!aJour(id) && (
            <span className={styles.note}>
              Ancien texte.{" "}
              <button type="button" className={styles.lien} onClick={() => faireLire(id)}>
                Relire
              </button>
            </span>
          )}
        </>
      );
    return (
      <span className={styles.extraitAttente}>
        {echecs[id] ? `Échec (${echecs[id]}).` : "Pas encore lu."}{" "}
        {projetId && (
          <button type="button" className={styles.lien} onClick={() => faireLire(id)}>
            {echecs[id] ? "Réessayer" : "Faire lire"}
          </button>
        )}
      </span>
    );
  };

  const ligne = (id: IdVoix, nom: string, genre: string, timbre: string) => {
    const ecartee = v.ecartees.includes(id);
    const estChoisie = choisie === id;
    return (
      <tr key={id} className={[ecartee ? styles.ligneEcartee : "", estChoisie ? styles.ligneChoisie : ""].join(" ")}>
        <td>
          <div className={styles.vNom}>
            <b>{nom}</b>
            {estChoisie && <span>Votre choix</span>}
          </div>
        </td>
        <td>
          <span className={styles.vGenre}>{genre === "homme" ? "Homme" : "Femme"}</span>
        </td>
        <td className={styles.cLarge}>
          <span className={styles.vTimbre}>{timbre}</span>
        </td>
        <td className={styles.cLarge}>{extrait(id, nom)}</td>
        <td className={styles.cLarge}>
          <div className={styles.vActions}>
            <button type="button" className={styles.miniB} disabled title="Arrive avec le storyboard : l'histoire complète, avec ses silences.">
              Texte entier
            </button>
            {id !== MA_VOIX && (
              <button type="button" className={[styles.miniB, styles.non].join(" ")} aria-pressed={ecartee} onClick={() => basculerEcart(id)}>
                {ecartee ? "Écartée" : "Écarter"}
              </button>
            )}
            <button type="button" className={styles.miniB} aria-pressed={estChoisie} onClick={() => choisir(id)}>
              {estChoisie ? "Choisie" : "Choisir"}
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <>
      <div className={styles.intro}>
        <span className={styles.mono}>Étape {numero} sur 7</span>
        <h2 className={styles.titre}>Voix</h2>
        <p className={styles.sous}>Six voix lisent le même texte : trois voix d&apos;homme, trois voix de femme. Et la vôtre, recomposée, si vous le souhaitez.</p>
      </div>
      <div className={styles.bulle}>
        <span className={styles.avatar} aria-hidden="true">
          P
        </span>
        <div className={styles.bulleTxt}>
          <p>
            Les voix Gemini reçoivent la même consigne : <strong>français de France</strong>, voix basse et chaude, comme une confidence. Je
            n&apos;entends pas les accents moi-même : c&apos;est votre oreille qui tranche.
          </p>
          <p>L&apos;extrait fait entendre le texte d&apos;essai. « Texte entier » jouera l&apos;histoire complète, avec ses silences, une fois le storyboard écrit.</p>
        </div>
      </div>

      <div className={styles.texteEssai}>
        <label className={styles.lab} htmlFor="texte-essai">
          Texte lu par les voix
        </label>
        <textarea id="texte-essai" maxLength={TEXTE_ESSAI_MAX} value={texte} onChange={(e) => ecrire((x) => ({ ...x, texte: e.target.value }))} />
        {projetId ? (
          <div className={styles.lancer}>
            <button type="button" className={[styles.bouton, styles.corail].join(" ")} onClick={faireLireTout} disabled={toutesEnCours || !aFaire.length || texte.trim().length < 3}>
              {toutesEnCours ? "Lecture…" : aFaire.length === 6 ? "Faire lire les six voix" : aFaire.length ? `Faire lire ${aFaire.length === 1 ? "la voix restante" : `les ${aFaire.length} voix restantes`}` : "Toutes les voix ont lu ce texte"}
            </button>
            <span className={styles.note}>Une vingtaine de secondes. Voix facturées par Google, hors du coût affiché.</span>
          </div>
        ) : (
          <div className={styles.aVenir}>Dans l&apos;aperçu, rien n&apos;est généré : ouvrez le gent dans votre espace pour faire lire les voix.</div>
        )}
      </div>

      <div className={styles.tableauVoix}>
        <table>
          <thead>
            <tr>
              <th scope="col">Voix</th>
              <th scope="col">Genre</th>
              <th scope="col">Timbre annoncé</th>
              <th scope="col" style={{ width: "34%" }}>
                Extrait
              </th>
              <th scope="col">
                <span className={styles.sr}>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className={styles.groupeVoix}>
              <th scope="colgroup" colSpan={5}>
                Gemini · Google
              </th>
            </tr>
            {VOIX_GEMINI.map((x) => ligne(x.id, x.nom, x.genre, x.timbre))}
            {maVoix?.presente && (
              <>
                <tr className={styles.groupeVoix}>
                  <th scope="colgroup" colSpan={5}>
                    Mistral · Voxtral
                  </th>
                </tr>
                {ligne(MA_VOIX, "Votre voix", "homme", "Recomposée")}
              </>
            )}
          </tbody>
        </table>
      </div>

      <MaVoix
        projetId={projetId}
        etat={maVoix}
        choisie={choisie === MA_VOIX}
        extraitPret={!!v.extraits[MA_VOIX]}
        surEnregistree={async () => {
          setMaVoix((m) => ({ presente: true, duree: m?.duree ?? null }));
          await faireLire(MA_VOIX);
        }}
        surSupprimee={() => {
          setMaVoix({ presente: false, duree: null });
          modifier((e) => {
            const choix = { ...e.choix };
            if (choix.voix === MA_VOIX) delete choix.voix;
            const x = e.voix ?? { texte: defaut, extraits: {}, ecartees: [] };
            const extraits = { ...x.extraits };
            delete extraits[MA_VOIX];
            return { ...e, choix, voix: { ...x, extraits } };
          });
        }}
        choisir={() => choisir(MA_VOIX)}
        echec={echecs[MA_VOIX]}
        enCours={!!enCours[MA_VOIX]}
      />

      <div style={{ display: "grid", gap: 10 }}>
        <h3 className={styles.sectionT}>Comment la voix doit-elle jouer ?</h3>
        <div className={styles.jeux}>
          {JEUX_VOIX.map((j) => (
            <button
              key={j.id}
              type="button"
              className={styles.miniB}
              aria-pressed={v.jeu === j.id}
              title={j.note}
              onClick={() => ecrire((x) => ({ ...x, jeu: x.jeu === j.id ? undefined : j.id }))}
            >
              {j.nom}
              {"reco" in j && j.reco ? " · recommandé" : ""}
            </button>
          ))}
        </div>
        <p className={styles.note} style={{ margin: 0 }}>
          Ce réglage s&apos;applique à la prise finale : il n&apos;est pas encore entendu ici. Le timbre est celui que Google annonce pour chaque voix.
        </p>
      </div>
    </>
  );
}

function MaVoix({
  projetId,
  etat,
  choisie,
  extraitPret,
  surEnregistree,
  surSupprimee,
  choisir,
  echec,
  enCours,
}: {
  projetId: string | null;
  etat: { presente: boolean; duree: number | null } | null;
  choisie: boolean;
  extraitPret: boolean;
  surEnregistree: () => Promise<void>;
  surSupprimee: () => void;
  choisir: () => void;
  echec?: string;
  enCours: boolean;
}) {
  const [echantillon, setEchantillon] = useState<{ url: string; blob: Blob; nom: string; duree: number } | null>(null);
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [enregistre, setEnregistre] = useState(false);
  const enreg = useRef<MediaRecorder | null>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (echantillon) URL.revokeObjectURL(echantillon.url);
  }, [echantillon]);
  useEffect(
    () => () => {
      enreg.current?.stop();
      if (minuterie.current) clearTimeout(minuterie.current);
    },
    []
  );

  const garder = async (blob: Blob, nom: string) => {
    try {
      const { wav, duree } = await versWav(blob);
      setEchantillon({ url: URL.createObjectURL(wav), blob: wav, nom, duree });
      setMessage(
        duree < 20
          ? "Un peu court : visez 30 secondes, en lisant tout le texte."
          : duree > DUREE_MAX
            ? `Enregistrement de ${Math.round(duree)} s : seules les ${Math.floor(DUREE_MAX)} premières secondes seront gardées.`
            : ""
      );
    } catch {
      setMessage("Cet enregistrement n'a pas pu être lu. Essayez un autre fichier (mémo vocal, MP3, WAV).");
    }
  };

  const enregistrer = async () => {
    if (enreg.current) return enreg.current.stop();
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const morceaux: Blob[] = [];
      const r = new MediaRecorder(flux);
      r.ondataavailable = (e) => morceaux.push(e.data);
      r.onstop = () => {
        flux.getTracks().forEach((t) => t.stop());
        enreg.current = null;
        setEnregistre(false);
        if (minuterie.current) clearTimeout(minuterie.current);
        void garder(new Blob(morceaux, { type: morceaux[0]?.type || "audio/webm" }), "Votre enregistrement");
      };
      r.start();
      enreg.current = r;
      setEnregistre(true);
      setMessage("Enregistrement… lisez le texte jusqu'au bout. Il s'arrête seul à 30 secondes.");
      minuterie.current = setTimeout(() => r.state === "recording" && r.stop(), 30_000);
    } catch {
      setMessage("Le micro n'est pas accessible ici. Importez un enregistrement de votre voix (mémo vocal, fichier audio).");
    }
  };

  const recomposer = async () => {
    if (!echantillon || !consent || !projetId) return;
    setEnvoi(true);
    setMessage("");
    try {
      const r = await fetch(
        "/api/publiciste/ma-voix",
        apiFetchInit({ method: "POST", headers: { "Content-Type": "audio/wav", "x-accord-ma-voix": "oui" }, body: echantillon.blob })
      );
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? `Votre voix n'a pas pu être envoyée (réf. ${r.status}).`);
      await surEnregistree();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  };

  const supprimer = async () => {
    const r = await fetch("/api/publiciste/ma-voix", apiFetchInit({ method: "DELETE" })).catch(() => null);
    if (!r?.ok) return setMessage("Votre voix n'a pas pu être supprimée. Réessayez.");
    if (echantillon) URL.revokeObjectURL(echantillon.url);
    setEchantillon(null);
    setConsent(false);
    surSupprimee();
  };

  const presente = !!etat?.presente;
  return (
    <section className={[styles.maVoix, choisie ? styles.maVoixChoisie : ""].join(" ")} aria-labelledby="mv-titre">
      <div className={styles.mvTete}>
        <div>
          <span className={styles.lab}>Votre voix</span>
          <h3 id="mv-titre">Ma voix</h3>
        </div>
        <span className={[styles.mvStatut, presente ? styles.mvStatutOk : ""].join(" ")}>{presente ? "Enregistrée" : "Facultatif"}</span>
      </div>
      <p className={styles.mvIntro}>
        La narration peut être dite par votre propre voix, recomposée à partir d&apos;un enregistrement de 30 secondes. C&apos;est votre voix qui raconte, sur tous les plans du film.
      </p>
      <ol className={styles.mvEtapes}>
        <li>
          <b>Lisez ce texte à voix haute</b>
          <span className={styles.note}>Environ 30 secondes, dans une pièce calme, à 20 cm du micro. La première phrase vaut accord, dite de votre voix.</span>
          <blockquote className={styles.mvTexte}>{TEXTE_MA_VOIX}</blockquote>
          <div className={styles.mvActions}>
            <button type="button" className={[styles.bouton, styles.corail, styles.parler].join(" ")} onClick={enregistrer} disabled={!projetId}>
              {MICRO}
              <span>{enregistre ? "Arrêter" : echantillon ? "Recommencer" : "Enregistrer"}</span>
            </button>
            <input
              type="file"
              id="mv-fichier"
              accept="audio/*"
              className={styles.sr}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void garder(f, f.name);
                e.target.value = "";
              }}
            />
            <label htmlFor="mv-fichier" className={[styles.bouton, styles.leger].join(" ")}>
              Importer un enregistrement
            </label>
          </div>
          {echantillon && (
            <div className={styles.mvEch}>
              <span className={styles.mvNom}>
                {echantillon.nom} · {Math.round(Math.min(echantillon.duree, DUREE_MAX))} s
              </span>
              <audio controls src={echantillon.url} preload="metadata" />
            </div>
          )}
          {message && (
            <p className={styles.note} style={{ margin: 0 }} aria-live="polite">
              {message}
            </p>
          )}
        </li>
        <li>
          <b>Confirmez que c&apos;est votre voix</b>
          <label className={styles.mvConsent} htmlFor="mv-consent">
            <input type="checkbox" id="mv-consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{ACCORD_MA_VOIX}</span>
          </label>
        </li>
        <li>
          <b>Écoutez-la lire votre histoire</b>
          {presente ? (
            <div className={styles.mvResultat}>
              <p style={{ margin: 0 }}>
                {enCours
                  ? "Votre voix est recomposée et lit le texte d'essai…"
                  : extraitPret
                    ? "Votre voix lit le texte d'essai : écoutez-la dans le tableau, comme les autres voix."
                    : echec
                      ? `Votre voix n'a pas pu lire le texte (${echec}). Réessayez depuis le tableau.`
                      : "Votre enregistrement est gardé. Faites-la lire depuis le tableau."}
              </p>
              <div className={styles.mvActions}>
                <button type="button" className={styles.miniB} aria-pressed={choisie} onClick={choisir}>
                  {choisie ? "Choisie pour la narration" : "Choisir ma voix"}
                </button>
                <button type="button" className={[styles.miniB, styles.non].join(" ")} onClick={supprimer}>
                  Supprimer ma voix
                </button>
                {echantillon && consent && (
                  <button type="button" className={styles.miniB} onClick={recomposer} disabled={envoi}>
                    Remplacer par ce nouvel enregistrement
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.mvActions}>
              <button type="button" className={styles.bouton} onClick={recomposer} disabled={!echantillon || !consent || envoi || !projetId}>
                {envoi ? "Envoi…" : "Recomposer ma voix"}
              </button>
            </div>
          )}
        </li>
      </ol>
      <p className={styles.note} style={{ margin: 0 }}>
        Votre voix ne sert qu&apos;à vos projets, jamais à ceux d&apos;un autre auteur. Recomposition par Mistral (Voxtral) : elle reprend aussi le ton, le bruit de fond et le micro de
        l&apos;enregistrement, alors enregistrez-vous dans le ton voulu pour le film.
      </p>
    </section>
  );
}
