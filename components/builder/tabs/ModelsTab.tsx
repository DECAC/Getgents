"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { MODEL_CATALOG } from "@/lib/mock-data/builder";
import type { ModelCapability } from "@/lib/types/builder";
import styles from "./ModelsTab.module.css";

const CAPABILITY_META: Record<ModelCapability, { title: string; required: boolean }> = {
  chat: { title: "Conversation", required: true },
  reasoning: { title: "Raisonnement approfondi", required: false },
  image: { title: "Génération d'image", required: false },
  tts: { title: "Synthèse vocale (text-to-speech)", required: false },
  stt: { title: "Transcription vocale (speech-to-text)", required: false },
};

const ORDER: ModelCapability[] = ["chat", "reasoning", "image", "tts", "stt"];

export function ModelsTab() {
  const { currentDraft, assignModel } = useBuilder();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setQuery("");
  }, [open]);

  const assignmentByCapability = useMemo(() => {
    const map = new Map<ModelCapability, string | null>();
    currentDraft.modelAssignments.forEach((a) => map.set(a.capability, a.modelId));
    return map;
  }, [currentDraft.modelAssignments]);

  const normalizedQuery = query.trim().toLowerCase();

  const groups = useMemo(
    () =>
      ORDER.map((capability) => ({
        capability,
        models: MODEL_CATALOG.filter(
          (m) =>
            m.capability === capability &&
            (normalizedQuery === "" ||
              m.label.toLowerCase().includes(normalizedQuery) ||
              m.provider.toLowerCase().includes(normalizedQuery))
        ),
      })),
    [normalizedQuery]
  );

  const selectedChips = ORDER.map((capability) => {
    const modelId = assignmentByCapability.get(capability) ?? null;
    const model = modelId ? MODEL_CATALOG.find((m) => m.id === modelId) ?? null : null;
    return { capability, model };
  }).filter((c) => c.model);

  const chatMissing = !assignmentByCapability.get("chat");

  return (
    <div className={styles.wrap}>
      <div className={styles.group}>
        <div className={styles.groupHead}>
          <span className={styles.groupTitle}>Modèles du gent</span>
          {chatMissing && <span className={styles.groupRequired}>Conversation requise</span>}
        </div>

        <div className={styles.combo} ref={wrapRef}>
          <button
            type="button"
            className={styles.comboTrigger}
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            {selectedChips.length === 0 ? (
              <span className={styles.comboPlaceholder}>Choisir un ou plusieurs modèles…</span>
            ) : (
              <span className={styles.comboChips}>
                {selectedChips.map(({ capability, model }) => (
                  <span className={styles.chip} key={capability}>
                    <span className={styles.chipCap}>{CAPABILITY_META[capability].title}</span>
                    <span className={styles.chipLabel}>{model!.label}</span>
                    {!CAPABILITY_META[capability].required && (
                      <span
                        className={styles.chipRemove}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          assignModel(capability, null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation();
                            assignModel(capability, null);
                          }
                        }}
                        aria-label={`Retirer ${model!.label}`}
                      >
                        ×
                      </span>
                    )}
                  </span>
                ))}
              </span>
            )}
            <svg className={styles.comboCaret} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {open && (
            <div className={styles.comboPanel} role="listbox">
              <div className={styles.comboSearchWrap}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                <input
                  ref={searchRef}
                  className={styles.comboSearch}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher un modèle par nom…"
                  aria-label="Rechercher un modèle par nom"
                />
              </div>

              <div className={styles.comboList}>
                {groups.map(({ capability, models }) => {
                  const meta = CAPABILITY_META[capability];
                  const selectedId = assignmentByCapability.get(capability) ?? null;
                  if (normalizedQuery && models.length === 0) return null;

                  return (
                    <div className={styles.comboGroup} key={capability}>
                      <div className={styles.comboGroupHead}>
                        <span>{meta.title}</span>
                        {meta.required && <span className={styles.comboRequiredDot}>Requis</span>}
                      </div>

                      {!meta.required && !normalizedQuery && (
                        <button
                          type="button"
                          className={[styles.comboOption, selectedId === null ? styles.comboOptionActive : ""]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => assignModel(capability, null)}
                        >
                          <span className={styles.comboOptionLabel}>Aucun modèle assigné</span>
                        </button>
                      )}

                      {models.map((model) => {
                        const selected = selectedId === model.id;
                        return (
                          <button
                            type="button"
                            key={model.id}
                            className={[styles.comboOption, selected ? styles.comboOptionActive : ""]
                              .filter(Boolean)
                              .join(" ")}
                            onClick={() => assignModel(capability, model.id)}
                          >
                            <span className={styles.comboOptionMain}>
                              <span className={styles.comboOptionLabel}>{model.label}</span>
                              <span className={styles.comboOptionProvider}>{model.provider}</span>
                            </span>
                            <span className={styles.comboOptionTagline}>{model.tagline}</span>
                            {selected && (
                              <svg
                                className={styles.comboCheck}
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                              >
                                <path d="M9 11l2 2 4-4" />
                                <circle cx="12" cy="12" r="9" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}

                {normalizedQuery && groups.every((g) => g.models.length === 0) && (
                  <div className={styles.comboEmpty}>Aucun modèle ne correspond à « {query} ».</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
