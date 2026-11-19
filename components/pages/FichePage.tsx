"use client";

import { useCallback, useEffect, useState } from "react";
import { initiales, libelleFormat } from "@/lib/pagesGetsite";
import { CadreApercu } from "./CadreApercu";
import type { FormatArtefact } from "@/lib/mcpPartage";
import { QUESTIONS_MAX_PAR_LIEN } from "@/lib/assistantDocument";
import { peutRecevoirCode } from "@/lib/accesCode";
import { ActivitePage } from "./ActivitePage";
import { ImportPage } from "./ImportPage";
import { libelleOrigine } from "@/lib/importPage";
import { exempleDeOrigine } from "@/lib/exemplesPages";
import { GuideDecouverte } from "./GuideDecouverte";
import { BlocEngagement } from "./BlocEngagement";
import { ReponsesPage } from "./ReponsesPage";
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
  protection: boolean;
  protectionIllisible: boolean;
  /** Jeton → date de validation du code. */
  valides: Record<string, string>;
  /** Seule page du compte : le guide de découverte s'affiche. */
  premiere?: boolean;
  /** Adresse confirmée de l'auteur, pour s'envoyer le lien (guide). */
  moi?: string | null;
}

const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const jourHeure = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const actif = (d: Destinataire) => !d.revokedAt && !(d.expiresAt && Date.parse(d.expiresAt) < Date.now());

/**
 * La fiche d'une page, en quatre onglets (19/11, choix de l'éditeur) :
 * Page (aperçu RÉEL — même cadre isolé que chez le client —, bouton
 * d'engagement, versions), Destinataires (liens, accès protégé par code),
 * Activité (réponses au bouton, lectures) et Assistant.
 */
export function FichePage({ id }: { id: string }) {
  const [page, setPage] = useState<Detail | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<"page" | "destinataires" | "activite" | "assistant">("page");
  const [sansReponse, setSansReponse] = useState(0);
  const [reponsesNouvelles, setReponsesNouvelles] = useState(0);
  // Guide de découverte : chiffres de l'activité, et relecture quand on revient sur l'onglet
  // (après avoir ouvert le lien en navigation privée, la fiche doit le savoir).
  const [etatActivite, setEtatActivite] = useState<{ ouvertures: number; questions: number; precisions: number } | null>(null);
  const [tic, setTic] = useState(0);
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

  useEffect(() => {
    const revenir = () => {
      if (document.visibilityState !== "visible") return;
      void charger();
      setTic((t) => t + 1);
    };
    window.addEventListener("focus", revenir);
    document.addEventListener("visibilitychange", revenir);
    return () => {
      window.removeEventListener("focus", revenir);
      document.removeEventListener("visibilitychange", revenir);
    };
  }, [charger]);

  const [nouvelleVersion, setNouvelleVersion] = useState(false);
  // Arrivée depuis « Nouvelle page » avec un code déjà connu : on le dit, sans créer de doublon.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("existante") !== "1") return;
    setMessage("Ce code correspond à une page existante : la voici.");
    window.history.replaceState(null, "", window.location.pathname);
    const t = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(t);
  }, []);

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
  const exemple = exempleDeOrigine(page.origine);

  return (
    <div className={styles.fiche}>
      <a href="/pages" className={styles.retour}>
        ← Mes pages
      </a>
      <div className={styles.entete}>
        <div className={styles.enteteTexte}>
          <h1 className={styles.titreFiche}>
            {page.titre}
            {exemple && <span className={styles.badgeExemple}>Exemple</span>}
          </h1>
          <div className={styles.meta}>
            {[libelleOrigine(page.origine), libelleFormat(page.format), `version ${page.version}, mise à jour le ${jourHeure(page.updatedAt)}`]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        {dernierActif && (
          <a href={`/partage/${dernierActif.jeton}`} target="_blank" rel="noopener noreferrer" className={styles.secondaire}>
            Voir comme le client
          </a>
        )}
        <button type="button" className={styles.secondaire} onClick={() => setNouvelleVersion(true)}>
          Nouvelle version
        </button>
      </div>
      {nouvelleVersion && (
        <ImportPage
          page={{ id: page.id, titre: page.titre, format: page.format }}
          onFermer={() => setNouvelleVersion(false)}
          onPubliee={(m) => {
            signaler(m);
            void charger();
          }}
        />
      )}

      {message && (
        <div className={styles.message} role="status">
          {message}
        </div>
      )}

      <div className={styles.onglets} role="tablist">
        <button type="button" role="tab" aria-selected={onglet === "page"} className={styles.onglet} onClick={() => setOnglet("page")}>
          Page
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={onglet === "destinataires"}
          className={styles.onglet}
          onClick={() => setOnglet("destinataires")}
        >
          Destinataires
          {actifs.length > 0 && <span className={styles.ongletCompte}>{actifs.length}</span>}
        </button>
        <button type="button" role="tab" aria-selected={onglet === "activite"} className={styles.onglet} onClick={() => setOnglet("activite")}>
          Activité
          {reponsesNouvelles > 0 && (
            <span className={styles.ongletPastille} title={`${reponsesNouvelles} réponse${reponsesNouvelles > 1 ? "s" : ""} nouvelle${reponsesNouvelles > 1 ? "s" : ""}`}>
              {reponsesNouvelles}
            </span>
          )}
        </button>
        <button type="button" role="tab" aria-selected={onglet === "assistant"} className={styles.onglet} onClick={() => setOnglet("assistant")}>
          Assistant
          {page.assistant && sansReponse > 0 && (
            <span className={styles.ongletPastille} title={`${sansReponse} question${sansReponse > 1 ? "s" : ""} sans réponse`}>
              {sansReponse}
            </span>
          )}
        </button>
      </div>

      {/* Monté dès l'ouverture de la fiche (masqué sur « Page ») : la pastille de l'onglet Assistant
          doit être juste avant même qu'on l'ouvre, et changer d'onglet ne recharge rien. */}
      <div hidden={onglet === "page" || onglet === "destinataires"} className={styles.ongletCorps}>
        <div hidden={onglet !== "activite"}>
          <ReponsesPage pageId={page.id} visible={onglet === "activite"} actualiser={tic} onNouvelles={setReponsesNouvelles} />
        </div>
        <ActivitePage
          id={page.id}
          vue={onglet === "assistant" ? "assistant" : "activite"}
          assistantActif={page.assistant}
          onMessage={signaler}
          onSansReponse={setSansReponse}
          onEtat={setEtatActivite}
          actualiser={tic}
          onVoirAssistant={() => setOnglet("assistant")}
          interrupteur={
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
              }
        />
      </div>
      {onglet === "page" && (exemple || page.premiere) && etatActivite && (
        <GuideDecouverte
          pageId={page.id}
          etat={{
            liens: page.destinataires.length,
            ouvertures: etatActivite.ouvertures,
            questions: etatActivite.questions,
            precisions: etatActivite.precisions,
            assistant: page.assistant,
            exemple: !!exemple,
            questionPiege: exemple?.questionPiege ?? null,
            questionArrivee: etatActivite.questions > 0,
          }}
          moi={page.moi ?? null}
          lienCree={dernierActif ? `${base}/partage/${dernierActif.jeton}` : null}
          enCours={enCours === "partager"}
          onCreerLien={(destinataire) =>
            void appel(
              "partager",
              `/api/pages/${encodeURIComponent(page.id)}/partages`,
              { method: "POST", body: JSON.stringify({ destinataire }) },
              "Lien créé : ouvrez-le en navigation privée."
            )
          }
          onCopierLien={(lien) => copier(lien, "Lien")}
          onVoirAssistant={() => setOnglet("assistant")}
        />
      )}
      {onglet === "page" && (
      <div className={styles.deux}>
        <section className={styles.apercu} aria-label="Aperçu de la page">
          <div className={styles.apercuBarre}>
            <span>Aperçu — la page telle que la voient vos destinataires</span>
            <a href={`/pages/${encodeURIComponent(page.id)}/plein-ecran?v=${page.version}`} target="_blank" rel="noopener noreferrer">
              Plein écran ⤢
            </a>
          </div>
          <CadreApercu
            key={page.version}
            className={styles.apercuCadre}
            src={`/api/pages/${encodeURIComponent(page.id)}/apercu?v=${page.version}`}
            titre={`Aperçu — ${page.titre}`}
          />
        </section>

        <div className={styles.cote}>
          <BlocEngagement pageId={page.id} onMessage={signaler} />

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
      )}
      {onglet === "destinataires" && (
        <div className={styles.colonneOnglet}>
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
                  const bloque = ok && page.protection && !peutRecevoirCode(d.destinataire);
                  const valide = page.valides[d.jeton];
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
                          {bloque && <span className={styles.alerte}> · Sans adresse e-mail : bloqué par la protection</span>}
                          {ok && page.protection && !bloque && (
                            <span className={valide ? styles.ok : undefined}>{valide ? ` · ✓ code validé le ${jour(valide)}` : " · code pas encore validé"}</span>
                          )}
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
            <h2 className={styles.blocTitre}>Accès protégé par code</h2>
            <label className={styles.interrupteur}>
              <span>
                <b>{page.protection ? "Activé" : "Désactivé"}</b>
                Chaque destinataire reçoit un code par e-mail, à l&apos;adresse du lien, pour ouvrir la page. Un lien transféré ne s&apos;ouvre plus.
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={page.protection}
                disabled={enCours === "protection"}
                onChange={() =>
                  void appel(
                    "protection",
                    `/api/pages/${encodeURIComponent(page.id)}`,
                    { method: "PATCH", body: JSON.stringify({ protection: !page.protection }) },
                    page.protection ? "Protection coupée." : "Protection activée."
                  )
                }
              />
            </label>
            {page.protectionIllisible && <p className={styles.alerteBloc}>L&apos;état de la protection n&apos;a pas pu être lu. Rechargez la page.</p>}
            {page.protection &&
              actifs
                .filter((d) => !peutRecevoirCode(d.destinataire))
                .map((d) => (
                  <p key={d.jeton} className={styles.alerteBloc}>
                    « {d.destinataire} » n&apos;a pas d&apos;adresse e-mail : son lien ne s&apos;ouvre plus. Partagez la page à son adresse avec « + Partager
                    à… ».
                  </p>
                ))}
          </section>
        </div>
      )}
    </div>
  );
}
