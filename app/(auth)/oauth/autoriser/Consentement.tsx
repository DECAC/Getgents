"use client";

import { useState } from "react";
import styles from "../../auth.module.css";

/**
 * Les deux boutons du consentement. Envoi par fetch puis navigation par
 * `location` : un formulaire classique redirigé vers claude.ai serait
 * bloqué par `form-action 'self'` (Chrome applique la directive aux
 * redirections qui suivent l'envoi).
 */
export default function Consentement({ parametres }: { parametres: Record<string, string> }) {
  const [envoi, setEnvoi] = useState<"autoriser" | "refuser" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function decider(decision: "autoriser" | "refuser") {
    setEnvoi(decision);
    setErreur(null);
    try {
      const r = await fetch("/api/oauth/autoriser", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parametres, decision }),
      });
      const j = (await r.json().catch(() => ({}))) as { redirection?: string; error?: string };
      if (j.redirection) {
        window.location.assign(j.redirection);
        return;
      }
      throw new Error(r.status === 401 ? "Session expirée : reconnectez-vous, puis recommencez depuis Claude." : j.error || "Erreur du serveur.");
    } catch (e) {
      setErreur((e as Error).message);
      setEnvoi(null);
    }
  }

  return (
    <>
      {erreur && <div className={styles.erreur}>{erreur}</div>}
      <button type="button" className={styles.submit} disabled={envoi !== null} onClick={() => decider("autoriser")}>
        {envoi === "autoriser" ? "Autorisation…" : "Autoriser"}
      </button>
      <button type="button" className={styles.secondaire} disabled={envoi !== null} onClick={() => decider("refuser")}>
        Refuser
      </button>
    </>
  );
}
