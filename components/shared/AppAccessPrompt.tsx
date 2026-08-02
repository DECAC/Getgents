"use client";

import { useState } from "react";
import { writeAppSecret } from "@/lib/appAccess";
import styles from "./AppAccessPrompt.module.css";

/**
 * Remplace le refus 401 « unauthorized » par un moyen direct de s'authentifier
 * : coller la clé APP_ACCESS_SECRET ici l'enregistre immédiatement, sans
 * l'astuce ?key=… dans l'URL — utile quand l'erreur survient depuis un onglet
 * déjà profondément ouvert (ex. l'onglet Diffusion du builder).
 */
export function AppAccessPrompt({ onSaved }: { onSaved: () => void }) {
  const [value, setValue] = useState("");

  function save() {
    const secret = value.trim();
    if (!secret) return;
    writeAppSecret(secret);
    setValue("");
    onSaved();
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.text}>
        Accès protégé par une clé (APP_ACCESS_SECRET) que ce navigateur n&apos;a pas encore. Collez-la
        ci-dessous — elle est mémorisée pour les prochaines fois.
      </p>
      <div className={styles.row}>
        <input
          type="password"
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Clé d'accès"
          aria-label="Clé d'accès APP_ACCESS_SECRET"
          autoFocus
        />
        <button type="button" className={styles.btn} onClick={save} disabled={!value.trim()}>
          Enregistrer
        </button>
      </div>
    </div>
  );
}
