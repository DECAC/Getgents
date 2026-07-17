"use client";

import { useEffect, useMemo, useState } from "react";
import type { RestApiToolConfig, RestApiMethod, RestApiKeyValue, RestApiModelParam } from "@/lib/types";
import modal from "./McpConfigModal.module.css";
import styles from "./RestApiConfigModal.module.css";

interface Props {
  onClose: () => void;
  onSubmit: (values: { name: string; config: RestApiToolConfig }) => void;
}

type AuthMode = "none" | "api-key";
type KeyPlacement = "header" | "query";

interface DraftParam extends RestApiModelParam {
  key: string;
}
interface DraftKeyValue extends RestApiKeyValue {
  key: string;
}

let seq = 0;
const uid = () => `row-${seq++}`;

/**
 * Configuration complète et manuelle d'un connecteur « API REST » : le
 * créateur saisit l'URL, la méthode, les paramètres fixes, la clé API et les
 * paramètres que le modèle renseignera à chaque appel (ex. SerpApi Google
 * Flights). Aucune connaissance technique de la plateforme requise.
 */
export function RestApiConfigModal({ onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [method, setMethod] = useState<RestApiMethod>("GET");
  const [queryParams, setQueryParams] = useState<DraftKeyValue[]>([{ key: uid(), name: "", value: "" }]);
  const [authMode, setAuthMode] = useState<AuthMode>("api-key");
  const [placement, setPlacement] = useState<KeyPlacement>("query");
  const [fieldName, setFieldName] = useState("api_key");
  const [keyValue, setKeyValue] = useState("");
  const [modelParams, setModelParams] = useState<DraftParam[]>([
    { key: uid(), name: "", description: "", required: true, example: "" },
  ]);
  const [responseHint, setResponseHint] = useState("");

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

  const urlValid = useMemo(() => /^https?:\/\/.+/i.test(baseUrl.trim()), [baseUrl]);
  const authValid = authMode === "none" || (fieldName.trim() !== "" && keyValue.trim() !== "");
  const canSubmit = name.trim() !== "" && description.trim() !== "" && urlValid && authValid;

  function updateQuery(key: string, patch: Partial<DraftKeyValue>) {
    setQueryParams((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function updateParam(key: string, patch: Partial<DraftParam>) {
    setModelParams((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const config: RestApiToolConfig = {
      method,
      baseUrl: baseUrl.trim(),
      description: description.trim(),
      queryParams: queryParams
        .filter((q) => q.name.trim() !== "")
        .map((q) => ({ name: q.name.trim(), value: q.value.trim() })),
      headers: [],
      auth:
        authMode === "api-key"
          ? { mode: "api-key", placement, fieldName: fieldName.trim(), value: keyValue.trim() }
          : { mode: "none", placement: "query", fieldName: "", value: "" },
      modelParams: modelParams
        .filter((p) => p.name.trim() !== "")
        .map((p) => ({
          name: p.name.trim(),
          description: p.description.trim(),
          required: p.required,
          example: p.example?.trim() || undefined,
        })),
      responseHint: responseHint.trim() || undefined,
    };
    onSubmit({ name: name.trim(), config });
  }

  return (
    <div
      className={modal.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rest-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={modal.modal}>
        <div className={modal.head}>
          <h3 className={modal.title} id="rest-modal-title">
            Ajouter un connecteur API REST
          </h3>
          <button className={modal.closeBtn} onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className={modal.body}>
          <div className={modal.hero}>
            <div className={modal.heroMark} aria-hidden="true">
              🌐
            </div>
            <div className={modal.heroLabel}>API REST personnalisée</div>
          </div>

          <label className={modal.field}>
            <span className={modal.labelRow}>
              Nom de l&apos;outil <span className={modal.req}>*</span>
            </span>
            <input
              className={modal.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Recherche de vols (Google Flights)"
            />
          </label>

          <label className={modal.field}>
            <span className={modal.labelRow}>
              À quoi sert cet outil / quand l&apos;appeler <span className={modal.req}>*</span>
            </span>
            <textarea
              className={modal.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ex. Renvoie les vols disponibles entre deux aéroports à une date donnée. À appeler dès que l'utilisateur demande des horaires ou des tarifs de vols."
            />
            <span className={modal.hint}>Ce texte guide le modèle : il décide d&apos;appeler l&apos;API à partir de cette description.</span>
          </label>

          <label className={modal.field}>
            <span className={modal.labelRow}>
              URL de base <span className={modal.req}>*</span>
            </span>
            <input
              className={modal.input}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://serpapi.com/search"
            />
            <span className={modal.hint}>
              {baseUrl.trim() && !urlValid
                ? "Entrez une URL complète commençant par http:// ou https://."
                : "L'adresse du point de terminaison, sans les paramètres (ils se saisissent ci-dessous)."}
            </span>
          </label>

          <div className={modal.field}>
            <span className={modal.labelRow}>Méthode HTTP</span>
            <div className={modal.radioRow}>
              <label className={modal.radio}>
                <input type="radio" name="rest-method" checked={method === "GET"} onChange={() => setMethod("GET")} />
                GET (lecture — le plus courant)
              </label>
              <label className={modal.radio}>
                <input type="radio" name="rest-method" checked={method === "POST"} onChange={() => setMethod("POST")} />
                POST
              </label>
            </div>
          </div>

          <div className={modal.field}>
            <span className={styles.sectionLabel}>Paramètres fixes</span>
            <span className={styles.sectionSub}>
              Valeurs toujours envoyées, identiques à chaque appel (ex. engine = google_flights).
            </span>
            {queryParams.map((q) => (
              <div className={styles.kvRow} key={q.key}>
                <input
                  className={modal.input}
                  value={q.name}
                  onChange={(e) => updateQuery(q.key, { name: e.target.value })}
                  placeholder="nom (ex. engine)"
                />
                <input
                  className={modal.input}
                  value={q.value}
                  onChange={(e) => updateQuery(q.key, { value: e.target.value })}
                  placeholder="valeur (ex. google_flights)"
                />
                <button
                  type="button"
                  className={styles.rowDelete}
                  onClick={() => setQueryParams((rows) => rows.filter((r) => r.key !== q.key))}
                  aria-label="Supprimer ce paramètre"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.addRowBtn}
              onClick={() => setQueryParams((rows) => [...rows, { key: uid(), name: "", value: "" }])}
            >
              + Ajouter un paramètre fixe
            </button>
          </div>

          <div className={modal.field}>
            <span className={styles.sectionLabel}>Authentification</span>
            <div className={modal.radioRow}>
              <label className={modal.radio}>
                <input type="radio" name="rest-auth" checked={authMode === "none"} onChange={() => setAuthMode("none")} />
                Aucune
              </label>
              <label className={modal.radio}>
                <input
                  type="radio"
                  name="rest-auth"
                  checked={authMode === "api-key"}
                  onChange={() => setAuthMode("api-key")}
                />
                Clé d&apos;API
              </label>
            </div>

            {authMode === "api-key" && (
              <div className={modal.subPanel}>
                <span className={modal.labelRow}>Emplacement de la clé</span>
                <div className={modal.radioRow}>
                  <label className={modal.radio}>
                    <input
                      type="radio"
                      name="rest-placement"
                      checked={placement === "query"}
                      onChange={() => setPlacement("query")}
                    />
                    Paramètre de requête
                  </label>
                  <label className={modal.radio}>
                    <input
                      type="radio"
                      name="rest-placement"
                      checked={placement === "header"}
                      onChange={() => setPlacement("header")}
                    />
                    En-tête
                  </label>
                </div>

                <label className={modal.field}>
                  <span className={modal.labelRow}>
                    {placement === "header" ? "Nom de l'en-tête" : "Nom du paramètre"} <span className={modal.req}>*</span>
                  </span>
                  <input
                    className={modal.input}
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    placeholder={placement === "header" ? "ex. X-API-Key" : "ex. api_key"}
                  />
                </label>

                <label className={modal.field}>
                  <span className={modal.labelRow}>
                    Clé d&apos;API <span className={modal.req}>*</span>
                  </span>
                  <input
                    className={modal.input}
                    value={keyValue}
                    onChange={(e) => setKeyValue(e.target.value)}
                    placeholder="Collez votre clé, ou env:SERPAPI_KEY"
                  />
                </label>

                <div className={styles.warnBox}>
                  <span aria-hidden="true">🔒</span>
                  <span>
                    Une clé collée ici est enregistrée dans votre navigateur (maquette sans serveur). Pour un vrai secret,
                    saisissez <code>env:NOM_DE_VARIABLE</code> et définissez cette variable d&apos;environnement côté
                    serveur — la clé reste alors hors du navigateur.
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className={modal.field}>
            <span className={styles.sectionLabel}>Paramètres remplis par le gent</span>
            <span className={styles.sectionSub}>
              Les informations que le modèle déduit de la conversation et transmet à chaque appel (ex. aéroport de départ,
              destination, date).
            </span>
            {modelParams.map((p) => (
              <div className={styles.paramRow} key={p.key}>
                <div className={styles.paramHead}>
                  <input
                    className={modal.input}
                    value={p.name}
                    onChange={(e) => updateParam(p.key, { name: e.target.value })}
                    placeholder="nom (ex. departure_id)"
                  />
                  <input
                    className={modal.input}
                    value={p.example ?? ""}
                    onChange={(e) => updateParam(p.key, { example: e.target.value })}
                    placeholder="exemple (ex. CDG)"
                  />
                  <button
                    type="button"
                    className={styles.rowDelete}
                    onClick={() => setModelParams((rows) => rows.filter((r) => r.key !== p.key))}
                    aria-label="Supprimer ce paramètre"
                  >
                    ✕
                  </button>
                </div>
                <input
                  className={modal.input}
                  value={p.description}
                  onChange={(e) => updateParam(p.key, { description: e.target.value })}
                  placeholder="description (ex. code de l'aéroport de départ)"
                />
                <label className={styles.reqCheck}>
                  <input
                    type="checkbox"
                    checked={p.required}
                    onChange={(e) => updateParam(p.key, { required: e.target.checked })}
                  />
                  Obligatoire
                </label>
              </div>
            ))}
            <button
              type="button"
              className={styles.addRowBtn}
              onClick={() =>
                setModelParams((rows) => [...rows, { key: uid(), name: "", description: "", required: false, example: "" }])
              }
            >
              + Ajouter un paramètre
            </button>
          </div>

          <label className={modal.field}>
            <span className={modal.labelRow}>Comment exploiter la réponse (facultatif)</span>
            <textarea
              className={modal.textarea}
              value={responseHint}
              onChange={(e) => setResponseHint(e.target.value)}
              placeholder="ex. Utilise le tableau best_flights : compagnie, heure de départ/arrivée et prix."
            />
          </label>
        </div>

        <div className={modal.foot}>
          <button className={modal.btnGhost} onClick={onClose}>
            Retour
          </button>
          <button className={modal.btnPrim} onClick={handleSubmit} disabled={!canSubmit}>
            Ajouter le connecteur
          </button>
        </div>
      </div>
    </div>
  );
}
