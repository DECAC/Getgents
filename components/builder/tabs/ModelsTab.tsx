"use client";

import { useBuilder } from "@/lib/context/BuilderContext";
import { MODEL_CATALOG } from "@/lib/mock-data/builder";
import type { ModelCapability } from "@/lib/types/builder";
import styles from "./ModelsTab.module.css";

const CAPABILITY_META: Record<ModelCapability, { title: string; hint: string; required: boolean }> = {
  chat: {
    title: "Conversation",
    hint: "Le modèle principal, utilisé pour tous les échanges avec l'utilisateur.",
    required: true,
  },
  reasoning: {
    title: "Raisonnement approfondi",
    hint: "Optionnel — utile pour les décisions complexes (planification, calculs).",
    required: false,
  },
  image: {
    title: "Génération d'image",
    hint: "Optionnel — pour produire des aperçus visuels stylisés (ex. Nanobanana).",
    required: false,
  },
  tts: {
    title: "Synthèse vocale (text-to-speech)",
    hint: "Optionnel — pour restituer une réponse à l'oral.",
    required: false,
  },
  stt: {
    title: "Transcription vocale (speech-to-text)",
    hint: "Optionnel — pour accepter des messages vocaux en entrée.",
    required: false,
  },
};

const ORDER: ModelCapability[] = ["chat", "reasoning", "image", "tts", "stt"];

export function ModelsTab() {
  const { currentDraft, assignModel } = useBuilder();

  return (
    <div className={styles.wrap}>
      <div className={styles.apiCard}>
        <div className={styles.apiIc}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6z" />
          </svg>
        </div>
        <div>
          <div className={styles.apiTitle}>Clé API OpenRouter</div>
          <div className={styles.apiSub}>
            Une seule intégration donne accès à tous les modèles ci-dessous, quel que soit le fournisseur.
          </div>
        </div>
        <span className={styles.apiBadge}>Connectée</span>
      </div>

      {ORDER.map((capability) => {
        const meta = CAPABILITY_META[capability];
        const models = MODEL_CATALOG.filter((m) => m.capability === capability);
        const assignment = currentDraft.modelAssignments.find((a) => a.capability === capability);
        const selectedId = assignment?.modelId ?? null;

        return (
          <div className={styles.group} key={capability}>
            <div className={styles.groupHead}>
              <span className={styles.groupTitle}>{meta.title}</span>
              {meta.required ? (
                <span className={styles.groupRequired}>Requis</span>
              ) : (
                <span className={styles.groupOptional}>{meta.hint}</span>
              )}
            </div>
            {meta.required && <div className={styles.groupOptional} style={{ marginBottom: 10, marginTop: -4 }}>{meta.hint}</div>}

            <div className={styles.modelGrid}>
              {!meta.required && (
                <button
                  className={[styles.noneCard, selectedId === null ? styles.selected : ""].filter(Boolean).join(" ")}
                  onClick={() => assignModel(capability, null)}
                >
                  Aucun modèle assigné
                </button>
              )}
              {models.map((model) => (
                <button
                  key={model.id}
                  className={[styles.modelCard, selectedId === model.id ? styles.selected : ""].filter(Boolean).join(" ")}
                  onClick={() => assignModel(capability, model.id)}
                >
                  <div className={styles.modelTop}>
                    <span className={styles.modelLabel}>{model.label}</span>
                    {selectedId === model.id && (
                      <svg className={styles.modelCheck} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                        <path d="M9 11l2 2 4-4" />
                        <circle cx="12" cy="12" r="9" />
                      </svg>
                    )}
                  </div>
                  <div className={styles.modelProvider}>{model.provider}</div>
                  <div className={styles.modelTagline}>{model.tagline}</div>
                  <div className={styles.modelPricing}>
                    ${model.pricing.input}/${model.pricing.output} · 1M tok (in/out)
                    {model.contextWindow ? ` · ${(model.contextWindow / 1000).toFixed(0)}k ctx` : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
