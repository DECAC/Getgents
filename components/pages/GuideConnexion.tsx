"use client";

import { useEffect, useState } from "react";
import { ASSISTANTS, GUIDES, type Assistant } from "@/lib/guidesAssistants";
import styles from "./pages.module.css";

/**
 * « Connecter un assistant IA » : un onglet par assistant (`lib/guidesAssistants.ts`),
 * deux chemins dans chacun. Pour Claude, le connecteur d'abord (essayé) ;
 * pour les autres, le copier-coller d'abord (il marche partout), et le
 * connecteur annoncé comme NON essayé.
 */
export function GuideConnexion({ assistant, onNouvelle }: { assistant: Assistant; onNouvelle?: () => void }) {
  const [copie, setCopie] = useState(false);
  // L'adresse du site qui sert la page, lue APRÈS le rendu : la calculer
  // pendant le rendu donnait deux textes différents (serveur / navigateur).
  const [adresse, setAdresse] = useState("https://getgents.ai/api/mcp");
  useEffect(() => setAdresse(`${window.location.origin}/api/mcp`), []);
  const g = GUIDES[assistant];

  const coller = (
    <div className={styles.guideBloc} key="coller">
      <h3 className={styles.guideSousTitre}>
        Copier-coller le code <span className={styles.chipOk}>✓ Marche avec l&apos;offre gratuite</span>
      </h3>
      <ol className={styles.etapes}>
        {g.coller.map((e) => (
          <li key={e}>
            <span>{e}</span>
          </li>
        ))}
      </ol>
      {onNouvelle && (
        <button type="button" className={styles.principal} onClick={onNouvelle} style={{ alignSelf: "flex-start" }}>
          + Nouvelle page
        </button>
      )}
    </div>
  );

  const connecteur = (
    <div className={styles.guideBloc} key="connecteur">
      <h3 className={styles.guideSousTitre}>
        Partager depuis la conversation (connecteur){" "}
        {g.connecteurEssaye ? (
          <span className={styles.chipOk}>✓ Essayé</span>
        ) : (
          <span className={styles.pastilleGrise}>Pas encore essayé par Getgents</span>
        )}
      </h3>
      <p className={styles.guideLede}>{g.connecteurCondition}</p>
      <ol className={styles.etapes}>
        {g.connecteur.map((e) => (
          <li key={e}>
            <span>{e}</span>
          </li>
        ))}
      </ol>
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
      {!g.connecteurEssaye && (
        <p className={styles.guideNote}>Si la connexion échoue, le copier-coller reste disponible : rien n&apos;est perdu.</p>
      )}
    </div>
  );

  return (
    <section className={styles.guide}>
      <h2 className={styles.guideTitre}>Connecter {g.nom} à Getgents</h2>
      <div className={styles.filtreQuestions} role="tablist" aria-label="Assistant">
        {ASSISTANTS.map((a) => (
          <a
            key={a}
            role="tab"
            aria-selected={a === assistant}
            href={`/pages?guide=${a}`}
            style={{ textDecoration: "none" }}
            className={styles.ongletAssistant}
          >
            {GUIDES[a].nom}
          </a>
        ))}
      </div>
      {g.connecteurEssaye ? [connecteur, coller] : [coller, connecteur]}
    </section>
  );
}
