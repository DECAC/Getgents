"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GuideConnexion } from "./GuideConnexion";
import { Vignette } from "./Vignette";
import { filtrerParTitre, filtrePage, libelleFormat, type FiltrePages, type LignePage } from "@/lib/pagesGetsite";
import styles from "./pages.module.css";

const date = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

/** « Mes pages » : une carte par PAGE, quel que soit le nombre de destinataires. */
export function ListePages() {
  const guide = useSearchParams().get("guide") === "1";
  const [pages, setPages] = useState<LignePage[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<FiltrePages>("actives");

  useEffect(() => {
    let vivant = true;
    fetch("/api/pages", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { pages: LignePage[] }) => vivant && setPages(d.pages))
      .catch(() => vivant && setErreur("Vos pages n'ont pas pu être chargées. Rechargez la page."));
    return () => {
      vivant = false;
    };
  }, []);

  const visibles = useMemo(() => filtrerParTitre((pages ?? []).filter((p) => filtrePage(p, filtre)), recherche), [pages, filtre, recherche]);

  if (guide) return <GuideConnexion titre="Connecter Claude à Getgents" />;

  return (
    <div className={styles.wrap}>
      <div>
        <h1 className={styles.titre}>Mes pages</h1>
        <p className={styles.sous}>
          Les pages créées dans Claude et partagées avec vos clients. Ouvrez-en une pour voir à qui vous l&apos;avez envoyée.
        </p>
      </div>

      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {!pages && !erreur && <p className={styles.sous}>Chargement…</p>}
      {pages && pages.length === 0 && <GuideConnexion />}

      {pages && pages.length > 0 && (
        <>
          <div className={styles.barre}>
            <input
              className={styles.recherche}
              type="search"
              placeholder="Rechercher une page…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              aria-label="Rechercher une page"
            />
            <div className={styles.filtres} role="tablist" aria-label="Filtrer les pages">
              {(["actives", "expirees", "toutes"] as const).map((f) => (
                <button key={f} type="button" role="tab" aria-selected={filtre === f} className={filtre === f ? styles.filtreOn : ""} onClick={() => setFiltre(f)}>
                  {f === "actives" ? "Actives" : f === "expirees" ? "Sans lien actif" : "Toutes"}
                </button>
              ))}
            </div>
          </div>

          {visibles.length === 0 && <p className={styles.sous}>Aucune page ne correspond.</p>}
          <div className={styles.grille}>
            {visibles.map((p) => (
              <article key={p.id} className={styles.carte}>
                <a href={`/pages/${p.id}`} className={styles.vignetteLien} aria-label={`Ouvrir ${p.titre}`} tabIndex={-1}>
                  <Vignette id={p.id} titre={p.titre} version={p.version} />
                  <span className={styles.format}>{libelleFormat(p.format)}</span>
                </a>
                <div className={styles.carteCorps}>
                  <a href={`/pages/${p.id}`} className={styles.carteTitre}>
                    {p.titre}
                  </a>
                  <div className={styles.meta}>
                    {[p.origine, p.version > 1 ? `version ${p.version}` : null, `mise à jour le ${date(p.updatedAt)}`].filter(Boolean).join(" · ")}
                  </div>
                  <div className={styles.puces}>
                    <span className={p.actifs ? styles.puceDest : styles.puceEteinte}>
                      {p.actifs ? `${p.actifs} destinataire${p.actifs > 1 ? "s" : ""}` : "Aucun lien actif"}
                    </span>
                    {p.assistant && <span className={styles.puceIa}>✦ Assistant IA</span>}
                  </div>
                  <div className={styles.actions}>
                    <a href={`/pages/${p.id}`} className={styles.principal}>
                      Ouvrir
                    </a>
                    {p.dernierJeton && (
                      <a href={`/partage/${p.dernierJeton}`} target="_blank" rel="noopener noreferrer" className={styles.secondaire}>
                        Voir comme le client
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
