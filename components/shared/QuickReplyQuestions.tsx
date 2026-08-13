"use client";

import { useState } from "react";
import { QUICK_REPLY_OTHER_LABEL, QUICK_REPLY_TRUST_LABEL, type QuestionBlock } from "@/lib/suggestions";
import styles from "./QuickReplyQuestions.module.css";

interface Props {
  questions: QuestionBlock[];
  onSubmit: (text: string) => void;
  /**
   * Ajoute « Fais-moi confiance » aux options. Réservé aux questions de
   * cadrage de l'assistant du builder : sur une question ordinaire, laisser
   * l'assistant trancher n'a pas de sens, et le composant est partagé avec
   * l'espace utilisateur.
   */
  showTrust?: boolean;
}

function optionsWithUiOptions(options: string[], showTrust: boolean): string[] {
  const trimmed = options.map((o) => o.trim()).filter(Boolean);
  const out = trimmed.some((o) => o.toLowerCase() === QUICK_REPLY_OTHER_LABEL.toLowerCase())
    ? [...trimmed]
    : [...trimmed, QUICK_REPLY_OTHER_LABEL];
  if (showTrust && !out.some((o) => o.toLowerCase() === QUICK_REPLY_TRUST_LABEL.toLowerCase())) {
    out.push(QUICK_REPLY_TRUST_LABEL);
  }
  return out;
}

export function QuickReplyQuestions({ questions, onSubmit, showTrust = false }: Props) {
  const [selections, setSelections] = useState<Record<number, string[]>>({});
  const [otherTexts, setOtherTexts] = useState<Record<number, string>>({});

  const singleRadioQuestion = questions.length === 1 && !questions[0].multi;

  function isOtherOption(option: string): boolean {
    return option.toLowerCase() === QUICK_REPLY_OTHER_LABEL.toLowerCase();
  }

  function isTrustOption(option: string): boolean {
    return option.toLowerCase() === QUICK_REPLY_TRUST_LABEL.toLowerCase();
  }

  function submitAnswer(qIdx: number, selected: string[]) {
    const q = questions[qIdx];
    const numbered = questions.length > 1;
    const line = `${numbered ? `${qIdx + 1}. ` : ""}${q.q} → ${selected.join(", ")}`;
    onSubmit(line);
    setSelections({});
    setOtherTexts({});
  }

  function selectOption(qIdx: number, option: string, multi: boolean) {
    // « Fais-moi confiance » est une réponse en soi : on l'envoie tout de suite,
    // sans demander de confirmation supplémentaire — c'est tout l'intérêt.
    if (isTrustOption(option)) {
      submitAnswer(qIdx, [option]);
      return;
    }
    if (isOtherOption(option)) {
      setSelections((prev) => ({ ...prev, [qIdx]: [option] }));
      return;
    }

    if (!multi && questions.length === 1) {
      submitAnswer(qIdx, [option]);
      return;
    }

    setSelections((prev) => {
      const current = prev[qIdx] ?? [];
      if (multi) {
        const withoutOther = current.filter((o) => !isOtherOption(o));
        const next = withoutOther.includes(option)
          ? withoutOther.filter((o) => o !== option)
          : [...withoutOther, option];
        return { ...prev, [qIdx]: next };
      }
      return { ...prev, [qIdx]: [option] };
    });
    setOtherTexts((prev) => {
      const next = { ...prev };
      delete next[qIdx];
      return next;
    });
  }

  function submitOther(qIdx: number) {
    const custom = otherTexts[qIdx]?.trim();
    if (!custom) return;
    submitAnswer(qIdx, [custom]);
  }

  function handleSubmit() {
    const numbered = questions.length > 1;
    const lines = questions
      .map((q, i) => {
        const sel = selections[i] ?? [];
        if (!sel.length) return null;
        const otherSelected = sel.some(isOtherOption);
        const value = otherSelected ? otherTexts[i]?.trim() : sel.join(", ");
        if (!value) return null;
        return `${numbered ? `${i + 1}. ` : ""}${q.q} → ${value}`;
      })
      .filter((line): line is string => !!line);
    if (!lines.length) return;
    onSubmit(lines.join("\n"));
    setSelections({});
    setOtherTexts({});
  }

  const hasAnySelection = Object.values(selections).some((arr) => arr.length > 0);
  const numbered = questions.length > 1;

  return (
    <div className={styles.wrap} role="group" aria-label="Réponses proposées">
      {questions.map((q, i) => {
        const displayOptions = optionsWithUiOptions(q.options, showTrust);
        const selected = selections[i] ?? [];
        const otherActive = selected.some(isOtherOption);

        return (
          <fieldset key={i} className={styles.question}>
            <legend className={styles.qLabel}>
              {numbered ? <span className={styles.qNum}>{i + 1}</span> : null}
              {q.q}
            </legend>
            <div className={q.multi ? styles.optionsCheck : styles.optionsRadio}>
              {displayOptions.map((opt) => {
                const isOn = selected.includes(opt);
                const inputType = q.multi ? "checkbox" : "radio";
                const inputName = q.multi ? undefined : `quick-reply-${i}`;

                return (
                  <label
                    key={opt}
                    className={[styles.optionRow, isOn ? styles.optionRowOn : ""].filter(Boolean).join(" ")}
                  >
                    <input
                      type={inputType}
                      name={inputName}
                      className={styles.optionInput}
                      checked={isOn}
                      onChange={() => selectOption(i, opt, !!q.multi)}
                    />
                    <span className={styles.optionLabel}>{opt}</span>
                  </label>
                );
              })}
            </div>
            {otherActive && (
              <div className={styles.otherWrap}>
                <textarea
                  className={styles.otherInput}
                  rows={2}
                  placeholder="Précisez votre réponse…"
                  value={otherTexts[i] ?? ""}
                  onChange={(e) => setOtherTexts((prev) => ({ ...prev, [i]: e.target.value }))}
                />
                <button
                  type="button"
                  className={styles.submitBtn}
                  disabled={!otherTexts[i]?.trim()}
                  onClick={() => submitOther(i)}
                >
                  Envoyer ma réponse
                </button>
              </div>
            )}
          </fieldset>
        );
      })}
      {!singleRadioQuestion && hasAnySelection && !questions.some((_, i) => (selections[i] ?? []).some(isOtherOption)) && (
        <button type="button" className={styles.submitBtn} onClick={handleSubmit}>
          Envoyer {questions.length > 1 ? "mes réponses" : "ma réponse"}
        </button>
      )}
    </div>
  );
}
