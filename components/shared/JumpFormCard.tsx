"use client";

import { useState } from "react";
import type { JumpForm } from "@/lib/types";
import styles from "./JumpFormCard.module.css";

interface Props {
  form: JumpForm;
  onSubmit: (values: Record<string, string>) => void;
  disabled?: boolean;
}

/**
 * Formulaire jump côté utilisateur : affiche les champs définis par le créateur
 * pour lancer le gent en un clic, sans rédiger de prompt. À la soumission, les
 * valeurs sont transmises au parent qui compose et envoie la demande.
 */
export function JumpFormCard({ form, onSubmit, disabled }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});

  const missingRequired = form.fields.some((f) => f.required && !(values[f.id] ?? "").trim());

  function setValue(id: string, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  function handleSubmit() {
    if (missingRequired || disabled) return;
    onSubmit(values);
  }

  return (
    <div className={styles.card}>
      <div className={styles.title}>{form.title}</div>
      {form.description && <div className={styles.desc}>{form.description}</div>}

      <div className={styles.fields}>
        {form.fields.map((f) => (
          <label key={f.id} className={styles.field}>
            <span className={styles.label}>
              {f.label}
              {f.required && <span className={styles.req}> *</span>}
            </span>

            {f.kind === "textarea" ? (
              <textarea
                className={styles.textarea}
                value={values[f.id] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => setValue(f.id, e.target.value)}
              />
            ) : f.kind === "select" ? (
              <select
                className={styles.input}
                value={values[f.id] ?? ""}
                onChange={(e) => setValue(f.id, e.target.value)}
              >
                <option value="">{f.placeholder || "Choisir…"}</option>
                {(f.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={f.kind === "date" ? "date" : "text"}
                className={styles.input}
                value={values[f.id] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => setValue(f.id, e.target.value)}
              />
            )}
          </label>
        ))}
      </div>

      <button
        type="button"
        className={styles.submitBtn}
        onClick={handleSubmit}
        disabled={missingRequired || disabled}
      >
        {form.submitLabel || "Envoyer"}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}
