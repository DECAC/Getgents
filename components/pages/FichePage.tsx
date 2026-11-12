"use client";

import { useCallback, useEffect, useState } from "react";
import { initiales, libelleFormat } from "@/lib/pagesGetsite";
import type { FormatArtefact } from "@/lib/mcpPartage";
import { QUESTIONS_MAX_PAR_LIEN } from "@/lib/assistantDocument";
import styles from "./pages.module.css";

interface Destinataire {
  jeton: string;
  destinataire: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  questions: number;
}
interface Detail {
  id: string;
  titre: string;
  format: FormatArtefact;
  origine: string | null;
  assistant: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  destinataires: Destinataire[];
  versions: { version: number; titre: string; createdAt: string }[];
  questions: number;
}

const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const jourHeure = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const actif = (d: Destinataire) => !d.revokedAt && !(d.expiresAt && Date.parse(d.expiresAt) < Date.now());

/**
 * La fiche d'une page : l'aperçu RÉEL à gauche (même cadre isolé que chez le
 * client), et à droite ses destinataires, son assistant, ses versions.
 */
export function FichePage({ id }: { id: string }) {
  const [page, setPage] = useState<Detail | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [partage, setPartage] = useState<{ ouvert: boolean; destinataire: string; resultat: { lien: string; objet: string; corps: string } | null }>({
    ouvert: false,
    destinataire: "",
    resultat: null,
  });

  const charger = useCallback(async () => {
    const r = await fetch(`/api/pages/${encodeURIComponent(id)}`, { credentials: "include" });
    if (r.status === 404) {
      setErreur("Cette page n'existe pas, ou elle a été supprimée.");
      return;
    }
    if (!r.ok) {
      setErreur("La page n'a pas pu être chargée. Rechargez.");
      return;
    }
    setPage(((await r.json()) as { page: Detail }).page);
  }, [id]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const signaler = (m: string) => {
    setMessage(m);
    window.setTimeout(() => setMessage(null), 2500);
  };

  async function appel(cle: string, url: string, init: RequestInit, reussite: string) {
    setEnCours(cle);
    try {
      const r = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "L'opération a échoué. Réessayez.");
      await charger();
      signaler(reussite);
      return j;
    } catch (e) {
      signaler((e as Error).message);
      return null;
    } finally {
      setEnCours(null);
    }
  }

  const copier = (texte: string, quoi: string) =>
    void navigator.clipboard?.writeText(texte).then(
      () => signaler(`${quoi} copié.`),
      () => signaler("La copie a échoué : sélectionnez le texte à la main.")
    );

  if (erreur)
    return (
      <div className={styles.wrap}>
        <a href="/pages" className={styles.retour}>
          ← Mes pages
        </a>
        <p className={styles.erreur}>{erreur}</p>
      </div>
    );
  if (!page) return <p className={styles.sous}>Chargement…</p>;

  const actifs = page.destinataires.filter(actif);
  const dernierActif = [...actifs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const base = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <div className={styles.fiche}>
      <a href="/pages" className={styles.retour}>
        ← Mes pages
      </a>
      <div className={styles.entete}>
        <div className={styles.enteteTexte}>
          <h1 className={styles.titreFiche}>{page.titre}</h1>
          <div className={styles.meta}>
            {[page.origine ? `Créée dans ${page.origine}` : null, libelleFormat(page.format), `version ${page.version}, mise à jour le ${jourHeure(page.updatedAt)}`]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        {dernierActif && (
          <a href={`/partage/${dernierActif.jeton}`} target="_blank" rel="noopener noreferrer" className={styles.secondaire}>
            Voir comme le client
          </a>
        )}
      </div>

      {message && (
        <div className={styles.message} role="status">
          {message}
        </div>
      )}

      <div className={styles.deux}>
        <section className={styles.apercu} aria-label="Aperçu de la page">
          <div className={styles.apercuBarre}>
            <span>Aperçu — la page telle que la voient vos destinataires</span>
            <a href={`/api/pages/${encodeURIComponent(page.id)}/apercu?v=${page.version}`} target="_blank" rel="noopener noreferrer">
              Plein écran ⤢
            </a>
          </div>
          <iframe
            key={page.version}
            className={styles.apercuCadre}
            src={`/api/pages/${encodeURIComponent(page.id)}/apercu?v=${page.version}`}
            title={`Aperçu — ${page.titre}`}
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals"
            referrerPolicy="no-referrer"
          />
        </section>

        <div className={styles.cote}>
          <section className={styles.bloc}>
            <h2 className={styles.blocTitre}>
              Destinataires · {actifs.length} actif{actifs.length > 1 ? "s" : ""}
              {!partage.ouvert && (
                <button type="button" className={styles.secondairePetit} onClick={() => setPartage({ ouvert: true, destinataire: "", resultat: null })}>
                  + Partager à…
                </button>
              )}
            </h2>

            {partage.ouvert && (
              <div className={styles.partager}>
                {!partage.resultat ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const r = (await appel(
                        "partager",
                        `/api/pages/${encodeURIComponent(page.id)}/partages`,
                        { method: "POST", body: JSON.stringify({ destinataire: partage.destinataire }) },
                        "Lien créé."
                      )) as { lien: string; objet: string; corps: string } | null;
                      if (r) setPartage((p) => ({ ...p, resultat: r }));
                    }}
                  >
                    <label className={styles.champLibelle} htmlFor="destinataire">
                      Adresse e-mail ou nom du destinataire
                    </label>
                    <div className={styles.ligne}>
                      <input
                        id="destinataire"
                        className={styles.champ}
                        value={partage.destinataire}
                        onChange={(e) => setPartage((p) => ({ ...p, destinataire: e.target.value }))}
                        placeholder="marie@exemple.fr"
                        maxLength={200}
                        autoFocus
                      />
                      <button type="submit" className={styles.principal} disabled={!partage.destinataire.trim() || enCours === "partager"}>
                        Créer le lien
                      </button>
                      <button type="button" className={styles.lienTexte} onClick={() => setPartage({ ouvert: false, destinataire: "", resultat: null })}>
                        Annuler
                      </button>
                    </div>
                  </form>
                ) : (
                  <div>
                    <p className={styles.aide}>Lien privé créé pour {partage.destinataire}. Getgents n&apos;envoie rien : envoyez-le vous-même.</p>
                    <div className={styles.ligne}>
                      <code className={styles.lienCode}>{partage.resultat.lien}</code>
                      <button type="button" className={styles.secondairePetit} onClick={() => copier(partage.resultat!.lien, "Lien")}>
                        Copier le lien
                      </button>
                      <button
                        type="button"
                        className={styles.secondairePetit}
                        onClick={() => copier(`${partage.resultat!.objet}\n\n${partage.resultat!.corps}`, "Mail")}
                      >
                        Copier le mail
                      </button>
                    </div>
                    <button type="button" className={styles.lienTexte} onClick={() => setPartage({ ouvert: false, destinataire: "", resultat: null })}>
                      Fermer
                    </button>
                  </div>
                )}
              </div>
            )}

            {page.destinataires.length === 0 && <p className={styles.aide}>Aucun destinataire pour l&apos;instant.</p>}
            <ul className={styles.destinataires}>
              {[...page.destinataires]
                .sort((a, b) => Number(actif(b)) - Number(actif(a)) || b.createdAt.localeCompare(a.createdAt))
                .map((d) => {
                  const ok = actif(d);
                  return (
                    <li key={d.jeton} className={ok ? styles.destinataire : `${styles.destinataire} ${styles.eteint}`}>
                      <span className={styles.avatar} aria-hidden="true">
                        {initiales(d.destinataire)}
                      </span>
                      <span className={styles.destTexte}>
                        <b>{d.destinataire}</b>
                        <span>
                          {d.revokedAt
                            ? `Révoqué le ${jour(d.revokedAt)}`
                            : !ok
                              ? `Expiré le ${jour(d.expiresAt!)}`
                              : `Envoyé le ${jour(d.createdAt)}${d.expiresAt ? ` · expire le ${jour(d.expiresAt)}` : ""}`}
                          {d.questions > 0 ? ` · ${d.questions} question${d.questions > 1 ? "s" : ""}` : ""}
                        </span>
                      </span>
                      {ok && (
                        <span className={styles.destActions}>
                          <button type="button" className={styles.lienTexte} onClick={() => copier(`${base}/partage/${d.jeton}`, "Lien")}>
                            Copier le lien
                          </button>
                          <button
                            type="button"
                            className={styles.lienDanger}
                            disabled={enCours === d.jeton}
                            onClick={() => {
                              if (window.confirm(`Révoquer le lien envoyé à ${d.destinataire} ? Il ne s'ouvrira plus.`))
                                void appel(d.jeton, `/api/partages/${encodeURIComponent(d.jeton)}`, { method: "DELETE" }, "Lien révoqué.");
                            }}
                          >
                            Révoquer
                          </button>
                        </span>
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>

          <section className={styles.bloc}>
            <h2 className={styles.blocTitre}>Assistant IA</h2>
            <label className={styles.interrupteur}>
              <span>
                <b>{page.assistant ? "Activé pour tous les destinataires" : "Désactivé"}</b>
                Vos destinataires peuvent poser des questions sur la page. Réponses facturées à votre compte, {QUESTIONS_MAX_PAR_LIEN} questions au
                plus par lien{page.questions ? ` · ${page.questions} posée${page.questions > 1 ? "s" : ""} jusqu'ici` : ""}.
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={page.assistant}
                disabled={enCours === "assistant"}
                onChange={() =>
                  void appel(
                    "assistant",
                    `/api/pages/${encodeURIComponent(page.id)}`,
                    { method: "PATCH", body: JSON.stringify({ assistant: !page.assistant }) },
                    page.assistant ? "Assistant désactivé." : "Assistant activé."
                  )
                }
              />
            </label>
          </section>

          <section className={styles.bloc}>
            <h2 className={styles.blocTitre}>Versions</h2>
            <div className={styles.version}>
              <span>
                <b>Version {page.version}</b> · {jourHeure(page.updatedAt)} · actuelle
              </span>
            </div>
            {page.versions.map((v) => (
              <div key={v.version} className={styles.version}>
                <span>
                  Version {v.version} · {jourHeure(v.createdAt)}
                </span>
                <button
                  type="button"
                  className={styles.lienTexte}
                  disabled={enCours === `v${v.version}`}
                  onClick={() => {
                    if (window.confirm(`Restaurer la version ${v.version} ? Tous les liens l'afficheront ; la version actuelle reste restaurable.`))
                      void appel(
                        `v${v.version}`,
                        `/api/pages/${encodeURIComponent(page.id)}/restaurer`,
                        { method: "POST", body: JSON.stringify({ version: v.version }) },
                        `Version ${v.version} restaurée.`
                      );
                  }}
                >
                  Restaurer
                </button>
              </div>
            ))}
            {page.versions.length === 0 && <p className={styles.aide}>Une seule version. Une correction faite depuis Claude en créera une nouvelle.</p>}
          </section>

          <section className={styles.bloc}>
            <button
              type="button"
              className={styles.lienDanger}
              onClick={async () => {
                if (!window.confirm(`Supprimer « ${page.titre} » ? Ses ${actifs.length} lien(s) actif(s) cesseront de s'ouvrir. C'est irréversible.`)) return;
                const r = await fetch(`/api/pages/${encodeURIComponent(page.id)}`, { method: "DELETE", credentials: "include" });
                if (r.ok) window.location.assign("/pages");
                else signaler("La suppression a échoué. Réessayez.");
              }}
            >
              Supprimer la page et couper tous ses liens
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
