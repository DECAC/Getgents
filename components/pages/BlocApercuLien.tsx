"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./pages.module.css";

interface Etat {
  actif: boolean;
  version: number | null;
  captureLe: string | null;
  versionPage: number;
  protegee: boolean;
}

/**
 * « Aperçu du lien » (onglet Page) : montrer la page ELLE-MÊME dans la vignette
 * de WhatsApp, LinkedIn, Slack… Option coupée par défaut. L'auteur fait la
 * capture, VOIT l'image exacte, puis active. Une nouvelle version de la page
 * suspend l'aperçu jusqu'à la capture suivante (refaite ici à l'ouverture de
 * la fiche, ou par la tâche horaire).
 */
export function BlocApercuLien({ pageId, version, protegee, onMessage }: { pageId: string; version: number; protegee: boolean; onMessage: (m: string) => void }) {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [indisponible, setIndisponible] = useState(false);
  const [capture, setCapture] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const relance = useRef<number | null>(null);
  const url = `/api/pages/${encodeURIComponent(pageId)}/apercu-lien`;

  useEffect(() => {
    let vivant = true;
    fetch(url, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: Etat) => vivant && setEtat(d))
      .catch(() => vivant && setIndisponible(true));
    return () => {
      vivant = false;
    };
  }, [url, version, protegee]);

  const capturer = useCallback(async () => {
    setCapture(true);
    setErreur(null);
    try {
      const r = await fetch(url, { method: "POST", credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "La capture a échoué.");
      setEtat(d as Etat);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setCapture(false);
    }
  }, [url]);

  // Option active mais page changée : la capture est refaite d'elle-même, une fois par version.
  useEffect(() => {
    if (!etat || !etat.actif || etat.protegee || etat.version === etat.versionPage || capture) return;
    if (relance.current === etat.versionPage) return;
    relance.current = etat.versionPage;
    void capturer();
  }, [etat, capture, capturer]);

  const basculer = async (actif: boolean) => {
    setEnCours(true);
    try {
      const r = await fetch(url, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actif }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Le réglage n'a pas pu être enregistré.");
      setEtat(d as Etat);
      onMessage(actif ? "Aperçu activé : les prochains partages du lien montreront la page." : "Aperçu coupé : la vignette habituelle revient.");
    } catch (e) {
      onMessage((e as Error).message);
    } finally {
      setEnCours(false);
    }
  };

  if (indisponible) return null;
  const aJour = !!etat && etat.version === etat.versionPage;
  const image = etat?.version != null ? `${url}/image?v=${etat.version}&t=${encodeURIComponent(etat.captureLe ?? "")}` : null;

  return (
    <section className={styles.bloc}>
      <h2 className={styles.blocTitre}>Aperçu du lien</h2>
      {!etat ? (
        <p className={styles.aide}>Chargement…</p>
      ) : etat.protegee ? (
        <p className={styles.aide}>
          Indisponible sur une page protégée par code : l&apos;aperçu montrerait ce que le code protège. Le lien garde sa vignette habituelle (le titre seul).
        </p>
      ) : (
        <>
          <p className={styles.aide}>
            Montrer la page elle-même dans la vignette de WhatsApp, LinkedIn, Slack… au lieu du seul titre. <b>Tout le monde à qui le lien est montré voit
            cette image</b> (un groupe entier), et le service la garde en mémoire : révoquer le lien ne la retire pas d&apos;un message déjà envoyé.
          </p>
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="Vignette telle que la verront vos destinataires" className={styles.apercuLienImage} width={1200} height={630} />
          )}
          {etat.version != null && !aJour && !capture && (
            <p className={styles.alerteBloc}>Cette capture vient d&apos;une version précédente : elle n&apos;est pas montrée tant qu&apos;elle n&apos;est pas refaite.</p>
          )}
          {erreur && <p className={styles.alerteBloc}>{erreur}</p>}
          <div className={styles.apercuLienActions}>
            <button type="button" className={styles.secondairePetit} disabled={capture} onClick={() => void capturer()}>
              {capture ? "Capture en cours… (10 s environ)" : etat.version == null ? "Voir l'aperçu" : "Refaire la capture"}
            </button>
          </div>
          {etat.version != null && (
            <label className={styles.interrupteur}>
              <span>
                <b>{etat.actif ? "Activé" : "Désactivé"}</b>
                Montrer cette image dans l&apos;aperçu des liens de cette page. Seuls les liens partagés APRÈS l&apos;activation la montrent : WhatsApp garde
                en mémoire l&apos;aperçu d&apos;un lien déjà envoyé.
              </span>
              <input type="checkbox" role="switch" checked={etat.actif} disabled={enCours || capture || (!etat.actif && !aJour)} onChange={() => void basculer(!etat.actif)} />
            </label>
          )}
        </>
      )}
    </section>
  );
}
