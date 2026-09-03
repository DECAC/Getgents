"use client";

import { useMemo, useState } from "react";
import type { Espace } from "@/lib/types";
import styles from "./CollabShell.module.css";

/**
 * Aperçu du salon Event Manager ouvert via Preview (espace du créateur).
 * Pas de session réelle ni d'API : on affiche le GABARIT tel que configuré
 * (mission, cadre, questions) pour que le créateur se projette avant de
 * Diffuser + créer un lien de salon.
 */

const PAV_COLORS: [string, string][] = [
  ["#dbe7fb", "#3a5fa3"],
  ["#fde4bb", "#8a6410"],
  ["#ffdee2", "#c73758"],
  ["#d4f1d4", "#3c7a40"],
  ["#e6e0f8", "#5b4a9e"],
];

function pavStyle(name: string): { background: string; color: string } {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const [bg, fg] = PAV_COLORS[h % PAV_COLORS.length];
  return { background: bg, color: fg };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase();
}

type PreviewTab = "salon" | "synthese" | "prive";

export function CollabPreviewShell({ espace }: { espace: Espace }) {
  const collab = espace.collab;
  const gentName = espace.gent || espace.name || "Event Manager";
  const icon = espace.icon || "🧭";
  const mission =
    collab?.mission?.trim() ||
    "Mission collaborative — précisez-la dans l'onglet Event Manager du studio.";
  const cadre = collab?.cadre ?? {};
  const questions = collab?.questions ?? [];
  const [tab, setTab] = useState<PreviewTab>("salon");
  const [entered, setEntered] = useState(false);
  // Même volet que dans le vrai salon : l'aperçu doit montrer ce que les
  // participants verront, sur téléphone comme sur grand écran.
  const [personnesOuvertes, setPersonnesOuvertes] = useState(false);

  const demoPeople = useMemo(
    () => [
      { name: "Vous", role: "organizer" as const },
      { name: "Hugo", role: "participant" as const },
      { name: "Léa", role: "participant" as const },
    ],
    []
  );

  if (!collab?.enabled) {
    return (
      <div className={styles.page}>
        <main className={styles.join}>
          <div className={styles.joinCard}>
            <p className={styles.joinError}>
              Event Manager n&apos;est pas activé sur ce gent. Retournez dans le studio, onglet
              Event Manager, et activez l&apos;interrupteur.
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (!entered) {
    return (
      <div className={styles.page}>
        <div className={styles.previewBanner} role="status">
          <b>Mode Preview</b> — aperçu du gabarit. Pour un vrai salon avec l&apos;équipe :
          Diffuser, puis créer un <b>lien de salon</b> dans Diffusion.
        </div>
        <main className={styles.join}>
          <div className={styles.joinCard}>
            <div className={styles.joinIcon}>{icon}</div>
            <h1 className={styles.joinTitle}>
              {gentName} <span className={styles.badgeOrch}>Orchestrateur</span>
            </h1>
            <p className={styles.joinMission}>{mission}</p>
            {(cadre.budget || cadre.lieu || cadre.periode || cadre.taille) && (
              <p className={styles.joinNote}>
                {[cadre.budget, cadre.lieu, cadre.periode, cadre.taille].filter(Boolean).join(" · ")}
              </p>
            )}
            {questions.length > 0 && (
              <ul className={styles.previewQuestions}>
                {questions.map((q) => (
                  <li key={q.id}>
                    <b>{q.label || "Question sans libellé"}</b>
                    <span>
                      {" "}
                      —{" "}
                      {q.kind === "dates" ? "dates" : q.kind === "choice" ? "choix" : "texte libre"}
                      {q.options?.length ? ` (${q.options.join(", ")})` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button className={styles.joinBtn} type="button" onClick={() => setEntered(true)}>
              Voir le salon (aperçu)
            </button>
            <p className={styles.joinNote}>
              Aucun message n&apos;est envoyé : c&apos;est uniquement un aperçu de l&apos;interface
              que vos participants verront.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.previewBanner} role="status">
        <b>Mode Preview</b> — données fictives. Diffuser + lien de salon pour tester en réel.
      </div>
      <header className={styles.topbar}>
        <div className={styles.gentAv}>{icon}</div>
        <div className={styles.gentMeta}>
          <p className={styles.gentName}>
            {gentName} <span className={styles.badgeOrch}>Orchestrateur</span>
          </p>
          <p className={styles.gentSub}>{mission}</p>
        </div>
        <div className={styles.missionChips}>
          <span className={`${styles.mchip} ${styles.mchipCreator}`}>
            ★ Vous êtes le créateur de cette mission
          </span>
          {cadre.budget && <span className={styles.mchip}>💶 {cadre.budget}</span>}
          {cadre.lieu && <span className={styles.mchip}>📍 {cadre.lieu}</span>}
          {cadre.periode && <span className={styles.mchip}>📅 {cadre.periode}</span>}
          {cadre.taille && <span className={styles.mchip}>👥 {cadre.taille}</span>}
        </div>
        <div className={styles.topRight}>
          <div className={styles.progress}>
            <p className={styles.progressLabel}>
              <b>0/{demoPeople.length}</b> réponses
            </p>
            <div className={styles.bar}>
              <i className={styles.barFill} style={{ width: "0%" }} />
            </div>
          </div>
        </div>
      </header>

      <div className={styles.layout}>
        <aside
          id="collab-participants"
          className={[styles.people, personnesOuvertes ? styles.peopleOuvert : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <div className={styles.peopleHead}>
            <div className={styles.peopleTitle}>
              <h2>Participants</h2>
              <span className={styles.peopleCount}>{demoPeople.length}</span>
            </div>
            <p className={styles.peopleHint}>Aperçu — clics non connectés</p>
          </div>
          <div className={styles.peopleList}>
            {demoPeople.map((p) => (
              <div
                key={p.name}
                className={`${styles.person} ${p.role === "organizer" ? styles.personMe : ""}`}
              >
                <span className={styles.pav} style={pavStyle(p.name)}>
                  {initials(p.name)}
                </span>
                <div>
                  <p className={styles.pname}>
                    {p.name}
                    {p.role === "organizer" && <span className={styles.you}>(vous)</span>}
                    {p.role === "organizer" && (
                      <span className={styles.badgeCreator}>Créateur</span>
                    )}
                  </p>
                </div>
                <span className={`${styles.pill} ${styles.pillWait}`}>En attente</span>
              </div>
            ))}
          </div>
          <p className={styles.peopleFoot}>
            🔒 En réel, un clic sur un participant ouvre un message privé (invisible du gent).
          </p>
        </aside>

        <main className={styles.stage}>
          <nav className={styles.tabs} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "salon"}
              className={`${styles.tab} ${tab === "salon" ? styles.tabOn : ""}`}
              onClick={() => setTab("salon")}
            >
              Salon
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "synthese"}
              className={`${styles.tab} ${tab === "synthese" ? styles.tabOn : ""}`}
              onClick={() => setTab("synthese")}
            >
              📋 Synthèse
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "prive"}
              className={`${styles.tab} ${tab === "prive" ? styles.tabOn : ""}`}
              onClick={() => setTab("prive")}
            >
              🔒 Privé · {gentName}
            </button>
          
            <button
              type="button"
              className={styles.tabPersonnes}
              onClick={() => setPersonnesOuvertes((v) => !v)}
              aria-expanded={personnesOuvertes}
              aria-controls="collab-participants"
            >
              <span aria-hidden="true">👥</span>
              <span className={styles.tabPersonnesNb}>{demoPeople.length}</span>
              <span className={styles.tabPersonnesTexte}>
                {personnesOuvertes ? "Fermer" : "Participants"}
              </span>
            </button>
          </nav>

          {personnesOuvertes && (
            <div
              className={styles.peopleVoile}
              onClick={() => setPersonnesOuvertes(false)}
              aria-hidden="true"
            />
          )}

          <div className={styles.feed}>
            <div className={styles.feedInner}>
              {tab === "salon" && (
                <>
                  <article className={styles.orch}>
                    <div className={styles.orchHead}>
                      <span className={styles.orchAv}>{icon}</span>
                      <b>{gentName}</b>
                      <span className={styles.badgeOrch}>Orchestrateur</span>
                    </div>
                    <p className={styles.orchText}>
                      Bienvenue dans le salon. Mission : <b>{mission}</b>
                      {cadre.budget || cadre.lieu
                        ? ` Cadre : ${[cadre.budget, cadre.lieu, cadre.periode]
                            .filter(Boolean)
                            .join(", ")}.`
                        : ""}{" "}
                      Je vais interroger chacun en privé
                      {questions.length
                        ? ` (${questions.length} question${questions.length > 1 ? "s" : ""})`
                        : ""}
                      , puis proposer des options vérifiées au groupe.
                    </p>
                  </article>
                  <div className={styles.emptyState}>
                    <p className={styles.emptySub}>
                      Les messages de l&apos;équipe apparaîtront ici une fois le lien de salon
                      partagé.
                    </p>
                  </div>
                </>
              )}

              {tab === "prive" && (
                <article className={styles.orch}>
                  <div className={styles.orchHead}>
                    <span className={styles.orchAv}>{icon}</span>
                    <b>{gentName}</b>
                    <span className={styles.badgeOrch}>Fil privé</span>
                  </div>
                  <p className={styles.orchText}>
                    {questions.length
                      ? "Voici les questions que je poserai à chaque participant :"
                      : "Ajoutez des questions de collecte dans l'onglet Event Manager du studio."}
                  </p>
                  {questions.map((q) => (
                    <div key={q.id}>
                      <p className={styles.orchText}>{q.label || "Question"}</p>
                      {q.options && q.options.length > 0 && (
                        <div className={styles.ask}>
                          {q.options.map((opt) => (
                            <span key={opt} className={styles.chip}>
                              {opt}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </article>
              )}

              {tab === "synthese" && (
                <div className={styles.emptyState}>
                  <p>
                    La synthèse se remplira automatiquement (décision, date, lieu, points en
                    suspens) au fil de la mission réelle.
                  </p>
                  <p className={styles.emptySub}>
                    {collab.exclusions
                      ? `Exclusions configurées : ${collab.exclusions}`
                      : "Aucune exclusion configurée."}
                  </p>
                </div>
              )}
            </div>
          </div>

          <footer className={styles.composer}>
            <div className={styles.composerInner}>
              <div className={styles.cbox}>
                <input
                  type="text"
                  disabled
                  placeholder="Disponible après diffusion du lien de salon…"
                />
                <button className={styles.send} type="button" disabled aria-label="Envoyer">
                  ↑
                </button>
              </div>
              <p className={styles.cnote}>
                Saisie désactivée en Preview — utilisez un lien de salon pour échanger vraiment.
              </p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
