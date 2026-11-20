"use client";

import { useState } from "react";
import { CONTACT_MAX, validerMessage, MESSAGE_CONTACT } from "@/lib/contact";
import styles from "@/app/compte/compte.module.css";

/**
 * « Nous contacter » : une phrase, un champ, un bouton. Le message part par
 * e-mail à l'éditeur ; la réponse arrive à l'adresse du compte.
 *
 * Un échec garde le texte dans le champ : rien n'est stocké côté serveur,
 * effacer le champ ferait perdre le message.
 */
export default function NousContacter({ email }: { email: string | null }) {
  const [texte, setTexte] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const probleme = validerMessage(texte);
    if (probleme) {
      setErreur(MESSAGE_CONTACT[probleme]);
      return;
    }
    setOccupe(true);
    setErreur(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: texte }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(data.error ?? MESSAGE_CONTACT.envoi);
        return;
      }
      setTexte("");
      setEnvoye(true);
    } catch {
      setErreur(MESSAGE_CONTACT.envoi);
    } finally {
      setOccupe(false);
    }
  }

  return (
    <section className={styles.bloc} id="contact">
      <h2 className={styles.sousTitre}>Nous contacter</h2>
      {envoye ? (
        <>
          <p className={styles.message} role="status" style={{ marginTop: 0 }}>
            Merci, votre message est parti.
            {email ? ` Nous vous répondrons à ${email}.` : ""}
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaire} onClick={() => setEnvoye(false)}>
              Écrire un autre message
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={envoyer}>
          <p className={styles.aide}>
            Une question, une idée, quelque chose qui vous a gêné ? Écrivez-nous : chaque message
            est lu, et nous vous répondons par e-mail.
          </p>
          <textarea
            className={styles.champ}
            style={{ width: "100%", minHeight: 120, resize: "vertical", lineHeight: 1.5, display: "block" }}
            value={texte}
            maxLength={CONTACT_MAX}
            onChange={(e) => {
              setTexte(e.target.value);
              if (erreur) setErreur(null);
            }}
            placeholder="Votre message"
            aria-label="Votre message"
          />
          <div className={styles.actions} style={{ justifyContent: "space-between", alignItems: "center" }}>
            <span className={styles.aide} style={{ margin: 0 }}>
              {email ? `Réponse à ${email}` : "Confirmez votre adresse pour recevoir une réponse."}
            </span>
            <button type="submit" className={styles.bouton} disabled={occupe || !texte.trim()}>
              {occupe ? "Envoi…" : "Envoyer"}
            </button>
          </div>
          {erreur && (
            <p className={styles.erreur} role="alert">
              {erreur}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
