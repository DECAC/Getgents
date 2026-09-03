"use client";

import { useEffect, useRef, useState } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import type { CollabQuestion } from "@/lib/types";
import {
  EVENT_MANAGER_DEFAULT_PROMPT,
  TEAM_BUILDING_MISSION,
  teamBuildingCollabConfig,
} from "@/lib/eventManagerTemplate";
import styles from "./PromptTab.module.css";
import local from "./CollaboratifTab.module.css";

function newQuestionId(): string {
  return `q_${Math.random().toString(36).slice(2, 10)}`;
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

  // État local pour chaque champ "options" d'une question de type "choice" ou "dates" :
  // évite le saut de curseur causé par le re-join à chaque frappe.
  const [choiceDrafts, setChoiceDrafts] = useState<Record<string, string>>({});

  function getChoiceDraft(id: string, options: string[] | undefined): string {
    return id in choiceDrafts ? choiceDrafts[id] : (options ?? []).join(", ");
  }

  function setChoiceDraft(id: string, value: string) {
    setChoiceDrafts((prev) => ({ ...prev, [id]: value }));
  }

  function commitChoiceDraft(id: string) {
    const raw = choiceDrafts[id] ?? "";
    const parsed = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    patchQuestion(id, { options: parsed });
    // Normalise le draft après validation
    setChoiceDrafts((prev) => ({ ...prev, [id]: parsed.join(", ") }));
  }

  useEffect(() => {
    setPromptValue(currentDraft.systemPrompt);
    lastPushedRef.current = currentDraft.systemPrompt;
  }, [currentDraft.id, currentDraft.systemPrompt]);

  useEffect(() => {
    setOptionsCountDraft(String(currentDraft.collab?.propositions?.options ?? 3));
  }, [currentDraft.id, currentDraft.collab?.propositions?.options]);

  // Secours : si le brouillon n'a encore aucune config collab (ex. Accueil),
  // on pose le gabarit. Le menu Créer le pose déjà à l'allocation.
  useEffect(() => {
    if (seededForDraftRef.current === currentDraft.id) return;
    seededForDraftRef.current = currentDraft.id;

    if (currentDraft.collab !== undefined) {
      return;
    }

    const seeded = teamBuildingCollabConfig();
    setPromptValue(EVENT_MANAGER_DEFAULT_PROMPT);
    lastPushedRef.current = EVENT_MANAGER_DEFAULT_PROMPT;
    updateSystemPrompt(EVENT_MANAGER_DEFAULT_PROMPT);
    updateName("Event Manager");
    updateIcon("🧭");
    if (!currentDraft.webSearch) toggleWebSearch();
    updateCollab(seeded);
    setOptionsCountDraft(String(seeded.propositions?.options ?? 3));
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
        <div className={styles.webSearchRow}>
          <div>
            <h4 className={styles.title}>Event Manager</h4>
            <div className={styles.sub} style={{ marginBottom: 0 }}>
              Un gent <b>orchestrateur d&apos;événements</b> : salon commun, collecte en privé,
              vérification web, propositions au vote, synthèse des décisions. Un gabarit{" "}
              <b>team building</b> est préchargé — adaptez-le à votre mission. Diffusez ensuite le{" "}
              <b>lien de salon</b> depuis Diffusion.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!collab?.enabled}
            aria-label="Activer Event Manager"
            className={[styles.switch, collab?.enabled ? styles.switchOn : ""].filter(Boolean).join(" ")}
            onClick={() => updateCollab({ enabled: !collab?.enabled })}
          >
            <span className={styles.knob} />
          </button>
        </div>
        {!collab?.enabled && (
          <div className={styles.sub} style={{ marginTop: 10 }}>
            Event Manager est <b>désactivé</b> sur ce gent. Réactivez-le puis{" "}
            <b>Diffusez les modifications</b> pour que le lien de salon fonctionne.
          </div>
        )}
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
          placeholder={EVENT_MANAGER_DEFAULT_PROMPT}
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
                    value={getChoiceDraft(q.id, q.options)}
                    onChange={(e) => setChoiceDraft(q.id, e.target.value)}
                    onBlur={() => commitChoiceDraft(q.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); commitChoiceDraft(q.id); }
                    }}
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
                      value={getChoiceDraft(q.id, q.options)}
                      onChange={(e) => setChoiceDraft(q.id, e.target.value)}
                      onBlur={() => commitChoiceDraft(q.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); commitChoiceDraft(q.id); }
                      }}
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
                  onChange={() =>
                    updateCollab({ decision: "createur", roleCreateur: "organisateur" })
                  }
                />
                Vous gardez la main (bouton « Retenir », pas de vote ouvert)
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
            <div className={styles.sub} style={{ marginTop: 4, marginBottom: 0 }}>
              Effet uniquement si vous ouvrez le lien <b>connecté</b> à votre compte. Sans compte,
              vous rejoignez toujours comme participant.
            </div>
            <div className={local.radioRow} style={{ marginTop: 8 }}>
              <label className={local.radio}>
                <input
                  type="radio"
                  name="roleCreateur"
                  checked={(collab?.roleCreateur ?? "membre") === "membre"}
                  onChange={() => updateCollab({ roleCreateur: "membre" })}
                />
                Membre comme les autres (pas de badge spécial)
              </label>
              <label className={local.radio}>
                <input
                  type="radio"
                  name="roleCreateur"
                  checked={collab?.roleCreateur === "organisateur"}
                  onChange={() => updateCollab({ roleCreateur: "organisateur" })}
                />
                Organisateur (badge ★ Créateur + pouvoir de retenir une option)
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
