"use client";

import { useState } from "react";
import { useBuilder, type BuilderTab } from "@/lib/context/BuilderContext";
import { BUILD_STEP_TAB, buildPlanProgress, computeBuildPlan } from "@/lib/buildPlan";
import styles from "./BuildPlanChecklist.module.css";

/**
 * Plan de construction du gent, replié en tête de l'assistant.
 *
 * Placé ici plutôt que dans le rail : l'assistant est présent sur TOUS les
 * onglets, donc le créateur garde son avancement sous les yeux où qu'il soit.
 * Une étape non faite est cliquable et l'emmène au bon endroit.
 */
export function BuildPlanChecklist() {
  const { currentDraft, switchTab } = useBuilder();
  const [open, setOpen] = useState(false);

  const plan = computeBuildPlan(currentDraft);
  const { done, total } = buildPlanProgress(currentDraft);
  const complete = done === total;

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.head}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Ce qui est configuré, ce qui manque"
      >
        <span className={[styles.gauge, complete ? styles.gaugeOk : ""].filter(Boolean).join(" ")}>
          {done}/{total}
        </span>
        <span className={styles.headLabel}>
          {complete ? "Gent prêt à diffuser" : "Plan de construction"}
        </span>
        <svg
          className={styles.chevron}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul className={styles.list}>
          {plan.map((step) => (
            <li key={step.id}>
              <button
                type="button"
                className={[styles.step, step.done ? styles.stepDone : ""].filter(Boolean).join(" ")}
                onClick={() => switchTab(BUILD_STEP_TAB[step.id] as BuilderTab)}
                title={step.hint}
              >
                <span className={styles.mark} aria-hidden="true">
                  {step.done ? "✓" : "○"}
                </span>
                <span className={styles.stepLabel}>{step.label}</span>
                {step.optional && !step.done && <span className={styles.optional}>facultatif</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
