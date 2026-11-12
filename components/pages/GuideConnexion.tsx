"use client";

import { useEffect, useState } from "react";
import styles from "./pages.module.css";

/**
 * Comment une page arrive ici : par le connecteur, depuis Claude. Écran
 * vide d'un nouveau venu, et entrée « Connecter Claude / ChatGPT » du rail.
 * ChatGPT et Mistral n'y figurent pas tant que leur connexion n'a pas été
 * essayée — annoncer un geste qui ne marche pas serait pire que de se taire.
 */
export function GuideConnexion({ titre = "Partagez ce que vous créez avec l'IA" }: { titre?: string }) {
  const [copie, setCopie] = useState(false);
  // L'adresse du site qui sert la page, lue APRÈS le rendu : la calculer
  // pendant le rendu donnait deux textes différents (serveur / navigateur).
  const [adresse, setAdresse] = useState("https://getgents.ai/api/mcp");
  useEffect(() => setAdresse(`${window.location.origin}/api/mcp`), []);
  return (
    <section className={styles.guide}>
      <h2 className={styles.guideTitre}>{titre}</h2>
      <p className={styles.guideLede}>
        Une page, un devis, une présentation ou un jeu créé dans Claude : partagez-le à un client par un lien privé, et retrouvez ici à qui vous
        l&apos;avez envoyé.
      </p>
      <ol className={styles.etapes}>
        <li>
          <b>Ajoutez le connecteur Getgents dans Claude</b>
          <span>Paramètres → Connecteurs → Ajouter un connecteur personnalisé, avec cette adresse :</span>
          <span className={styles.adresse}>
            <code>{adresse}</code>
            <button
              type="button"
              className={styles.secondaire}
              onClick={() => {
                void navigator.clipboard?.writeText(adresse).then(() => {
                  setCopie(true);
                  window.setTimeout(() => setCopie(false), 1800);
                });
              }}
            >
              {copie ? "Copiée" : "Copier"}
            </button>
          </span>
        </li>
        <li>
          <b>Autorisez Getgents</b>
          <span>Claude ouvre une page Getgents : connectez-vous et cliquez « Autoriser ».</span>
        </li>
        <li>
          <b>Demandez « partage cette page à marie@… »</b>
          <span>Claude vous rend le lien privé et le mail à envoyer. La page apparaît ici.</span>
        </li>
      </ol>
      <p className={styles.guideNote}>ChatGPT et Mistral : bientôt, une fois leur connexion essayée.</p>
    </section>
  );
}
