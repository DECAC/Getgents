"use client";

import { useBuilder } from "@/lib/context/BuilderContext";
import type { CollabQuestion } from "@/lib/types";
import styles from "./PromptTab.module.css";
import local from "./CollaboratifTab.module.css";

function newQuestionId(): string {
  return `q_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Type de gent « collaboratif » : plusieurs participants rejoignent un salon
 * via un lien + leur prénom ; le gent orchestre la mission (collecte en privé,
 * vérification web, propositions, vote, synthèse).
 *
 * Les 8 blocs de configuration suivent le cadrage produit : mission + cadre,
 * exclusions, questions de collecte, relances, propositions, décision,
 * confidentialité, rôle du créateur. Le ton et la base de connaissance restent
 * dans les onglets Conversationnel / Connaissances existants.
 */
export function CollaboratifTab() {
  const { currentDraft, updateCollab } = useBuilder();
  const collab = currentDraft.collab;
  const enabled = !!collab?.enabled;
  const questions = collab?.questions ?? [];

  function setQuestions(next: CollabQuestion[]) {
    updateCollab({ questions: next });
  }

  function patchQuestion(id: string, patch: Partial<CollabQuestion>) {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function addQuestion() {
    setQuestions([
      ...questions,
      {
        id: newQuestionId(),
        label: "",
        kind: "text",
        required: true,
      },
    ]);
  }

  function removeQuestion(id: string) {
    setQuestions(questions.filter((q) => q.id !== id));
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.webSearchRow}>
          <div>
            <h4 className={styles.title}>Type « Collaboratif »</h4>
            <div className={styles.sub}>
              Le gent devient un <b>orchestrateur de mission</b> : un salon commun pour
              l&apos;équipe, des échanges privés pour collecter les réponses de chacun, une
              synthèse vivante des décisions. Diffusez ensuite le <b>lien de salon</b> depuis
              l&apos;onglet Diffusion.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            className={[styles.switch, enabled ? styles.switchOn : ""].filter(Boolean).join(" ")}
            onClick={() => updateCollab({ enabled: !enabled })}
            aria-label="Activer le type Collaboratif"
          >
            <span className={styles.knob} />
          </button>
        </div>
      </div>

      {enabled && (
        <>
          <div className={styles.card}>
            <h4 className={styles.title}>Mission</h4>
            <div className={styles.sub}>
              Ce que le gent doit accomplir avec le groupe. Le ton et les consignes de style
              restent dans l&apos;onglet <b>Gent Conversationnel</b> (prompt système).
            </div>
            <textarea
              className={styles.routineMission}
              value={collab?.mission ?? ""}
              onChange={(e) => updateCollab({ mission: e.target.value })}
              placeholder="Ex. : Organiser le team building d'octobre — trouver 3 options réalistes et faire voter l'équipe."
              aria-label="Mission du gent collaboratif"
            />
            <div className={styles.routineConfig}>
              <div className={local.fieldGrid}>
                <label className={local.field}>
                  <span className={local.fieldLabel}>Budget</span>
                  <input
                    className={local.input}
                    value={collab?.cadre?.budget ?? ""}
                    onChange={(e) => updateCollab({ cadre: { budget: e.target.value } })}
                    placeholder="150 € / pers"
                  />
                </label>
                <label className={local.field}>
                  <span className={local.fieldLabel}>Lieu</span>
                  <input
                    className={local.input}
                    value={collab?.cadre?.lieu ?? ""}
                    onChange={(e) => updateCollab({ cadre: { lieu: e.target.value } })}
                    placeholder="< 1 h de Paris"
                  />
                </label>
                <label className={local.field}>
                  <span className={local.fieldLabel}>Période</span>
                  <input
                    className={local.input}
                    value={collab?.cadre?.periode ?? ""}
                    onChange={(e) => updateCollab({ cadre: { periode: e.target.value } })}
                    placeholder="octobre 2026"
                  />
                </label>
                <label className={local.field}>
                  <span className={local.fieldLabel}>Taille du groupe</span>
                  <input
                    className={local.input}
                    value={collab?.cadre?.taille ?? ""}
                    onChange={(e) => updateCollab({ cadre: { taille: e.target.value } })}
                    placeholder="8 participants"
                  />
                </label>
              </div>
              <label className={local.field}>
                <span className={local.fieldLabel}>Exclusions (ce qu&apos;il ne doit pas proposer)</span>
                <textarea
                  className={styles.routineMission}
                  value={collab?.exclusions ?? ""}
                  onChange={(e) => updateCollab({ exclusions: e.target.value })}
                  placeholder="Ex. : pas d'activités aquatiques, pas de soirée en discothèque, rien hors Île-de-France."
                  aria-label="Exclusions"
                />
              </label>
            </div>
          </div>

          <div className={styles.card}>
            <h4 className={styles.title}>Collecte auprès de chaque participant</h4>
            <div className={styles.sub}>
              Questions posées <b>en privé</b> par le gent. Les réponses ne remontent au salon
              que sous forme de synthèse (jamais en verbatim, sauf si vous l&apos;autorisez
              ci-dessous).
            </div>
            <div className={local.questionList}>
              {questions.map((q) => (
                <div key={q.id} className={local.questionRow}>
                  <div className={local.questionTop}>
                    <input
                      className={local.input}
                      value={q.label}
                      onChange={(e) => patchQuestion(q.id, { label: e.target.value })}
                      placeholder="Ex. : Tes disponibilités en octobre ?"
                      aria-label="Libellé de la question"
                    />
                    <select
                      className={local.select}
                      value={q.kind}
                      onChange={(e) =>
                        patchQuestion(q.id, {
                          kind: e.target.value as CollabQuestion["kind"],
                        })
                      }
                      aria-label="Type de question"
                    >
                      <option value="text">Texte libre</option>
                      <option value="dates">Dates</option>
                      <option value="choice">Choix</option>
                    </select>
                    <button
                      type="button"
                      className={local.removeBtn}
                      onClick={() => removeQuestion(q.id)}
                      aria-label="Retirer la question"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                  {(q.kind === "choice" || q.kind === "dates") && (
                    <label className={local.field}>
                      <span className={local.fieldLabel}>
                        Options (séparées par des virgules)
                      </span>
                      <input
                        className={local.input}
                        value={(q.options ?? []).join(", ")}
                        onChange={(e) =>
                          patchQuestion(q.id, {
                            options: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder={
                          q.kind === "dates"
                            ? "3 oct, 10 oct, 17 oct, 24 oct"
                            : "Plein air, Culturel, Sportif"
                        }
                      />
                    </label>
                  )}
                  <div className={local.questionMeta}>
                    <label className={local.check}>
                      <input
                        type="checkbox"
                        checked={q.required !== false}
                        onChange={(e) => patchQuestion(q.id, { required: e.target.checked })}
                      />
                      Obligatoire pour passer aux propositions
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.knowAddRow}>
              <button type="button" className={styles.knowAddBtn} onClick={addQuestion}>
                + Ajouter une question
              </button>
            </div>
            <div className={styles.routineConfig}>
              <div className={local.fieldGrid}>
                <label className={local.field}>
                  <span className={local.fieldLabel}>Relancer après (heures)</span>
                  <input
                    className={local.input}
                    type="number"
                    min={1}
                    max={168}
                    value={collab?.relances?.delaiHeures ?? 24}
                    onChange={(e) =>
                      updateCollab({
                        relances: { delaiHeures: Math.max(1, Number(e.target.value) || 24) },
                      })
                    }
                  />
                </label>
                <label className={local.field}>
                  <span className={local.fieldLabel}>Nombre max de relances</span>
                  <input
                    className={local.input}
                    type="number"
                    min={0}
                    max={5}
                    value={collab?.relances?.max ?? 2}
                    onChange={(e) =>
                      updateCollab({
                        relances: { max: Math.max(0, Number(e.target.value) || 0) },
                      })
                    }
                  />
                </label>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <h4 className={styles.title}>Propositions et décision</h4>
            <div className={styles.sub}>
              Quand la collecte est assez avancée, le gent vérifie des options (recherche web si
              activée) et les publie dans le salon.
            </div>
            <div className={local.fieldGrid}>
              <label className={local.field}>
                <span className={local.fieldLabel}>Nombre d&apos;options</span>
                <input
                  className={local.input}
                  type="number"
                  min={2}
                  max={5}
                  value={collab?.propositions?.options ?? 3}
                  onChange={(e) =>
                    updateCollab({
                      propositions: {
                        options: Math.min(5, Math.max(2, Number(e.target.value) || 3)),
                      },
                    })
                  }
                />
              </label>
              <label className={local.field}>
                <span className={local.fieldLabel}>Quorum de votes</span>
                <input
                  className={local.input}
                  type="number"
                  min={1}
                  max={50}
                  value={collab?.propositions?.quorum ?? ""}
                  onChange={(e) =>
                    updateCollab({
                      propositions: {
                        quorum: e.target.value ? Math.max(1, Number(e.target.value) || 1) : undefined,
                      },
                    })
                  }
                  placeholder="Majorité"
                />
              </label>
            </div>
            <div className={styles.routineConfig}>
              <label className={local.check}>
                <input
                  type="checkbox"
                  checked={collab?.propositions?.webCheck !== false}
                  onChange={(e) =>
                    updateCollab({ propositions: { webCheck: e.target.checked } })
                  }
                />
                Vérifier la faisabilité sur le web avant de proposer
              </label>
              <p className={local.hint}>
                La recherche web doit aussi être activée pour ce gent (onglet Connecteurs /
                Conversationnel).
              </p>
              <div>
                <span className={local.fieldLabel}>Qui tranche ?</span>
                <div className={local.radioRow} style={{ marginTop: 8 }}>
                  <label className={local.radio}>
                    <input
                      type="radio"
                      name="decision"
                      checked={(collab?.decision ?? "vote") === "vote"}
                      onChange={() => updateCollab({ decision: "vote" })}
                    />
                    Vote du groupe au salon
                  </label>
                  <label className={local.radio}>
                    <input
                      type="radio"
                      name="decision"
                      checked={collab?.decision === "createur"}
                      onChange={() => updateCollab({ decision: "createur" })}
                    />
                    Vous gardez la main
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <h4 className={styles.title}>Confidentialité et votre rôle</h4>
            <div className={styles.sub}>
              Les conversations privées entre participants restent toujours invisibles au gent.
              Ici, vous réglez ce qu&apos;il peut partager du fil privé gent ↔ participant.
            </div>
            <div className={styles.routineConfig}>
              <label className={local.check}>
                <input
                  type="checkbox"
                  checked={collab?.confidentialite?.syntheses !== false}
                  onChange={(e) =>
                    updateCollab({ confidentialite: { syntheses: e.target.checked } })
                  }
                />
                Synthèses partagées dans l&apos;onglet Synthèse (recommandé)
              </label>
              <label className={local.check}>
                <input
                  type="checkbox"
                  checked={!!collab?.confidentialite?.verbatim}
                  onChange={(e) =>
                    updateCollab({ confidentialite: { verbatim: e.target.checked } })
                  }
                />
                Autoriser le gent à citer le verbatim d&apos;une réponse privée au salon
              </label>
              <div>
                <span className={local.fieldLabel}>Votre place dans le salon</span>
                <div className={local.radioRow} style={{ marginTop: 8 }}>
                  <label className={local.radio}>
                    <input
                      type="radio"
                      name="roleCreateur"
                      checked={(collab?.roleCreateur ?? "membre") === "membre"}
                      onChange={() => updateCollab({ roleCreateur: "membre" })}
                    />
                    Membre à part entière (vous pouvez intervenir)
                  </label>
                  <label className={local.radio}>
                    <input
                      type="radio"
                      name="roleCreateur"
                      checked={collab?.roleCreateur === "organisateur"}
                      onChange={() => updateCollab({ roleCreateur: "organisateur" })}
                    />
                    Organisateur (badge Créateur, mêmes droits de parole)
                  </label>
                </div>
                <p className={local.hint}>
                  Les deux options vous laissent intervenir dans le salon. « Organisateur »
                  affiche simplement le badge Créateur auprès des participants.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
