"use client";

import { useState } from "react";
import { QUICK_REPLY_OTHER_LABEL, type QuestionBlock } from "@/lib/suggestions";
import styles from "./QuickReplyQuestions.module.css";

interface Props {
  questions: QuestionBlock[];
  onSubmit: (text: string) => void;
}

function optionsWithOther(options: string[]): string[] {
  const trimmed = options.map((o) => o.trim()).filter(Boolean);
  if (trimmed.some((o) => o.toLowerCase() === QUICK_REPLY_OTHER_LABEL.toLowerCase())) return trimmed;
  return [...trimmed, QUICK_REPLY_OTHER_LABEL];
}

export function QuickReplyQuestions({ questions, onSubmit }: Props) {
  const [selections, setSelections] = useState<Record<number, string[]>>({});
  const [otherTexts, setOtherTexts] = useState<Record<number, string>>({});

  const singleRadioQuestion = questions.length === 1 && !questions[0].multi;

  function isOtherOption(option: string): boolean {
    return option.toLowerCase() === QUICK_REPLY_OTHER_LABEL.toLowerCase();
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
        const displayOptions = optionsWithOther(q.options);
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
