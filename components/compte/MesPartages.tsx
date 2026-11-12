"use client";

import { useEffect, useState } from "react";
import styles from "@/app/compte/compte.module.css";
import type { ResumePartage, StatutPartage } from "@/lib/mcpPartage";

/**
 * « Mes partages » : les artefacts partagés depuis Claude par le connecteur
 * Getgents. Révoquer coupe le lien tout de suite ; on demande confirmation,
 * c'est irréversible et le client le verra.
 */

type Ligne = ResumePartage & { statut: StatutPartage };

const LIBELLE: Record<StatutPartage, string> = { actif: "Actif", revoque: "Révoqué", expire: "Expiré" };

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export default function MesPartages() {
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [tout, setTout] = useState(false);

  useEffect(() => {
    let vivant = true;
    fetch("/api/partages", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { partages: Ligne[] }) => vivant && setLignes(d.partages))
      .catch(() => vivant && setErreur("La liste des partages n'a pas pu être chargée."));
    return () => {
      vivant = false;
    };
  }, []);

  async function revoquer(l: Ligne) {
    if (!window.confirm(`Révoquer le lien « ${l.titre} » envoyé à ${l.destinataire} ? Il ne s'ouvrira plus.`)) return;
    setEnCours(l.jeton);
    setErreur(null);
    try {
      const r = await fetch(`/api/partages/${encodeURIComponent(l.jeton)}`, { method: "DELETE", credentials: "include" });
      if (!r.ok && r.status !== 404) throw new Error();
      setLignes((ls) => ls?.map((x) => (x.jeton === l.jeton ? { ...x, statut: "revoque", revokedAt: new Date().toISOString() } : x)) ?? null);
    } catch {
      setErreur("La révocation a échoué. Réessayez.");
    } finally {
      setEnCours(null);
    }
  }

  const actifs = lignes?.filter((l) => l.statut === "actif") ?? [];
  const visibles = tout ? lignes ?? [] : actifs;

  return (
    <section className={styles.bloc} id="partages">
      <h2 className={styles.sousTitre}>Mes partages</h2>
      <p className={styles.aide}>
        Les artefacts partagés depuis Claude avec le connecteur Getgents. Chaque lien reste valable 30 jours, sauf
        si vous le révoquez.
      </p>

      {!lignes && !erreur && <p className={styles.aide}>Chargement…</p>}
      {lignes && lignes.length === 0 && (
        <p className={styles.aide} style={{ marginBottom: 0 }}>
          Aucun partage pour l&apos;instant. Dans Claude, demandez « partage cet artefact à … ».
        </p>
      )}

      {lignes && lignes.length > 0 && (
        <>
          {visibles.length === 0 && <p className={styles.aide}>Aucun lien actif.</p>}
          <ul className={styles.partages}>
            {visibles.map((l) => (
              <li key={l.jeton} className={styles.partage}>
                <div className={styles.partageTexte}>
                  {l.statut === "actif" ? (
                    <a href={`/partage/${l.jeton}`} target="_blank" rel="noopener noreferrer" className={styles.partageTitre}>
                      {l.titre}
                    </a>
                  ) : (
                    <span className={styles.partageTitre}>{l.titre}</span>
                  )}
                  <span className={styles.partageMeta}>
                    {l.destinataire} · {date(l.createdAt)}
                    {l.statut === "actif" && l.expiresAt ? ` · expire le ${date(l.expiresAt)}` : ""}
                  </span>
                </div>
                {l.statut === "actif" ? (
                  <button type="button" className={styles.secondaire} disabled={enCours === l.jeton} onClick={() => revoquer(l)}>
                    {enCours === l.jeton ? "Révocation…" : "Révoquer"}
                  </button>
                ) : (
                  <span className={styles.partageStatut}>{LIBELLE[l.statut]}</span>
                )}
              </li>
            ))}
          </ul>
          {lignes.length > actifs.length && (
            <button type="button" className={styles.retirer} onClick={() => setTout((t) => !t)}>
              {tout ? "Masquer les liens révoqués et expirés" : `Voir aussi les liens révoqués et expirés (${lignes.length - actifs.length})`}
            </button>
          )}
        </>
      )}
      {erreur && <p className={styles.erreur}>{erreur}</p>}
    </section>
  );
}
