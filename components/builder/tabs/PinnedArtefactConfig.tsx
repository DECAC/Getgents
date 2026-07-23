"use client";

import { useBuilder } from "@/lib/context/BuilderContext";
import type { PinnedArtefactInput } from "@/lib/types";
import styles from "./PinnedArtefactConfig.module.css";

const INPUT_KINDS: { kind: PinnedArtefactInput["kind"]; label: string }[] = [
  { kind: "url", label: "Lien (URL)" },
  { kind: "file", label: "Fichier" },
  { kind: "text", label: "Texte" },
];

/**
 * Config « artefact figé » côté builder : le créateur transforme le gent en
 * mini-application — un tableau de bord permanent dont l'utilisateur rafraîchit
 * les données d'un bouton, à partir d'entrées limitées (LinkedIn, CV…).
 */
export function PinnedArtefactConfig() {
  const { currentDraft, updatePinnedArtefact } = useBuilder();
  const pinned = currentDraft.pinnedArtefact;

  function addInput() {
    const inputs = [
      ...(pinned?.inputs ?? []),
      { id: `in-${Date.now()}`, label: "", kind: "url" as const },
    ];
    updatePinnedArtefact({ inputs });
  }
  function patchInput(id: string, patch: Partial<PinnedArtefactInput>) {
    const inputs = (pinned?.inputs ?? []).map((i) => (i.id === id ? { ...i, ...patch } : i));
    updatePinnedArtefact({ inputs });
  }
  function removeInput(id: string) {
    updatePinnedArtefact({ inputs: (pinned?.inputs ?? []).filter((i) => i.id !== id) });
  }

  return (
    <div className={styles.card}>
      <div className={styles.headRow}>
        <div>
          <h4 className={styles.title}>Artefact figé — mode mini-application</h4>
          <div className={styles.sub}>
            Le gent produit un <b>tableau de bord permanent</b> au rendu figé ; l&apos;utilisateur ne
            converse pas, il fournit quelques entrées (lien LinkedIn, CV…) et rafraîchit les données
            d&apos;un bouton <b>Update</b>. Idéal pour un usage « app », pas « chat ».
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!pinned?.enabled}
          className={[styles.switch, pinned?.enabled ? styles.switchOn : ""].filter(Boolean).join(" ")}
          onClick={() => updatePinnedArtefact({ enabled: !pinned?.enabled })}
          aria-label="Activer le mode artefact figé"
        >
          <span className={styles.knob} />
        </button>
      </div>

      {pinned?.enabled && (
        <div className={styles.config}>
          <label className={styles.fieldLabel} htmlFor="pin-title">
            Titre de l&apos;artefact
          </label>
          <input
            id="pin-title"
            className={styles.input}
            placeholder="ex. Tableau de bord carrière"
            value={pinned.title}
            onChange={(e) => updatePinnedArtefact({ title: e.target.value })}
            aria-label="Titre de l'artefact figé"
          />

          <label className={styles.fieldLabel} htmlFor="pin-mission">
            Mission de génération (le « prompt figé »)
          </label>
          <textarea
            id="pin-mission"
            className={styles.mission}
            placeholder={
              "Décris le tableau de bord à produire à chaque génération : sections, indicateurs clés, tableaux… Ex. : Analyse le profil et produis un tableau de bord carrière — diagnostic de positionnement, opportunités classées par fit, réseau, actions prioritaires."
            }
            value={pinned.mission}
            onChange={(e) => updatePinnedArtefact({ mission: e.target.value })}
            aria-label="Mission de l'artefact figé"
          />

          <div className={styles.inputsHead}>
            <span className={styles.fieldLabel}>Entrées demandées à l&apos;utilisateur</span>
            <button type="button" className={styles.addBtn} onClick={addInput}>
              + Ajouter une entrée
            </button>
          </div>
          {(pinned.inputs ?? []).length === 0 && (
            <div className={styles.emptyInputs}>
              Aucune entrée : le gent générera à partir du seul profil / contexte. Ajoutez-en pour
              exiger un lien LinkedIn, un CV…
            </div>
          )}
          {(pinned.inputs ?? []).map((inp) => (
            <div className={styles.inputRow} key={inp.id}>
              <input
                className={styles.inputLabelField}
                placeholder="Libellé (ex. Profil LinkedIn)"
                value={inp.label}
                onChange={(e) => patchInput(inp.id, { label: e.target.value })}
                aria-label="Libellé de l'entrée"
              />
              <select
                className={styles.inputKind}
                value={inp.kind}
                onChange={(e) => patchInput(inp.id, { kind: e.target.value as PinnedArtefactInput["kind"] })}
                aria-label="Type de l'entrée"
              >
                {INPUT_KINDS.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => removeInput(inp.id)}
                aria-label={`Retirer l'entrée ${inp.label || ""}`}
              >
                ✕
              </button>
            </div>
          ))}

          <div className={styles.hint}>
            Activez la recherche web (onglet Prompt) pour que les données soient réelles et
            vérifiées. La première ouverture côté utilisateur génère l&apos;artefact ; le bouton
            <b> Update </b> le rafraîchit ensuite sans reformulation.
          </div>
        </div>
      )}
    </div>
  );
}
