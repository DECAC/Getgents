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
import { BlocLangue, langueDesLecteurs, type LangueLecteurs } from "./BlocLangue";
import { AdapterExemple } from "./AdapterExemple";
import { INVITES_MAX, lienWhatsApp, messageWhatsApp } from "@/lib/groupesPages";
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
  /** Liens de groupe : jeton → invités. */
  groupes?: Record<string, string[]>;
  /** Langue des lecteurs (lot anglais 1). */
  langueLecteurs?: LangueLecteurs;
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
  const [repondus, setRepondus] = useState(0);
  const [activite, setActivite] = useState<import("@/lib/activitePage").Activite | null>(null);
  // Guide de découverte : chiffres de l'activité, et relecture quand on revient sur l'onglet
  // (après avoir ouvert le lien en navigation privée, la fiche doit le savoir).
  const [etatActivite, setEtatActivite] = useState<{ ouvertures: number; questions: number; precisions: number } | null>(null);
  const [tic, setTic] = useState(0);
  const [partage, setPartage] = useState<{
    ouvert: boolean;
    destinataire: string;
    /** Lien de groupe : la liste des invités, un par ligne. Null pour un lien ordinaire. */
    invites: string | null;
    resultat: { lien: string; objet: string; corps: string } | null;
  }>({
    ouvert: false,
    destinataire: "",
    invites: null,
    resultat: null,
  });
  const [editeurInvites, setEditeurInvites] = useState<{ jeton: string; texte: string } | null>(null);

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
  const [adapter, setAdapter] = useState(false);
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
  const boutonsPartage = (
    <>
      <button
        type="submit"
        className={styles.principal}
        disabled={!partage.destinataire.trim() || (partage.invites !== null && !partage.invites.trim()) || enCours === "partager"}
      >
        Créer le lien
      </button>
      <button type="button" className={styles.lienTexte} onClick={() => setPartage({ ouvert: false, destinataire: "", invites: null, resultat: null })}>
        Annuler
      </button>
    </>
  );
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
            {exemple && <span className={styles.badgeExemple}>Modèle</span>}
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
        {exemple ? (
          <button type="button" className={styles.principal} onClick={() => setAdapter(true)}>
            Adapter avec mon IA
          </button>
        ) : (
          <button type="button" className={styles.secondaire} onClick={() => setNouvelleVersion(true)}>
            Nouvelle version
          </button>
        )}
      </div>
      {adapter && exemple && <AdapterExemple exemple={exemple} onFermer={() => setAdapter(false)} onMessage={signaler} />}
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
          <ReponsesPage
            pageId={page.id}
            visible={onglet === "activite"}
            actualiser={tic}
            onNouvelles={setReponsesNouvelles}
            onTotal={setRepondus}
            titre={page.titre}
            langue={langueDesLecteurs(page.langueLecteurs)}
            base={base}
            liens={actifs.map((d) => ({ jeton: d.jeton, destinataire: d.destinataire }))}
            groupes={page.groupes ?? {}}
            activite={activite}
            onVoirAssistant={() => setOnglet("assistant")}
          />
        </div>
        <ActivitePage
          id={page.id}
          vue={onglet === "assistant" ? "assistant" : "activite"}
          assistantActif={page.assistant}
          onMessage={signaler}
          onSansReponse={setSansReponse}
          onEtat={setEtatActivite}
          actualiser={tic}
          repondus={repondus}
          onActivite={setActivite}
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
          {page.langueLecteurs && (
            <BlocLangue
              pageId={page.id}
              valeur={page.langueLecteurs}
              onChange={(v) => setPage((p) => (p ? { ...p, langueLecteurs: v } : p))}
              onMessage={signaler}
            />
          )}
          <BlocEngagement pageId={page.id} onMessage={signaler} langue={langueDesLecteurs(page.langueLecteurs)} />

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
                <span className={styles.blocTitreActions}>
                <button type="button" className={styles.secondairePetit} onClick={() => setPartage({ ouvert: true, destinataire: "", invites: null, resultat: null })}>
                  + Partager à…
                </button>
                <button
                  type="button"
                  className={styles.secondairePetit}
                  onClick={() => setPartage({ ouvert: true, destinataire: "", invites: "", resultat: null })}
                  title="Un seul lien à poster dans un groupe WhatsApp"
                >
                  + Lien de groupe
                </button>
                </span>
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
                        {
                          method: "POST",
                          body: JSON.stringify(
                            partage.invites === null ? { destinataire: partage.destinataire } : { destinataire: partage.destinataire, invites: partage.invites }
                          ),
                        },
                        partage.invites === null ? "Lien créé." : "Lien de groupe créé."
                      )) as { lien: string; objet: string; corps: string } | null;
                      if (r) setPartage((p) => ({ ...p, resultat: r }));
                    }}
                  >
                    <label className={styles.champLibelle} htmlFor="destinataire">
                      {partage.invites === null ? "Adresse e-mail ou nom du destinataire" : "Nom du groupe"}
                    </label>
                    {partage.invites !== null && (
                      <p className={styles.aide}>Un seul lien à poster dans un groupe WhatsApp : chaque invité choisit son prénom en ouvrant la page, et répond une fois.</p>
                    )}
                    <div className={styles.ligne}>
                      <input
                        id="destinataire"
                        className={styles.champ}
                        value={partage.destinataire}
                        onChange={(e) => setPartage((p) => ({ ...p, destinataire: e.target.value }))}
                        placeholder={partage.invites === null ? "marie@exemple.fr" : "Les copains de Bercheres"}
                        maxLength={200}
                        autoFocus
                      />
                      {partage.invites === null && boutonsPartage}
                    </div>
                    {partage.invites !== null && (
                      <>
                        <label className={styles.champLibelle} htmlFor="invites">
                          Invités, un prénom par ligne
                        </label>
                        <textarea
                          id="invites"
                          className={styles.champInvites}
                          aria-label="Invités, un prénom par ligne"
                          placeholder={"Marie\nPaul\nSophie"}
                          value={partage.invites}
                          onChange={(e) => setPartage((p) => ({ ...p, invites: e.target.value }))}
                          rows={6}
                        />
                        <p className={styles.aide}>Un prénom par ligne, {INVITES_MAX} au plus. Vous pourrez modifier la liste ensuite.</p>
                        <p className={styles.alerteBloc}>
                          <b>Le prénom est choisi par le lecteur, pas vérifié.</b> Dans un groupe d&apos;amis, c&apos;est suffisant ; pour un client, préférez un
                          lien par personne. L&apos;accès protégé par code ne s&apos;applique pas à un lien de groupe.
                        </p>
                      </>
                    )}
                    {partage.invites !== null && <div className={styles.ligne}>{boutonsPartage}</div>}
                  </form>
                ) : (
                  <div>
                    <p className={styles.aide}>
                      {partage.invites === null ? "Lien privé" : "Lien de groupe"} créé pour {partage.destinataire}. Getgents n&apos;envoie rien : envoyez-le
                      vous-même — WhatsApp s&apos;ouvre avec le message déjà écrit, vous choisissez le contact ou le groupe.
                    </p>
                    <div className={styles.ligne}>
                      <code className={styles.lienCode}>{partage.resultat.lien}</code>
                      <a
                        className={styles.boutonWhatsApp}
                        href={lienWhatsApp(
                          messageWhatsApp({
                            prenom: partage.invites === null ? partage.destinataire : null,
                            titre: page.titre,
                            lien: partage.resultat.lien,
                            langue: langueDesLecteurs(page.langueLecteurs),
                          })
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.8-.3-2.2-1-3.1-2.8-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3 1 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z" /></svg>
                        Envoyer par WhatsApp
                      </a>
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
                    <button type="button" className={styles.lienTexte} onClick={() => setPartage({ ouvert: false, destinataire: "", invites: null, resultat: null })}>
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
                  const invites = page.groupes?.[d.jeton] ?? null;
                  const lienD = `${base}/partage/${d.jeton}`;
                  return (
                    <li key={d.jeton} className={ok ? styles.destinataire : `${styles.destinataire} ${styles.eteint}`}>
                      <span className={styles.avatar} aria-hidden="true">
                        {initiales(d.destinataire)}
                      </span>
                      <span className={styles.destTexte}>
                        <b>
                          {d.destinataire}
                          {invites && <span className={styles.badgeGroupe}>Lien de groupe</span>}
                        </b>
                        <span>
                          {d.revokedAt
                            ? `Révoqué le ${jour(d.revokedAt)}`
                            : !ok
                              ? `Expiré le ${jour(d.expiresAt!)}`
                              : `Envoyé le ${jour(d.createdAt)}${d.expiresAt ? ` · expire le ${jour(d.expiresAt)}` : ""}`}
                          {invites ? ` · ${invites.length} invité${invites.length > 1 ? "s" : ""}` : ""}
                          {d.questions > 0 ? ` · ${d.questions} question${d.questions > 1 ? "s" : ""}` : ""}
                          {bloque && <span className={styles.alerte}> · Sans adresse e-mail : bloqué par la protection</span>}
                          {ok && page.protection && !bloque && (
                            <span className={valide ? styles.ok : undefined}>{valide ? ` · ✓ code validé le ${jour(valide)}` : " · code pas encore validé"}</span>
                          )}
                        </span>
                      </span>
                      {ok && (
                        <span className={styles.destActions}>
                          <a
                            className={styles.lienWhatsApp}
                            href={lienWhatsApp(messageWhatsApp({ prenom: invites ? null : d.destinataire, titre: page.titre, lien: lienD, langue: langueDesLecteurs(page.langueLecteurs) }))}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.8-.3-2.2-1-3.1-2.8-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3 1 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z" /></svg>
                            WhatsApp
                          </a>
                          {invites && (
                            <button type="button" className={styles.lienTexte} onClick={() => setEditeurInvites({ jeton: d.jeton, texte: invites.join("\n") })}>
                              Invités
                            </button>
                          )}
                          <button type="button" className={styles.lienTexte} onClick={() => copier(lienD, "Lien")}>
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
                      {editeurInvites?.jeton === d.jeton && (
                        <div className={styles.editeurInvites}>
                          <textarea
                            className={styles.champInvites}
                            aria-label="Invités, un prénom par ligne"
                            value={editeurInvites.texte}
                            onChange={(e) => setEditeurInvites({ jeton: d.jeton, texte: e.target.value })}
                            rows={6}
                          />
                          <p className={styles.aide}>Retirer un invité ne supprime pas sa réponse.</p>
                          <div className={styles.ligne}>
                            <button
                              type="button"
                              className={styles.principal}
                              disabled={enCours === `inv-${d.jeton}` || !editeurInvites.texte.trim()}
                              onClick={async () => {
                                const r = await appel(
                                  `inv-${d.jeton}`,
                                  `/api/partages/${encodeURIComponent(d.jeton)}/invites`,
                                  { method: "PUT", body: JSON.stringify({ invites: editeurInvites.texte }) },
                                  "Invités enregistrés."
                                );
                                if (r) setEditeurInvites(null);
                              }}
                            >
                              Enregistrer
                            </button>
                            <button type="button" className={styles.lienTexte} onClick={() => setEditeurInvites(null)}>
                              Annuler
                            </button>
                          </div>
                        </div>
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
