"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import styles from "./auth.module.css";

/**
 * Ossature commune aux formulaires d'authentification : état d'envoi, message
 * d'erreur, message de succès. Les écrans ne portent que leur logique propre.
 */
export function AuthForm({
  titre,
  lede,
  bouton,
  onSubmit,
  children,
  aside,
  succes,
}: {
  titre: string;
  lede?: ReactNode;
  bouton: string;
  onSubmit: () => Promise<string | null>;
  children: ReactNode;
  aside?: ReactNode;
  /** Message affiché à la place du formulaire une fois l'action réussie. */
  succes?: (message: string) => ReactNode;
}) {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fini, setFini] = useState<string | null>(null);

  async function handle(e: FormEvent) {
    e.preventDefault();
    if (envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const message = await onSubmit();
      if (message) setFini(message);
    } catch (err) {
      setErreur((err as Error).message || "Une erreur est survenue.");
    } finally {
      setEnvoi(false);
    }
  }

  if (fini && succes) {
    return (
      <>
        <h1 className={styles.title}>{titre}</h1>
        <div className={styles.succes}>{succes(fini)}</div>
        {aside ? <div className={styles.aside}>{aside}</div> : null}
      </>
    );
  }

  return (
    <>
      <h1 className={styles.title}>{titre}</h1>
      {lede ? <p className={styles.lede}>{lede}</p> : null}
      {erreur ? (
        <div className={styles.erreur} role="alert">
          {erreur}
        </div>
      ) : null}
      <form onSubmit={handle} noValidate>
        {children}
        <button type="submit" className={styles.submit} disabled={envoi}>
          {envoi ? "…" : bouton}
        </button>
      </form>
      {aside ? <div className={styles.aside}>{aside}</div> : null}
    </>
  );
}

export function Champ({
  label,
  type,
  value,
  onChange,
  autoComplete,
  required = true,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input
        className={styles.input}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
      />
    </label>
  );
}

export { styles as authStyles };
