"use client";

import { useEffect, useState } from "react";
import styles from "./McpConfigModal.module.css";

type AuthMode = "none" | "api-key" | "oauth2";
type ApiKeyPlacement = "header" | "query";

interface Props {
  onClose: () => void;
  onSubmit: (values: { name: string; description: string; url: string }) => void;
}

export function McpConfigModal({ onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("api-key");
  const [keyPlacement, setKeyPlacement] = useState<ApiKeyPlacement>("header");
  const [fieldName, setFieldName] = useState("");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const needsFieldName = authMode === "api-key";
  const canSubmit =
    name.trim() !== "" && description.trim() !== "" && url.trim() !== "" && (!needsFieldName || fieldName.trim() !== "");

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({ name: name.trim(), description: description.trim(), url: url.trim() });
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mcp-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <div className={styles.head}>
          <h3 className={styles.title} id="mcp-modal-title">
            Ajouter un serveur Model Context Protocol
          </h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.hero}>
            <div className={styles.heroMark} aria-hidden="true">
              🔗
            </div>
            <div className={styles.heroLabel}>Model Context Protocol</div>
          </div>

          <label className={styles.field}>
            <span className={styles.labelRow}>
              Nom du serveur <span className={styles.req}>*</span>
            </span>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom du serveur…"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.labelRow}>
              Description du serveur <span className={styles.req}>*</span>
            </span>
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description de l'objectif de l'action du serveur…"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.labelRow}>
              URL du serveur
              <span className={styles.infoDot} title="Point de terminaison accessible publiquement, en HTTPS.">
                ⓘ
              </span>
              <span className={styles.req}>*</span>
            </span>
            <input
              className={styles.input}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Point de terminaison diffusable"
            />
            <span className={styles.hint}>Entrez le chemin d&apos;accès complet au serveur pour continuer.</span>
          </label>

          <div className={styles.field}>
            <span className={styles.labelRow}>Authentification</span>
            <div className={styles.radioRow}>
              <label className={styles.radio}>
                <input
                  type="radio"
                  name="auth-mode"
                  checked={authMode === "none"}
                  onChange={() => setAuthMode("none")}
                />
                Aucun
              </label>
              <label className={styles.radio}>
                <input
                  type="radio"
                  name="auth-mode"
                  checked={authMode === "api-key"}
                  onChange={() => setAuthMode("api-key")}
                />
                Clé d&apos;API
              </label>
              <label className={[styles.radio, styles.radioDisabled].join(" ")}>
                <input type="radio" name="auth-mode" checked={false} disabled onChange={() => {}} />
                OAuth 2.0
                <span className={styles.inactiveTag}>Inactif pour le moment</span>
              </label>
            </div>
          </div>

          {authMode === "api-key" && (
            <div className={styles.subPanel}>
              <span className={styles.labelRow}>Type</span>
              <div className={styles.radioRow}>
                <label className={styles.radio}>
                  <input
                    type="radio"
                    name="key-placement"
                    checked={keyPlacement === "header"}
                    onChange={() => setKeyPlacement("header")}
                  />
                  En-tête
                </label>
                <label className={styles.radio}>
                  <input
                    type="radio"
                    name="key-placement"
                    checked={keyPlacement === "query"}
                    onChange={() => setKeyPlacement("query")}
                  />
                  Requête
                </label>
              </div>

              <label className={styles.field}>
                <span className={styles.labelRow}>
                  {keyPlacement === "header" ? "Nom de l'en-tête" : "Nom du paramètre"} <span className={styles.req}>*</span>
                </span>
                <input
                  className={styles.input}
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  placeholder={keyPlacement === "header" ? "ex. X-API-Key" : "ex. api_key"}
                />
              </label>
            </div>
          )}
        </div>

        <div className={styles.foot}>
          <button className={styles.btnGhost} onClick={onClose}>
            Retour
          </button>
          <button className={styles.btnPrim} onClick={handleSubmit} disabled={!canSubmit}>
            Ajouter le serveur
          </button>
        </div>
      </div>
    </div>
  );
}
