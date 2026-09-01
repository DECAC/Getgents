"use client";

import { useState } from "react";
import styles from "@/app/compte/compte.module.css";

/**
 * Branchement de la clé OpenRouter personnelle.
 *
 * La valeur saisie part vers le serveur et n'en revient JAMAIS : ce composant
 * ne reçoit qu'un indice de quatre caractères. Le champ est vidé dès
 * l'enregistrement réussi — laisser la clé dans le DOM d'une page qu'on garde
 * ouverte n'apporte rien et l'expose à toute extension du navigateur.
 */

export interface EtatCle {
  present: boolean;
  hint: string | null;
  derniereReussite: string | null;
  derniereErreur: string | null;
}

function dateCourte(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function CleOpenRouter({ initial }: { initial: EtatCle }) {
  const [etat, setEtat] = useState<EtatCle>(initial);
  const [saisie, setSaisie] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrer() {
    setOccupe(true);
    setMessage(null);
    setErreur(null);
    try {
      const res = await fetch("/api/compte/cle", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cle: saisie.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(data.error ?? "L'enregistrement a échoué.");
        return;
      }
      setEtat({
        present: true,
        hint: data.hint ?? null,
        derniereReussite: new Date().toISOString(),
        derniereErreur: null,
      });
      setSaisie("");
      setMessage("Clé vérifiée auprès d'OpenRouter et enregistrée.");
    } catch {
      setErreur("Le serveur n'a pas répondu. Réessayez.");
    } finally {
      setOccupe(false);
    }
  }

  async function retirer() {
    setOccupe(true);
    setMessage(null);
    setErreur(null);
    try {
      const res = await fetch("/api/compte/cle", { method: "DELETE" });
      if (!res.ok) {
        setErreur("Le retrait a échoué.");
        return;
      }
      setEtat({ present: false, hint: null, derniereReussite: null, derniereErreur: null });
      setMessage("Clé retirée. Vos gents repassent sur la clé de la plateforme, sous plafond horaire.");
    } catch {
      setErreur("Le serveur n'a pas répondu. Réessayez.");
    } finally {
      setOccupe(false);
    }
  }

  const acceptee = dateCourte(etat.derniereReussite);

  return (
    <section className={styles.bloc}>
      <h2 className={styles.sousTitre}>Clé OpenRouter</h2>
      <p className={styles.aide}>
        Branchez votre propre clé pour que vos gents appellent les modèles de votre choix,
        facturés sur votre compte OpenRouter — sans plafond horaire de notre côté. Sans clé,
        ils utilisent celle de la plateforme, avec les plafonds ci-dessous.
      </p>

      {etat.present && (
        <>
          <div className={styles.ligne}>
            <span className={styles.indice}>{etat.hint ?? "…"}</span>
            <button type="button" className={styles.retirer} onClick={retirer} disabled={occupe}>
              Retirer cette clé
            </button>
          </div>
          {acceptee && <p className={styles.aide}>Acceptée par OpenRouter le {acceptee}.</p>}
          {etat.derniereErreur && <p className={styles.erreur}>{etat.derniereErreur}</p>}
        </>
      )}

      <div className={styles.ligne}>
        <input
          type="password"
          className={styles.champ}
          placeholder="sk-or-…"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-label="Clé OpenRouter"
        />
        <button
          type="button"
          className={styles.bouton}
          onClick={enregistrer}
          disabled={occupe || !saisie.trim()}
        >
          {occupe ? "Vérification…" : etat.present ? "Remplacer" : "Enregistrer"}
        </button>
      </div>
      <p className={styles.aide}>
        Créez-la sur{" "}
        <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer noopener">
          openrouter.ai/keys
        </a>
        . Elle est chiffrée avant d'être stockée et ne vous sera jamais réaffichée.
      </p>

      {message && <p className={styles.message}>{message}</p>}
      {erreur && <p className={styles.erreur}>{erreur}</p>}
    </section>
  );
}
