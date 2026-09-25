"use client";

import { useState } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { draftToEspace } from "@/lib/publishedGents";
import { MAX_STARTER_CHARS } from "@/lib/starterSignal";
import styles from "./PromptTab.module.css";

/**
 * Questions d'amorce — les bulles « Par quoi commencer ? ».
 *
 * Jusqu'ici, la plateforme les générait à la première ouverture d'un espace,
 * les mémorisait, et ne les régénérait PLUS JAMAIS : la condition est
 * littéralement « si des amorces existent, ne rien faire ». Aucun écran ne
 * permettait de les voir, de les corriger ni de les relancer. Le créateur
 * n'avait donc aucune main sur les cinq premières phrases que lit un visiteur.
 *
 * Pire, le générateur reçoit une consigne de style — « rédige-les à la
 * première personne (« Peux-tu… », « Comment… ») » — qui contredit
 * frontalement celle qu'un créateur peut avoir écrite dans son prompt. Ses
 * exemples n'avaient aucune chance d'aboutir.
 *
 * Ce qu'écrit le créateur FAIT FOI : dès qu'une amorce est saisie, le
 * générateur ne s'exécute plus. Vider la liste rend la main à la génération
 * automatique.
 */
export function Amorces() {
  const { currentDraft, currentId, updateStarters, updateAmorcesAuto } = useBuilder();
  const amorces = currentDraft.starters ?? [];
  const aGmail = currentDraft.connectors.some((c) => c.toolKind === "gmail");
  const auto = currentDraft.amorcesAuto !== false;
  const [test, setTest] = useState<{ amorces?: string[]; erreur?: string; messages?: number } | null>(null);
  const [testEnCours, setTestEnCours] = useState(false);

  // Ce que verra le créateur dans SON espace, tout de suite : sans ce test, le
  // seul moyen de vérifier était d'ouvrir une conversation vide et d'attendre.
  async function tester() {
    setTestEnCours(true);
    setTest(null);
    try {
      const res = await fetch("/api/amorces/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gentId: currentId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        amorces?: string[];
        erreur?: string;
        error?: string;
        messages?: number;
      };
      if (!res.ok) {
        setTest({
          erreur:
            data.erreur ??
            (res.status === 401
              ? "Session expirée : reconnectez-vous."
              : data.error === "quota"
                ? "Votre quota horaire est atteint. Réessayez plus tard."
                : `Le test a échoué (${res.status}).`),
        });
        return;
      }
      setTest({ amorces: data.amorces ?? [], messages: data.messages });
    } catch {
      setTest({ erreur: "Le serveur n'a pas répondu. Réessayez." });
    } finally {
      setTestEnCours(false);
    }
  }

  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function modifier(i: number, valeur: string) {
    const suite = [...amorces];
    suite[i] = valeur;
    updateStarters(suite);
  }

  async function regenerer() {
    setOccupe(true);
    setErreur(null);
    try {
      const res = await fetch("/api/starters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ espace: draftToEspace(currentDraft) }),
      });
      const data = (await res.json().catch(() => ({}))) as { starters?: string[]; error?: string };
      if (!res.ok || !data.starters?.length) {
        setErreur(
          data.error === "quota"
            ? "Votre quota horaire est atteint. Réessayez plus tard."
            : "La génération a échoué. Réessayez, ou écrivez vos amorces à la main."
        );
        return;
      }
      updateStarters(data.starters);
    } catch {
      setErreur("Le serveur n'a pas répondu. Réessayez.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className={styles.card}>
      <h4 className={styles.title}>Questions d&apos;amorce</h4>
      <div className={styles.sub}>
        Les bulles proposées au visiteur avant qu&apos;il n&apos;écrive. Tant que cette liste est
        vide, elles sont générées automatiquement à la première ouverture — et plus jamais
        recalculées. Dès que vous en écrivez une, les vôtres font foi.
      </div>

      <ul className={styles.amorceList}>
        {amorces.map((a, i) => (
          <li key={i} className={styles.amorceItem}>
            <input
              type="text"
              className={styles.champ}
              value={a}
              maxLength={MAX_STARTER_CHARS}
              onChange={(e) => modifier(i, e.target.value)}
              aria-label={`Question d'amorce ${i + 1}`}
            />
            <button
              type="button"
              className={styles.amorceRetirer}
              onClick={() => updateStarters(amorces.filter((_, j) => j !== i))}
              aria-label={`Retirer la question ${i + 1}`}
              title="Retirer"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.amorceActions}>
        <button
          type="button"
          className={styles.amorceAjouter}
          onClick={() => updateStarters([...amorces, ""])}
        >
          + Ajouter une question
        </button>
        <button type="button" className={styles.amorceAjouter} disabled={occupe} onClick={regenerer}>
          {occupe ? "Génération…" : amorces.length ? "Régénérer (remplace tout)" : "Proposer des amorces"}
        </button>
      </div>

      {erreur && <p className={styles.amorceErreur}>{erreur}</p>}

      {aGmail && (
        <div className={styles.amorcesAuto}>
          <label className={styles.amorcesAutoLigne}>
            <input
              type="checkbox"
              id="amorces-auto"
              checked={auto}
              onChange={(e) => updateAmorcesAuto(e.target.checked)}
            />
            <span>
              <b>Mise à jour automatique depuis ma boîte mail</b> — dans votre espace personnel, des questions qui
              citent vos expéditeurs et newsletters des 7 derniers jours (objet et expéditeur seulement, jamais le
              contenu), renouvelées toutes les 6 heures. Vos visiteurs ne les voient jamais.
            </span>
          </label>
          <div className={styles.amorceActions}>
            <button type="button" className={styles.amorceAjouter} disabled={testEnCours} onClick={tester}>
              {testEnCours ? "Lecture de la boîte…" : "Tester maintenant"}
            </button>
          </div>
          {test?.erreur && <p className={styles.amorceErreur}>{test.erreur}</p>}
          {test?.amorces && (
            test.amorces.length ? (
              <ul className={styles.amorcesTest}>
                {test.amorces.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.amorceErreur}>
                {test.messages === 0
                  ? "Aucun message reçu ces 7 derniers jours : les amorces habituelles du gent restent affichées."
                  : "Le modèle n'a proposé aucune question exploitable. Réessayez."}
              </p>
            )
          )}
          <p className={styles.sub}>
            Elles apparaissent dans votre espace sur une conversation vide : cliquez « + Nouvel échange ».
            Diffusez le gent pour appliquer ce réglage.
          </p>
        </div>
      )}

      <div className={styles.footRow}>
        <span>
          {amorces.length
            ? `${amorces.length} amorce${amorces.length > 1 ? "s" : ""} — les vôtres, pas celles du modèle.`
            : "Aucune amorce : la plateforme en proposera."}
        </span>
        <span>Rediffusez pour les appliquer en ligne</span>
      </div>
    </div>
  );
}
