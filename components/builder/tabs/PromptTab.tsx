"use client";

import { useRef, useState, useEffect } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { ModelsTab } from "./ModelsTab";
import styles from "./PromptTab.module.css";

/**
 * Prompt & modèle : ce avec quoi le gent pense.
 *
 * Ces deux réglages vivaient dans l'onglet « Gent Conversationnel », en tête.
 * On ne pouvait pas le deviner : ce libellé nomme un TYPE de gent — par
 * opposition à Mini App ou Visionneuse — et non un endroit où l'on configure.
 * Le code lui-même devait l'expliquer, le rail affichant « Rédigez les
 * instructions système (onglet Gent Conversationnel) » quand le prompt
 * manquait. Quand une interface doit préciser entre parenthèses où se trouve
 * une chose, c'est que son étiquette ne suffit pas.
 *
 * Ils sont donc remontés sous « Configuration du gent », avec les connecteurs
 * et les connaissances — la famille des choses qu'on règle, quel que soit le
 * type du gent. L'onglet conversationnel garde ce qui lui est propre :
 * recherche web, routine, téléchargement, artefacts.
 */
export function PromptTab() {
  const { currentDraft, updateSystemPrompt } = useBuilder();
  const wordCount = currentDraft.systemPrompt.trim().split(/\s+/).filter(Boolean).length;

  // Valeur locale découplée des re-rendus du contexte (ex. streaming de
  // l'assistant du builder) : sans ça, chaque frappe pouvait interrompre une
  // composition de caractère accentué en cours (le navigateur reset le champ
  // au milieu d'une séquence de touche morte), donnant des accents mangés.
  const [promptValue, setPromptValue] = useState(currentDraft.systemPrompt);
  const lastPushedRef = useRef(currentDraft.systemPrompt);

  useEffect(() => {
    setPromptValue(currentDraft.systemPrompt);
    lastPushedRef.current = currentDraft.systemPrompt;
  }, [currentDraft.id, currentDraft.systemPrompt]);

  function handlePromptChange(text: string) {
    setPromptValue(text);
    lastPushedRef.current = text;
    updateSystemPrompt(text);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h4 className={styles.title}>Instructions système (prompt)</h4>
        <div className={styles.sub}>
          Ce texte définit le comportement du gent en production. Décrivez son rôle, ses règles
          impératives (ex. invariants de sécurité) et le ton attendu — l&apos;assistant du builder
          peut vous aider à le rédiger.
        </div>
        <textarea
          className={styles.promptArea}
          value={promptValue}
          onChange={(e) => handlePromptChange(e.target.value)}
          placeholder={
            "Tu es [nom du gent] de Getgents.\n\nObjectif : ...\n\nRègles impératives :\n- ...\n- ..."
          }
          aria-label="Prompt système du gent"
        />
        <div className={styles.footRow}>
          <span>{wordCount} mot{wordCount !== 1 ? "s" : ""}</span>
          <span>Modifiable à tout moment — versionné à chaque publication</span>
        </div>
      </div>

      <div className={styles.sectionHead}>
        <h4 className={styles.title}>Modèles</h4>
        <div className={styles.sub}>
          Le modèle utilisé par ce gent se choisit ici, capacité par capacité.
        </div>
      </div>
      <ModelsTab />
    </div>
  );
}
