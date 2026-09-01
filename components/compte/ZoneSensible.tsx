"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { basculerCompte } from "@/lib/session/purgeLocalCache";
import styles from "@/app/compte/compte.module.css";

/**
 * Déconnexion et suppression du compte.
 *
 * Les deux gestes sortent du compte ; les réunir évite de disperser à travers
 * la page les seules actions qui font perdre l'accès. La déconnexion existait
 * déjà dans le rail (`MenuCompte`), mais elle n'était joignable que depuis
 * l'atelier : sur un poste partagé, quitter proprement depuis la page de
 * compte est le geste attendu.
 */

interface Decompte {
  gents: number;
  brouillons: number;
  liens: number;
  partages: number;
}

function pluriel(n: number, singulier: string, plurielMot = `${singulier}s`): string {
  return `${n} ${n > 1 ? plurielMot : singulier}`;
}

export default function ZoneSensible({ email }: { email: string | null }) {
  const [decompte, setDecompte] = useState<Decompte | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    fetch("/api/compte")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (vivant && d) setDecompte(d);
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, []);

  async function quitter() {
    setOccupe(true);
    const supabase = getSupabaseBrowser();
    await supabase?.auth.signOut();
    // Purge AVANT la navigation : quitter sans vider le cache laisserait les
    // gents de ce compte sur le disque de la machine, lisibles par le suivant.
    basculerCompte(null);
    window.location.assign("/connexion");
  }

  async function supprimer() {
    setOccupe(true);
    setErreur(null);
    try {
      const res = await fetch("/api/compte", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: confirmation.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(data.error ?? "La suppression a échoué.");
        setOccupe(false);
        return;
      }
      const supabase = getSupabaseBrowser();
      await supabase?.auth.signOut();
      basculerCompte(null);
      window.location.assign("/connexion?compte=supprime");
    } catch {
      setErreur("Le serveur n'a pas répondu. Réessayez.");
      setOccupe(false);
    }
  }

  const parties = decompte
    ? [
        decompte.gents > 0 ? pluriel(decompte.gents, "gent publié", "gents publiés") : null,
        decompte.brouillons > 0 ? pluriel(decompte.brouillons, "brouillon") : null,
        decompte.liens > 0 ? pluriel(decompte.liens, "lien de diffusion") : null,
      ].filter(Boolean)
    : [];

  return (
    <>
      <section className={styles.bloc}>
        <h2 className={styles.sousTitre}>Session</h2>
        <button type="button" className={styles.secondaire} onClick={quitter} disabled={occupe}>
          Se déconnecter
        </button>
      </section>

      <section className={`${styles.bloc} ${styles.danger}`}>
        <h2 className={styles.sousTitre}>Supprimer mon compte</h2>

        <p className={styles.aide}>
          {parties.length
            ? `Seront effacés définitivement : ${parties.join(", ")}, ainsi que vos historiques de conversation.`
            : "Votre compte et tout ce qu'il contient seront effacés définitivement."}
          {decompte && decompte.partages > 0 && (
            <>
              {" "}
              {pluriel(decompte.partages, "personne")} à qui vous avez partagé un gent en
              perdra l'accès.
            </>
          )}{" "}
          Cette action est irréversible.
        </p>

        <div className={styles.ligne}>
          <input
            type="text"
            className={styles.champ}
            placeholder={email ?? "votre adresse e-mail"}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
            aria-label="Saisissez votre adresse e-mail pour confirmer"
          />
          <button
            type="button"
            className={styles.secondaire}
            style={{ color: "var(--plum)" }}
            onClick={supprimer}
            // La confirmation par saisie n'est pas un ornement : ce geste est
            // irréversible, et un bouton seul se clique par accident.
            disabled={occupe || !email || confirmation.trim().toLowerCase() !== email}
          >
            {occupe ? "Suppression…" : "Supprimer définitivement"}
          </button>
        </div>

        {erreur && <p className={styles.erreur}>{erreur}</p>}
      </section>
    </>
  );
}
