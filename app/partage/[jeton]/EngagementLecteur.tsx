"use client";

import { useEffect, useState } from "react";
import { choixValides, ligneChoix, MOT_MAX, type ChoixLecteur, type LectureJointe } from "@/lib/engagement";
import { textes, type Langue } from "@/lib/langueLecteur";
import styles from "./partage.module.css";

/** Délai laissé au document pour rendre ses choix : au-delà, on ouvre sans (un artefact peut ne rien répondre). */
const DELAI_CHOIX_MS = 700;

/** Demande ses choix au document isolé ; jamais d'erreur, au pire une liste vide. */
function demanderChoix(cadre: HTMLIFrameElement | null): Promise<ChoixLecteur[]> {
  return new Promise((resoudre) => {
    const fen = cadre?.contentWindow;
    if (!fen) return resoudre([]);
    const fin = (v: ChoixLecteur[]) => {
      window.removeEventListener("message", surMessage);
      window.clearTimeout(t);
      resoudre(v);
    };
    const surMessage = (e: MessageEvent) => {
      if (e.source !== fen) return;
      const d = e.data as { getgents?: string; v?: unknown };
      if (d?.getgents === "choix") fin(choixValides(d.v));
    };
    const t = window.setTimeout(() => fin([]), DELAI_CHOIX_MS);
    window.addEventListener("message", surMessage);
    fen.postMessage({ getgents: "choix?" }, "*");
  });
}

/**
 * Le bouton d'engagement chez le LECTEUR. Au clic : les choix faits dans la
 * page sont relevés, MONTRÉS, et le lecteur décoche ce qu'il ne veut pas
 * transmettre. Une réponse par lien ; ensuite, le bouton le dit.
 */
export default function EngagementLecteur({
  jeton,
  intitule,
  mot,
  destinataire,
  dejaRepondu,
  cadre,
  mesure,
  invite = null,
  onRepondu,
  langue,
}: {
  jeton: string;
  intitule: string;
  mot: boolean;
  destinataire: string;
  dejaRepondu: boolean;
  cadre: React.RefObject<HTMLIFrameElement | null>;
  /** La visite en cours, mesurée dans la page (VuePartage). */
  mesure: () => LectureJointe;
  /** Lien de groupe : le prénom choisi, transmis avec la réponse. */
  invite?: string | null;
  onRepondu?: () => void;
  langue: Langue;
}) {
  const t = textes(langue);
  const [envoye, setEnvoye] = useState(dejaRepondu);
  const [ouvert, setOuvert] = useState(false);
  const [releve, setReleve] = useState(false);
  const [choix, setChoix] = useState<ChoixLecteur[]>([]);
  const [garde, setGarde] = useState<boolean[]>([]);
  const [texte, setTexte] = useState("");
  // NON cochée par défaut : joindre sa lecture est un geste, distinct de la réponse.
  const [joindre, setJoindre] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && !envoi && setOuvert(false);
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouvert, envoi]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(false), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const ouvrir = async () => {
    setErreur(null);
    setReleve(true);
    const c = await demanderChoix(cadre.current);
    setChoix(c);
    setGarde(c.map(() => true));
    setReleve(false);
    setJoindre(false);
    setOuvert(true);
  };

  const envoyer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await fetch(`/api/partage/${encodeURIComponent(jeton)}/reponse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mot: mot ? texte : undefined, choix: choix.filter((_, i) => garde[i]), lecture: joindre ? mesure() : undefined, invite: invite ?? undefined }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string; deja?: boolean };
      if (r.ok || d.deja) {
        setEnvoye(true);
        onRepondu?.();
        setOuvert(false);
        setToast(true);
        return;
      }
      setErreur(d.error ?? t.reponseEchec);
    } catch {
      setErreur(t.connexionImpossible);
    } finally {
      setEnvoi(false);
    }
  };

  const nbGardes = garde.filter(Boolean).length;

  return (
    <>
      <button
        type="button"
        className={styles.engagement}
        data-envoye={envoye ? "oui" : "non"}
        disabled={envoye || releve}
        onClick={ouvrir}
      >
        {envoye ? t.reponseEnvoyee : intitule}
      </button>

      {toast && (
        <div className={styles.engagementToast} role="status">
          {t.merci}
        </div>
      )}

      {ouvert && (
        <div className={styles.confVoile} onClick={(e) => e.target === e.currentTarget && !envoi && setOuvert(false)}>
          <div className={styles.engagementBoite} role="dialog" aria-modal="true" aria-labelledby="engagement-titre">
            <button type="button" className={styles.confFermer} aria-label={t.fermer} onClick={() => setOuvert(false)} disabled={envoi}>
              ✕
            </button>
            <h2 id="engagement-titre" className={styles.engagementTitre}>
              {intitule}
            </h2>

            {choix.length > 0 && (
              <fieldset className={styles.engagementChoix}>
                <legend>{t.vosChoix}</legend>
                <p className={styles.engagementAide}>{t.decochez}</p>
                {choix.map((c, i) => (
                  <label key={i} className={styles.engagementLigne}>
                    <input
                      type="checkbox"
                      checked={garde[i] ?? false}
                      onChange={(e) => setGarde((g) => g.map((v, j) => (j === i ? e.target.checked : v)))}
                    />
                    <span>{ligneChoix(c)}</span>
                  </label>
                ))}
              </fieldset>
            )}

            {mot && (
              <label className={styles.engagementMot}>
                <span>{t.unMot}</span>
                <textarea value={texte} maxLength={MOT_MAX} rows={4} onChange={(e) => setTexte(e.target.value)} />
                <small>
                  {texte.length} / {MOT_MAX}
                </small>
              </label>
            )}

            <label className={styles.engagementLecture}>
              <input type="checkbox" checked={joindre} onChange={(e) => setJoindre(e.target.checked)} />
              <span>
                <b>{t.joindreTitre}</b>
                {t.joindreTexte}
              </span>
            </label>

            <p className={styles.engagementMention}>{t.mention(destinataire, nbGardes > 0, joindre)}</p>
            {erreur && (
              <p className={styles.engagementErreur} role="alert">
                {erreur}
              </p>
            )}
            <div className={styles.engagementActions}>
              <button type="button" className={styles.widgetNon} onClick={() => setOuvert(false)} disabled={envoi}>
                {t.annuler}
              </button>
              <button type="button" className={styles.widgetOui} onClick={envoyer} disabled={envoi}>
                {envoi ? t.envoi : t.envoyer}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
