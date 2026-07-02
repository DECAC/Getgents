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

  function toggleOption(qIdx: number, option: string, multi: boolean) {
    setSelections((prev) => {
      const current = prev[qIdx] ?? [];
      if (multi) {
        const next = current.includes(option)
          ? current.filter((o) => o !== option)
          : [...current, option];
        return { ...prev, [qIdx]: next };
      }
      return { ...prev, [qIdx]: current.includes(option) ? [] : [option] };
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
    <div className={styles.wrap}>
      {questions.map((q, i) => (
        <div key={i} className={styles.question}>
          <div className={styles.qLabel}>
            {numbered ? <span className={styles.qNum}>{i + 1}</span> : null}
            {q.q}
          </div>
          <div className={styles.options}>
            {q.options.map((opt) => {
              const isOn = (selections[i] ?? []).includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  className={[styles.chip, isOn ? styles.chipOn : ""].filter(Boolean).join(" ")}
                  onClick={() => toggleOption(i, opt, !!q.multi)}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {hasAnySelection && (
        <button type="button" className={styles.submitBtn} onClick={handleSubmit}>
          Envoyer mes réponses
        </button>
      )}
    </div>
  );
}
