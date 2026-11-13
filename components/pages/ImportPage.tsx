"use client";

import { useEffect, useRef, useState } from "react";
import { alertesImport, detecterFormat, nettoyerCollage, tailleLisible, titreDetecte, type AlerteImport, type Difference } from "@/lib/importPage";
import { FORMATS_ARTEFACT, type FormatArtefact } from "@/lib/mcpPartage";
import { libelleFormat } from "@/lib/pagesGetsite";
import styles from "./pages.module.css";

const EXTENSIONS = ".html,.htm,.jsx,.tsx,.js,.md,.markdown,.svg,.txt";
const DELAI_APERCU_MS = 600;

interface Resume {
  version: number;
  suivante: number;
  titreAvant: string;
  titreApres: string;
  caracteresAvant: number;
  caracteresApres: number;
  difference: Difference;
  liens: number;
}

/**
 * Créer une page — ou une nouvelle version — en COLLANT le code d'un
 * artefact. Titre et format sont déduits (modifiables), l'aperçu se refait
 * pendant la frappe dans un cadre isolé, et les alertes (données
 * personnelles, artefact branché sur Claude, abréviation) sont calculées par
 * le même module que celui qui revérifie côté serveur.
 */
export function ImportPage({
  page,
  onFermer,
  onPubliee,
}: {
  /** Absent : nouvelle page. Présent : nouvelle version de cette page. */
  page?: { id: string; titre: string; format: FormatArtefact };
  onFermer: () => void;
  onPubliee?: (message: string) => void;
}) {
  const [mode, setMode] = useState<"coller" | "fichier">("coller");
  const [code, setCode] = useState("");
  const [nomFichier, setNomFichier] = useState<string | undefined>();
  const [titre, setTitre] = useState(page?.titre ?? "");
  const [titreTouche, setTitreTouche] = useState(!!page);
  const [format, setFormat] = useState<FormatArtefact | null>(page?.format ?? null);
  const [formatTouche, setFormatTouche] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const formulaire = useRef<HTMLFormElement>(null);

  const contenu = nettoyerCollage(code);
  const detecte = contenu ? detecterFormat(contenu, nomFichier) : null;
  const formatEffectif: FormatArtefact = (formatTouche ? format : detecte) ?? format ?? "html";
  const titreDeduit = contenu ? titreDetecte(contenu, formatEffectif) : "";
  const titreEffectif = titreTouche ? titre : titreDeduit || titre;
  const alertes: AlerteImport[] = contenu ? alertesImport(contenu, formatEffectif) : [];
  const bloquee = !contenu || alertes.some((a) => a.niveau === "bloquant");

  // Échap ferme ; la fenêtre porte sa propre sortie.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFermer]);

  // L'aperçu se refait après une pause de frappe : le formulaire caché poste le code dans le cadre.
  useEffect(() => {
    const t = window.setTimeout(() => formulaire.current?.submit(), contenu ? DELAI_APERCU_MS : 0);
    return () => window.clearTimeout(t);
  }, [contenu, formatEffectif, titreEffectif]);

  // Nouvelle version : ce qui change, et combien de liens sont concernés (sans rien publier).
  useEffect(() => {
    if (!page || !contenu || bloquee) {
      setResume(null);
      return;
    }
    let vivant = true;
    const t = window.setTimeout(async () => {
      const r = await fetch(`/api/pages/${encodeURIComponent(page.id)}/version`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenu, titre: titreEffectif, format: formatEffectif, simuler: true }),
      });
      const j = await r.json().catch(() => null);
      if (vivant && r.ok) setResume(j as Resume);
    }, DELAI_APERCU_MS);
    return () => {
      vivant = false;
      window.clearTimeout(t);
    };
  }, [page, contenu, titreEffectif, formatEffectif, bloquee]);

  async function lireFichier(f: File | undefined) {
    if (!f) return;
    setErreur(null);
    setNomFichier(f.name);
    setCode(await f.text());
  }

  async function publier() {
    if (bloquee || enCours || !titreEffectif.trim()) return;
    setEnCours(true);
    setErreur(null);
    const r = await fetch(page ? `/api/pages/${encodeURIComponent(page.id)}/version` : "/api/pages", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contenu, titre: titreEffectif, format: formatEffectif }),
    });
    const j = (await r.json().catch(() => ({}))) as { id?: string; nouvelle?: boolean; version?: number; error?: string };
    setEnCours(false);
    if (!r.ok) return setErreur(j.error || "La page n'a pas pu être enregistrée. Réessayez.");
    if (page) {
      onPubliee?.(`Version ${j.version} publiée : tous les liens l'affichent.`);
      onFermer();
      return;
    }
    // Une page au contenu identique existait déjà : on l'ouvre plutôt que d'en créer une seconde.
    window.location.assign(`/pages/${j.id}${j.nouvelle ? "" : "?existante=1"}`);
  }

  return (
    <div className={styles.importVoile} onClick={onFermer}>
      <div className={styles.importFenetre} role="dialog" aria-modal="true" aria-labelledby="import-titre" onClick={(e) => e.stopPropagation()}>
        <div className={styles.importTete}>
          <h2 id="import-titre">{page ? `Nouvelle version de « ${page.titre} »` : "Nouvelle page"}</h2>
          <button type="button" className={styles.importFermer} aria-label="Fermer" onClick={onFermer}>
            ✕
          </button>
        </div>

        <div className={styles.importCorps}>
          <div className={styles.importCol}>
            <div className={styles.filtreQuestions} role="tablist" aria-label="Source du code">
              <button type="button" role="tab" aria-selected={mode === "coller"} onClick={() => setMode("coller")}>
                Coller le code
              </button>
              <button type="button" role="tab" aria-selected={mode === "fichier"} onClick={() => setMode("fichier")}>
                Déposer un fichier
              </button>
            </div>
            {mode === "coller" ? (
              <label className={styles.importLabel}>
                <span>
                  {page ? "Code corrigé" : "Code de l'artefact ou du canvas"}
                  <small>Bouton « Copier » dans Claude, ChatGPT, Mistral…</small>
                </span>
                <textarea
                  className={styles.importCode}
                  value={code}
                  spellCheck={false}
                  autoFocus
                  placeholder="<!doctype html>…"
                  onChange={(e) => {
                    setNomFichier(undefined);
                    setCode(e.target.value);
                  }}
                />
              </label>
            ) : (
              <label
                className={styles.importDepot}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void lireFichier(e.dataTransfer.files[0]);
                }}
              >
                <input type="file" accept={EXTENSIONS} onChange={(e) => void lireFichier(e.target.files?.[0])} />
                <b>{nomFichier ?? "Déposez un fichier ici, ou cliquez pour le choisir"}</b>
                <span>.html, .jsx, .md, .svg — un artefact téléchargé depuis Claude, par exemple</span>
              </label>
            )}
            <div className={styles.importLigne}>
              <label className={styles.importLabel}>
                <span>Titre</span>
                <input
                  className={styles.champ}
                  value={titreEffectif}
                  maxLength={200}
                  onChange={(e) => {
                    setTitreTouche(true);
                    setTitre(e.target.value);
                  }}
                />
              </label>
              <label className={`${styles.importLabel} ${styles.importFormat}`}>
                <span>Format</span>
                <select
                  className={styles.champ}
                  value={formatEffectif}
                  onChange={(e) => {
                    setFormatTouche(true);
                    setFormat(e.target.value as FormatArtefact);
                  }}
                >
                  {FORMATS_ARTEFACT.map((f) => (
                    <option key={f} value={f}>
                      {libelleFormat(f)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {contenu && (
              <div className={styles.chips}>
                {!titreTouche && titreDeduit && <span className={styles.chipOk}>✓ Titre repris du document</span>}
                {!formatTouche && detecte && <span className={styles.chipOk}>✓ Format détecté : {libelleFormat(detecte)}</span>}
                <span className={styles.pastilleGrise}>{tailleLisible(contenu.length)}</span>
              </div>
            )}
          </div>

          <div className={styles.importCol}>
            <div className={styles.importApercu}>
              <div className={styles.apercuBarre}>
                <span>Aperçu — tel que le verront vos destinataires</span>
                <span>isolé, sans accès à votre compte</span>
              </div>
              <iframe
                name="apercu-import"
                className={styles.apercuCadre}
                title="Aperçu de la page"
                sandbox="allow-scripts allow-popups allow-forms allow-modals"
                referrerPolicy="no-referrer"
              />
            </div>
            {page && resume && (
              <div className={styles.importDiff}>
                <div>
                  <b>Version {resume.version} (actuelle)</b>
                  {resume.titreAvant !== resume.titreApres && <span className={styles.diffAvant}>{resume.titreAvant}</span>}
                  {tailleLisible(resume.caracteresAvant)}
                  {resume.difference.avant && <span className={styles.diffAvant}>{resume.difference.avant}</span>}
                </div>
                <div>
                  <b>Version {resume.suivante}</b>
                  {resume.titreAvant !== resume.titreApres && <span className={styles.diffApres}>{resume.titreApres}</span>}
                  {tailleLisible(resume.caracteresApres)}
                  {resume.difference.apres && <span className={styles.diffApres}>{resume.difference.apres}</span>}
                  {resume.difference.identique && <span>Code identique à la version actuelle.</span>}
                  {!resume.difference.identique && !resume.difference.avant && !resume.difference.apres && <span>Le texte visible est le même ; seul le code change.</span>}
                </div>
              </div>
            )}
            {alertes.map((a, i) => (
              <div key={i} className={styles.importAlerte} data-niveau={a.niveau}>
                {a.niveau === "info" ? "ⓘ" : "⚠"} <span>{a.texte}</span>
              </div>
            ))}
            {page && resume && (
              <div className={styles.importAlerte} data-niveau="info">
                ⓘ{" "}
                <span>
                  {resume.liens === 0
                    ? "Aucun lien actif pour l'instant."
                    : `Ce${resume.liens > 1 ? "s" : ""} ${resume.liens} lien${resume.liens > 1 ? "s" : ""} afficher${resume.liens > 1 ? "ont" : "a"} la version ${resume.suivante}.`}{" "}
                  La version {resume.version} reste restaurable.
                </span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.importPied}>
          <span>{erreur ?? (page ? "Rien n'est publié avant votre clic." : "Rien n'est partagé à cette étape : vous choisirez les destinataires dans la fiche.")}</span>
          <button type="button" className={styles.secondaire} onClick={onFermer}>
            Annuler
          </button>
          <button type="button" className={styles.principal} disabled={bloquee || enCours || !titreEffectif.trim() || (!!page && !!resume?.difference.identique && resume.titreAvant === resume.titreApres)} onClick={() => void publier()}>
            {enCours ? "Enregistrement…" : page ? `Publier la version ${resume?.suivante ?? ""}`.trim() : "Créer la page"}
          </button>
        </div>

        {/* Le code part dans le cadre par un formulaire : un `srcdoc` hériterait de la CSP de Getgents. */}
        <form ref={formulaire} method="post" action="/api/pages/apercu" target="apercu-import" hidden>
          <input type="hidden" name="contenu" value={contenu} readOnly />
          <input type="hidden" name="format" value={formatEffectif} readOnly />
          <input type="hidden" name="titre" value={titreEffectif} readOnly />
        </form>
      </div>
    </div>
  );
}
