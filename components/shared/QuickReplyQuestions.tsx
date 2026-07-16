"use client";

import { useState } from "react";
import type { QuestionBlock } from "@/lib/suggestions";
import styles from "./QuickReplyQuestions.module.css";

interface Props {
  questions: QuestionBlock[];
  onSubmit: (text: string) => void;
}

export function QuickReplyQuestions({ questions, onSubmit }: Props) {
  const [selections, setSelections] = useState<Record<number, string[]>>({});

  const singleRadioQuestion = questions.length === 1 && !questions[0].multi;

  function submitAnswer(qIdx: number, selected: string[]) {
    const q = questions[qIdx];
    const numbered = questions.length > 1;
    const line = `${numbered ? `${qIdx + 1}. ` : ""}${q.q} → ${selected.join(", ")}`;
    onSubmit(line);
    setSelections({});
  }

  function selectOption(qIdx: number, option: string, multi: boolean) {
    if (!multi && questions.length === 1) {
      submitAnswer(qIdx, [option]);
      return;
    }

    setSelections((prev) => {
      const current = prev[qIdx] ?? [];
      if (multi) {
        const next = current.includes(option)
          ? current.filter((o) => o !== option)
          : [...current, option];
        return { ...prev, [qIdx]: next };
      }
      return { ...prev, [qIdx]: [option] };
    });
  }

  function handleSubmit() {
    const numbered = questions.length > 1;
    const lines = questions
      .map((q, i) => {
        const sel = selections[i] ?? [];
        if (!sel.length) return null;
        return `${numbered ? `${i + 1}. ` : ""}${q.q} → ${sel.join(", ")}`;
      })
      .filter((line): line is string => !!line);
    if (!lines.length) return;
    onSubmit(lines.join("\n"));
    setSelections({});
  }

  const hasAnySelection = Object.values(selections).some((arr) => arr.length > 0);
  const numbered = questions.length > 1;

  return (
    <div className={styles.wrap} role="group" aria-label="Réponses proposées">
      {questions.map((q, i) => (
        <fieldset key={i} className={styles.question}>
          <legend className={styles.qLabel}>
            {numbered ? <span className={styles.qNum}>{i + 1}</span> : null}
            {q.q}
          </legend>
          <div className={q.multi ? styles.optionsCheck : styles.optionsRadio}>
            {q.options.map((opt) => {
              const isOn = (selections[i] ?? []).includes(opt);
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
        </fieldset>
      ))}
      {!singleRadioQuestion && hasAnySelection && (
        <button type="button" className={styles.submitBtn} onClick={handleSubmit}>
          Envoyer {questions.length > 1 ? "mes réponses" : "ma réponse"}
        </button>
      )}
    </div>
  );
}
