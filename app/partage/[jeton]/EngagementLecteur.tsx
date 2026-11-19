"use client";

import { useEffect, useState } from "react";
import { choixValides, ligneChoix, mentionReponse, MOT_MAX, type ChoixLecteur, type LectureJointe } from "@/lib/engagement";
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
}: {
  jeton: string;
  intitule: string;
  mot: boolean;
  destinataire: string;
  dejaRepondu: boolean;
  cadre: React.RefObject<HTMLIFrameElement | null>;
  /** La visite en cours, mesurée dans la page (VuePartage). */
  mesure: () => LectureJointe;
}) {
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
        body: JSON.stringify({ mot: mot ? texte : undefined, choix: choix.filter((_, i) => garde[i]), lecture: joindre ? mesure() : undefined }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string; deja?: boolean };
      if (r.ok || d.deja) {
        setEnvoye(true);
        setOuvert(false);
        setToast(true);
        return;
      }
      setErreur(d.error ?? "Votre réponse n'a pas pu être envoyée. Réessayez.");
    } catch {
      setErreur("Connexion impossible. Réessayez.");
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
        {envoye ? "✓ Réponse envoyée à l'auteur" : intitule}
      </button>

      {toast && (
        <div className={styles.engagementToast} role="status">
          Merci, votre réponse a été transmise à l&apos;auteur.
        </div>
      )}

      {ouvert && (
        <div className={styles.confVoile} onClick={(e) => e.target === e.currentTarget && !envoi && setOuvert(false)}>
          <div className={styles.engagementBoite} role="dialog" aria-modal="true" aria-labelledby="engagement-titre">
            <button type="button" className={styles.confFermer} aria-label="Fermer" onClick={() => setOuvert(false)} disabled={envoi}>
              ✕
            </button>
            <h2 id="engagement-titre" className={styles.engagementTitre}>
              {intitule}
            </h2>

            {choix.length > 0 && (
              <fieldset className={styles.engagementChoix}>
                <legend>Vos choix dans la page</legend>
                <p className={styles.engagementAide}>Décochez ce que vous ne souhaitez pas transmettre.</p>
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
                <span>Un mot pour l&apos;auteur (facultatif)</span>
                <textarea value={texte} maxLength={MOT_MAX} rows={4} onChange={(e) => setTexte(e.target.value)} />
                <small>
                  {texte.length} / {MOT_MAX}
                </small>
              </label>
            )}

            <label className={styles.engagementLecture}>
              <input type="checkbox" checked={joindre} onChange={(e) => setJoindre(e.target.checked)} />
              <span>
                <b>Joindre ma lecture de la page</b>
                Quand je l&apos;ai ouverte, combien de temps, jusqu&apos;où, sur quel appareil. Pour ce lien seulement.
              </span>
            </label>

            <p className={styles.engagementMention}>{mentionReponse(destinataire, nbGardes > 0, joindre)}</p>
            {erreur && (
              <p className={styles.engagementErreur} role="alert">
                {erreur}
              </p>
            )}
            <div className={styles.engagementActions}>
              <button type="button" className={styles.widgetNon} onClick={() => setOuvert(false)} disabled={envoi}>
                Annuler
              </button>
              <button type="button" className={styles.widgetOui} onClick={envoyer} disabled={envoi}>
                {envoi ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
