"use client";

import { useState } from "react";
import styles from "@/app/compte/compte.module.css";

/**
 * Adresse e-mail et mot de passe.
 *
 * Les deux formulaires vivent dans un même composant parce qu'ils partagent
 * un état — un changement d'adresse en attente change ce qu'on peut dire de
 * l'identité du compte — et parce que les séparer imposerait au lecteur deux
 * fichiers pour comprendre un seul bloc à l'écran.
 */

export default function Identifiants({
  email,
  nomAffiche,
}: {
  email: string | null;
  nomAffiche: string;
}) {
  const [nom, setNom] = useState(nomAffiche);
  const [nouvelEmail, setNouvelEmail] = useState("");
  const [enAttente, setEnAttente] = useState<string | null>(null);
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(url: string, methode: string, corps: unknown, succes: () => string) {
    setOccupe(true);
    setMessage(null);
    setErreur(null);
    try {
      const res = await fetch(url, {
        method: methode,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(data.error ?? "L'opération a échoué.");
        return;
      }
      setMessage(succes());
    } catch {
      setErreur("Le serveur n'a pas répondu. Réessayez.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <section className={styles.bloc}>
      <h2 className={styles.sousTitre}>Identifiants</h2>

      {/* Le nom vient en premier : c'est le seul de ces trois champs qui soit
          PUBLIC. Il apparaît sous « Proposé par » sur chaque gent publié, et
          le dire ici évite qu'on le découvre en ligne. */}
      <dl className={styles.liste}>
        <dt>Nom affiché</dt>
        <dd>{nom.trim() || "aucun — vos gents publiés ne porteront pas d'attribution"}</dd>
      </dl>

      <div className={styles.actions}>
        <input
          type="text"
          className={styles.champ}
          placeholder="Prénom Nom, ou nom d'entreprise"
          value={nom}
          maxLength={60}
          onChange={(e) => setNom(e.target.value)}
          aria-label="Nom affiché publiquement"
        />
        <button
          type="button"
          className={styles.bouton}
          disabled={occupe}
          onClick={() =>
            envoyer("/api/compte/nom", "PATCH", { nom }, () =>
              nom.trim() ? "Nom enregistré." : "Attribution retirée de vos gents publiés."
            )
          }
        >
          Enregistrer
        </button>
      </div>
      <p className={styles.aide}>
        Visible de tous sous vos gents publiés. Un gent peut porter un autre nom, réglé dans son
        studio.
      </p>

      <dl className={styles.liste}>
        <dt>Adresse e-mail</dt>
        <dd>{email ?? "adresse non confirmée"}</dd>
      </dl>

      <div className={styles.actions}>
        <input
          type="email"
          className={styles.champ}
          placeholder="nouvelle adresse"
          value={nouvelEmail}
          onChange={(e) => setNouvelEmail(e.target.value)}
          autoComplete="email"
          aria-label="Nouvelle adresse e-mail"
        />
        <button
          type="button"
          className={styles.secondaire}
          disabled={occupe || !nouvelEmail.trim()}
          onClick={() => {
            const cible = nouvelEmail.trim().toLowerCase();
            void envoyer("/api/compte/email", "PATCH", { email: cible }, () => {
              setEnAttente(cible);
              setNouvelEmail("");
              return `Un e-mail de confirmation part vers ${cible}. Votre adresse actuelle reste active tant que vous n'avez pas cliqué le lien.`;
            });
          }}
        >
          Changer d'adresse
        </button>
      </div>
      {enAttente && <p className={styles.aide}>Changement en attente de confirmation : {enAttente}.</p>}

      <div className={styles.actions}>
        <input
          type="password"
          className={styles.champ}
          placeholder="mot de passe actuel"
          value={actuel}
          onChange={(e) => setActuel(e.target.value)}
          autoComplete="current-password"
          aria-label="Mot de passe actuel"
        />
        <input
          type="password"
          className={styles.champ}
          placeholder="nouveau mot de passe"
          value={nouveau}
          onChange={(e) => setNouveau(e.target.value)}
          autoComplete="new-password"
          aria-label="Nouveau mot de passe"
        />
        <button
          type="button"
          className={styles.secondaire}
          disabled={occupe || !actuel || !nouveau}
          onClick={() =>
            void envoyer("/api/compte/motdepasse", "PATCH", { actuel, nouveau }, () => {
              setActuel("");
              setNouveau("");
              return "Mot de passe changé.";
            })
          }
        >
          Changer le mot de passe
        </button>
      </div>
      <p className={styles.aide} style={{ marginTop: 10, marginBottom: 0 }}>
        Le mot de passe actuel est demandé pour prouver que c'est bien vous : sans lui, une
        session laissée ouverte suffirait à s'emparer du compte.
      </p>

      {message && <p className={styles.message}>{message}</p>}
      {erreur && <p className={styles.erreur}>{erreur}</p>}
    </section>
  );
}
