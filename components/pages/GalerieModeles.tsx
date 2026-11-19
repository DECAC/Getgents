"use client";

import { useEffect, useMemo, useState } from "react";
import { EXEMPLES, exemplesDuPublic, modelesEssayes, PUBLICS, type ExemplePage, type Public } from "@/lib/exemplesPages";
import type { LignePage } from "@/lib/pagesGetsite";
import { PictoPublic } from "./PictoPublic";
import { AdapterExemple } from "./AdapterExemple";
import { ImportPage } from "./ImportPage";
import { useCreerModele } from "./useCreerModele";
import styles from "./pages.module.css";

/**
 * Rubrique « Modèles » (19/11, maquette validée) : les pages fictives,
 * toujours accessibles — l'accueil ne les montre qu'à un compte vide. Un
 * modèle déjà essayé s'ouvre (et s'adapte) au lieu d'être recréé.
 */
export function GalerieModeles() {
  const [filtre, setFiltre] = useState<Public | "tous">("tous");
  const [pages, setPages] = useState<LignePage[]>([]);
  const [adapter, setAdapter] = useState<ExemplePage | null>(null);
  const [importer, setImporter] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { enCours, erreur, creer } = useCreerModele();

  useEffect(() => {
    let vivant = true;
    fetch("/api/pages", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { pages: [] }))
      .then((d: { pages?: LignePage[] }) => vivant && setPages(d.pages ?? []))
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, []);

  const essayes = useMemo(() => modelesEssayes(pages), [pages]);
  const montres = filtre === "tous" ? EXEMPLES : exemplesDuPublic(filtre);
  const signaler = (m: string) => {
    setMessage(m);
    window.setTimeout(() => setMessage(null), 2500);
  };

  return (
    <div className={styles.wrap}>
      <h1 className={styles.titre}>Modèles</h1>
      <p className={styles.sous}>
        Des pages fictives, prêtes à essayer : envoyez-vous le lien, ouvrez-le comme un lecteur, posez une question à l&apos;assistant. Puis adaptez celle qui
        vous ressemble avec votre IA — elle devient votre page.
      </p>
      {message && (
        <div className={styles.message} role="status">
          {message}
        </div>
      )}

      <div className={styles.modelesFiltres} role="group" aria-label="Filtrer par public">
        <button type="button" className={styles.modeleFiltre} aria-pressed={filtre === "tous"} onClick={() => setFiltre("tous")}>
          Tous · {EXEMPLES.length}
        </button>
        {PUBLICS.map((p) => (
          <button key={p.id} type="button" className={styles.modeleFiltre} aria-pressed={filtre === p.id} onClick={() => setFiltre(p.id)}>
            <PictoPublic public={p.id} className={styles.modeleFiltrePicto} />
            {p.titre}
          </button>
        ))}
      </div>

      <div className={styles.modeles}>
        {montres.map((ex) => {
          const pageId = essayes.get(ex.id);
          return (
            <div key={ex.id} className={styles.modele} data-exemple={ex.id}>
              <span className={styles.modeleVignette} aria-hidden="true">
                <span className={styles.modelePicto}>
                  <PictoPublic public={ex.public} />
                </span>
              </span>
              <div className={styles.modeleCorps}>
                <h2>{ex.titre}</h2>
                <p>{ex.resume}</p>
                <div className={styles.modeleAtouts}>
                  {ex.atouts.map((a) => (
                    <span key={a}>{a}</span>
                  ))}
                </div>
                <div className={styles.modeleActions}>
                  {pageId ? (
                    <>
                      <span className={styles.modeleDeja}>✓ Dans vos pages</span>
                      <a href={`/pages/${pageId}`} className={styles.secondaire} style={{ textDecoration: "none" }}>
                        Ouvrir
                      </a>
                      <button type="button" className={styles.lienTexteFort} onClick={() => setAdapter(ex)}>
                        Adapter avec mon IA
                      </button>
                    </>
                  ) : (
                    <button type="button" className={styles.principal} disabled={enCours !== null} onClick={() => void creer(ex.id)}>
                      {enCours === ex.id ? "Création…" : "Essayer ce modèle"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {erreur && (
        <p className={styles.erreur} role="alert">
          {erreur}
        </p>
      )}

      <div className={styles.modelesBandeau}>
        <span>
          <b>Vous avez déjà votre page ?</b> Collez le code de votre artefact.
        </span>
        <button type="button" className={styles.secondaire} onClick={() => setImporter(true)}>
          + Nouvelle page
        </button>
      </div>

      {adapter && <AdapterExemple exemple={adapter} onFermer={() => setAdapter(null)} onMessage={signaler} />}
      {importer && <ImportPage onFermer={() => setImporter(false)} />}
    </div>
  );
}
