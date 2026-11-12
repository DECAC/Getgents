"use client";

import { useState } from "react";
import AssistantDocument from "./AssistantDocument";
import styles from "./partage.module.css";

/**
 * Corps de la page d'un partage : le cadre de l'artefact, et l'assistant à
 * côté s'il est activé. Sur téléphone, une bascule Document / Assistant —
 * les deux ne tiennent pas côte à côte. Le cadre reste MONTÉ quand on passe
 * à l'assistant (masqué, pas retiré) : l'artefact garde son état.
 */
export default function VuePartage({
  jeton,
  titre,
  assistant,
  amorces,
  bandeau,
}: {
  jeton: string;
  titre: string;
  assistant: boolean;
  amorces: string[];
  bandeau: React.ReactNode;
}) {
  const [vue, setVue] = useState<"document" | "assistant">("document");
  return (
    <div className={styles.page}>
      <header className={styles.bandeau}>
        {bandeau}
        {assistant && (
          <div className={styles.bascule} role="tablist">
            <button type="button" role="tab" aria-selected={vue === "document"} className={vue === "document" ? styles.basculeActive : ""} onClick={() => setVue("document")}>
              Document
            </button>
            <button type="button" role="tab" aria-selected={vue === "assistant"} className={vue === "assistant" ? styles.basculeActive : ""} onClick={() => setVue("assistant")}>
              Assistant
            </button>
          </div>
        )}
      </header>
      <div className={styles.corps} data-vue={vue}>
        <iframe
          className={styles.cadre}
          src={`/api/partage/${encodeURIComponent(jeton)}/contenu`}
          title={titre}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-downloads"
          referrerPolicy="no-referrer"
        />
        {assistant && <AssistantDocument jeton={jeton} amorces={amorces} />}
      </div>
    </div>
  );
}
