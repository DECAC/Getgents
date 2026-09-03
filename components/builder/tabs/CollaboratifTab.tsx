"use client";

import { useEffect, useRef, useState } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import type { CollabQuestion } from "@/lib/types";
import styles from "./PromptTab.module.css";
import local from "./CollaboratifTab.module.css";

function newQuestionId(): string {
  return `q_${Math.random().toString(36).slice(2, 10)}`;
}

const DEFAULT_PROMPT =
  "Tu es Event Manager, l'orchestrateur d'événements d'équipe de Getgents.\n\n" +
  "Ton : chaleureux, clair, efficace. Tu relances sans culpabiliser.\n\n" +
  "Règles :\n" +
  "- Tu animes le salon commun et tu interroges chacun en privé pour collecter les infos.\n" +
  "- Tu ne révèles jamais le verbatim d'un échange privé au salon : uniquement des synthèses.\n" +
  "- Tu proposes des options réalistes, vérifiées, dans le cadre (budget, lieu, période).\n" +
  "- Tu tiens à jour la synthèse des décisions (date, lieu, horaires, budget).\n" +
  "- Pour les disponibilités, accepte des dates précises OU une période en texte libre (ex. « les mardis à jeudi en octobre »).";

const TEAM_BUILDING_MISSION =
  "Organiser le team building d'équipe : trouver 3 options réalistes (lieu, activité, budget), " +
  "collecter les disponibilités et préférences de chacun, faire voter le groupe.";

function teamBuildingQuestions(): CollabQuestion[] {
  return [
    {
      id: newQuestionId(),
      label: "Quelles sont tes disponibilités ?",
      kind: "dates",
      options: ["sam. 3 oct", "sam. 10 oct", "sam. 17 oct", "sam. 24 oct"],
      required: true,
    },
    {
      id: newQuestionId(),
      label: "Préférence d'activité ?",
      kind: "choice",
      options: ["Plein air", "Culturel", "Sportif", "Atelier créatif"],
      required: true,
    },
    {
      id: newQuestionId(),
      label: "Régime alimentaire ou contrainte à prévoir ?",
      kind: "text",
      required: false,
    },
  ];
}

/**
 * Type de gent « Event Manager » : tout le paramétrage au même endroit.
 * Ouvrir l'onglet depuis le menu active le type et précharge un gabarit
 * team building — pas besoin d'un second interrupteur.
 */
export function CollaboratifTab() {
  const { currentDraft, updateCollab, updateSystemPrompt, toggleWebSearch, updateName, updateIcon } =
    useBuilder();
  const collab = currentDraft.collab;
  const questions = collab?.questions ?? [];

  const [promptValue, setPromptValue] = useState(currentDraft.systemPrompt);
  const lastPushedRef = useRef(currentDraft.systemPrompt);
  const seededForDraftRef = useRef<string | null>(null);

  const [optionsCountDraft, setOptionsCountDraft] = useState(
    String(collab?.propositions?.options ?? 3)
  );

  useEffect(() => {
    setPromptValue(currentDraft.systemPrompt);
    lastPushedRef.current = currentDraft.systemPrompt;
  }, [currentDraft.id, currentDraft.systemPrompt]);

  useEffect(() => {
    setOptionsCountDraft(String(currentDraft.collab?.propositions?.options ?? 3));
  }, [currentDraft.id, currentDraft.collab?.propositions?.options]);

  // Clic menu « Event Manager » = type actif + gabarit team building si besoin.
  useEffect(() => {
    if (seededForDraftRef.current === currentDraft.id) return;
    seededForDraftRef.current = currentDraft.id;

    if (currentDraft.collab?.template === "team-building" && currentDraft.collab.enabled) {
      return;
    }

    setPromptValue(DEFAULT_PROMPT);
    lastPushedRef.current = DEFAULT_PROMPT;
    updateSystemPrompt(DEFAULT_PROMPT);
    updateName("Event Manager");
    updateIcon("🧭");
    if (!currentDraft.webSearch) toggleWebSearch();

    updateCollab({
      enabled: true,
      template: "team-building",
      mission: TEAM_BUILDING_MISSION,
      cadre: {
        budget: "150 € / pers",
        lieu: "< 1 h de Paris",
        periode: "octobre 2026",
        taille: "8 participants",
      },
      exclusions: "Pas d'activités aquatiques, rien hors Île-de-France, pas d'alcool obligatoire.",
      propositions: { options: 3, webCheck: true },
      decision: "vote",
      confidentialite: { syntheses: true, verbatim: false },
      roleCreateur: "membre",
      relances: { delaiHeures: 24, max: 2 },
      questions: teamBuildingQuestions(),
    });
    setOptionsCountDraft("3");
    // Intentionnel : une seule fois par brouillon à l'ouverture de l'onglet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDraft.id]);

  function handlePromptChange(text: string) {
    setPromptValue(text);
    lastPushedRef.current = text;
    updateSystemPrompt(text);
  }

  function setQuestions(next: CollabQuestion[]) {
    updateCollab({ questions: next });
  }

  function patchQuestion(id: string, patch: Partial<CollabQuestion>) {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function addQuestion() {
    setQuestions([
      ...questions,
      { id: newQuestionId(), label: "", kind: "text", required: true },
    ]);
  }

  function removeQuestion(id: string) {
    setQuestions(questions.filter((q) => q.id !== id));
  }

  function commitOptionsCount() {
    const n = parseInt(optionsCountDraft.replace(/\D/g, ""), 10);
    if (!Number.isFinite(n) || optionsCountDraft.trim() === "") {
      setOptionsCountDraft(String(collab?.propositions?.options ?? 3));
      return;
    }
    const clamped = Math.min(10, Math.max(1, n));
    setOptionsCountDraft(String(clamped));
    updateCollab({ propositions: { options: clamped } });
  }

  const wordCount = promptValue.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h4 className={styles.title}>Event Manager</h4>
        <div className={styles.sub} style={{ marginBottom: 0 }}>
          Un gent <b>orchestrateur d&apos;événements</b> : salon commun, collecte en privé,
          vérification web, propositions au vote, synthèse des décisions. Un gabarit{" "}
          <b>team building</b> est préchargé — adaptez-le à votre mission. Diffusez ensuite le{" "}
          <b>lien de salon</b> depuis Diffusion.
        </div>
      </div>

      <div className={styles.card}>
        <h4 className={styles.title}>Identité</h4>
        <div className={styles.sub}>Nom et emblème affichés dans le salon.</div>
        <div className={local.fieldGrid}>
          <label className={local.field}>
            <span className={local.fieldLabel}>Nom du gent</span>
            <input
              className={local.input}
              value={currentDraft.name}
              onChange={(e) => updateName(e.target.value)}
              placeholder="Event Manager"
              aria-label="Nom du gent"
            />
          </label>
          <label className={local.field}>
            <span className={local.fieldLabel}>Icône (emoji)</span>
            <input
              className={local.input}
              value={currentDraft.icon}
              onChange={(e) => updateIcon(e.target.value.slice(0, 4))}
              placeholder="🧭"
              aria-label="Icône du gent"
            />
          </label>
        </div>
      </div>

      <div className={styles.card}>
        <h4 className={styles.title}>Ton et consignes (prompt)</h4>
        <div className={styles.sub}>
          Comportement du gent dans le salon : ton, règles, ce qu&apos;il doit ou ne doit pas
          faire. Distinct de la <b>mission</b> ci-dessous (le « quoi » de l&apos;événement).
        </div>
        <textarea
          className={styles.promptArea}
          value={promptValue}
          onChange={(e) => handlePromptChange(e.target.value)}
          placeholder={DEFAULT_PROMPT}
          aria-label="Prompt système Event Manager"
        />
        <div className={styles.footRow}>
          <span>
            {wordCount} mot{wordCount !== 1 ? "s" : ""}
          </span>
          <span>Modifiable à tout moment — versionné à chaque publication</span>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.webSearchRow}>
          <div>
            <h4 className={styles.title}>Recherche web</h4>
            <div className={styles.sub}>
              Permet à Event Manager de vérifier lieux, prix et disponibilités avant de proposer
              des options (recommandé).
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!currentDraft.webSearch}
            className={[styles.switch, currentDraft.webSearch ? styles.switchOn : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={toggleWebSearch}
            aria-label="Activer la recherche web"
          >
            <span className={styles.knob} />
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <h4 className={styles.title}>Mission collaborative</h4>
        <div className={styles.sub}>
          Ce que le groupe doit accomplir ensemble — affiché en bandeau du salon et rappelé à
          l&apos;orchestrateur.
        </div>
        <textarea
          className={styles.routineMission}
          value={collab?.mission ?? ""}
          onChange={(e) => updateCollab({ mission: e.target.value })}
          placeholder={TEAM_BUILDING_MISSION}
          aria-label="Mission collaborative"
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
              placeholder="Ex. : pas d'activités aquatiques, rien hors Île-de-France."
              aria-label="Exclusions"
            />
          </label>
        </div>
      </div>

      <div className={styles.card}>
        <h4 className={styles.title}>Collecte auprès de chaque participant</h4>
        <div className={styles.sub}>
          Questions posées <b>en privé</b> par le gent. Les réponses ne remontent au salon que sous
          forme de synthèse (sauf si vous autorisez le verbatim plus bas).
        </div>
        <div className={local.questionList}>
          {questions.map((q) => (
            <div key={q.id} className={local.questionRow}>
              <div className={local.questionTop}>
                <input
                  className={local.input}
                  value={q.label}
                  onChange={(e) => patchQuestion(q.id, { label: e.target.value })}
                  placeholder="Ex. : Quelles sont tes disponibilités ?"
                  aria-label="Libellé de la question"
                />
                <select
                  className={local.select}
                  value={q.kind}
                  onChange={(e) =>
                    patchQuestion(q.id, { kind: e.target.value as CollabQuestion["kind"] })
                  }
                  aria-label="Type de question"
                >
                  <option value="text">Texte libre</option>
                  <option value="dates">Dates / période</option>
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
              {q.kind === "choice" && (
                <label className={local.field}>
                  <span className={local.fieldLabel}>Options (séparées par des virgules)</span>
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
                    placeholder="Plein air, Culturel, Sportif"
                  />
                </label>
              )}
              {q.kind === "dates" && (
                <>
                  <label className={local.field}>
                    <span className={local.fieldLabel}>
                      Suggestions de dates (optionnel, séparées par des virgules)
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
                      placeholder="sam. 3 oct, sam. 10 oct, sam. 17 oct"
                    />
                  </label>
                  <p className={local.hint}>
                    Les participants peuvent aussi répondre en <b>texte libre</b> pour une période
                    (ex. « les mardis à jeudi en octobre »), même sans suggestion.
                  </p>
                </>
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
          Quand la collecte est assez avancée, le gent vérifie des options et les publie dans le
          salon.
        </div>
        <div className={local.fieldGrid}>
          <label className={local.field}>
            <span className={local.fieldLabel}>Nombre d&apos;options</span>
            <input
              className={local.input}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={optionsCountDraft}
              onChange={(e) => setOptionsCountDraft(e.target.value)}
              onBlur={commitOptionsCount}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitOptionsCount();
                }
              }}
              placeholder="3"
              aria-label="Nombre d'options à proposer"
            />
            <span className={local.hint}>Saisissez un nombre de 1 à 10, puis validez (Entrée ou clic ailleurs).</span>
          </label>
          <label className={local.field}>
            <span className={local.fieldLabel}>Quorum de votes</span>
            <input
              className={local.input}
              type="text"
              inputMode="numeric"
              value={collab?.propositions?.quorum ?? ""}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (!raw) {
                  updateCollab({ propositions: { quorum: undefined } });
                  return;
                }
                const n = parseInt(raw.replace(/\D/g, ""), 10);
                if (Number.isFinite(n) && n >= 1) {
                  updateCollab({ propositions: { quorum: Math.min(50, n) } });
                }
              }}
              placeholder="Majorité"
            />
          </label>
        </div>
        <div className={styles.routineConfig}>
          <label className={local.check}>
            <input
              type="checkbox"
              checked={collab?.propositions?.webCheck !== false}
              onChange={(e) => updateCollab({ propositions: { webCheck: e.target.checked } })}
            />
            Vérifier la faisabilité sur le web avant de proposer
          </label>
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
          Les messages privés entre participants restent toujours invisibles au gent. Ici : ce
          qu&apos;il peut partager du fil privé gent ↔ participant.
        </div>
        <div className={styles.routineConfig}>
          <label className={local.check}>
            <input
              type="checkbox"
              checked={collab?.confidentialite?.syntheses !== false}
              onChange={(e) => updateCollab({ confidentialite: { syntheses: e.target.checked } })}
            />
            Synthèses partagées dans l&apos;onglet Synthèse (recommandé)
          </label>
          <label className={local.check}>
            <input
              type="checkbox"
              checked={!!collab?.confidentialite?.verbatim}
              onChange={(e) => updateCollab({ confidentialite: { verbatim: e.target.checked } })}
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
                Organisateur (badge Créateur visible)
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h4 className={styles.title}>Ensuite</h4>
        <div className={styles.sub} style={{ marginBottom: 0 }}>
          Documents de contexte → onglet <b>Connaissances</b>. Puis <b>Diffuser</b>, et dans{" "}
          <b>Diffusion</b> créez le <b>lien de salon</b> à envoyer à l&apos;équipe.
        </div>
      </div>
    </div>
  );
}
