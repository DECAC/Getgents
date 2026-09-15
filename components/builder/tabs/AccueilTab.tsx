"use client";

import { useBuilder } from "@/lib/context/BuilderContext";
import styles from "./AccueilTab.module.css";

/**
 * Accueil du gent — l'écran d'arrivée depuis Gent' space. On y choisit ce
 * qu'on fabrique. Le choix PRÉCONFIGURE le gent sans rien verrouiller : les
 * onglets restent accessibles, on peut donc greffer une mini-app sur un
 * gent conversationnel (et l'inverse) après coup.
 */
export function AccueilTab() {
  const { currentDraft, switchTab, updatePinnedArtefact, updateVisionneuse } = useBuilder();
  const miniAppOn = !!currentDraft.pinnedArtefact?.enabled;
  const visionneuseOn = !!currentDraft.visionneuse?.enabled;
  const collabOn = !!currentDraft.collab?.enabled;
  const modeActuel = collabOn
    ? "collaboratif"
    : visionneuseOn
      ? "visionneuse"
      : miniAppOn
        ? "miniapp"
        : "conversationnel";

  function chooseConversationnel() {
    switchTab("conversationnel");
  }

  function chooseMiniApp() {
    if (!miniAppOn) updatePinnedArtefact({ enabled: true });
    switchTab("miniapp");
  }

  function chooseVisionneuse() {
    if (!visionneuseOn) updateVisionneuse({ enabled: true });
    switchTab("visionneuse");
  }

  function chooseCollaboratif() {
    // N'active pas ici : l'onglet Event Manager précharge le gabarit s'il
    // n'y a pas encore de config, sans écraser un gent déjà paramétré.
    switchTab("collaboratif");
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>
        Que voulez-vous construire ? Ce choix vous emmène au bon endroit et prépare la
        configuration — il ne ferme aucune porte : vous pourrez toujours ajouter l&apos;autre mode
        plus tard.
      </p>

      <div className={styles.choices}>
        <button
          type="button"
          className={[styles.choice, modeActuel === "conversationnel" ? styles.choiceOn : ""].filter(Boolean).join(" ")}
          onClick={chooseConversationnel}
        >
          <span className={styles.thumb}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-4.6A8.4 8.4 0 1 1 21 11.5z" />
            </svg>
          </span>
          {modeActuel === "conversationnel" && <span className={styles.activeBadge}>Mode actuel</span>}
          <span className={styles.choiceTitle}>Créer un gent conversationnel</span>
          <span className={styles.choiceDesc}>
            L&apos;utilisateur dialogue avec le gent. Vous définissez son rôle, ses règles, ses
            connaissances et son modèle ; il produit des artefacts quand l&apos;échange s&apos;y
            prête et peut exécuter une routine planifiée.
          </span>
          <span className={styles.choiceFoot}>
            Configurer les instructions
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </button>

        <button
          type="button"
          className={[styles.choice, modeActuel === "miniapp" ? styles.choiceOn : ""].filter(Boolean).join(" ")}
          onClick={chooseMiniApp}
        >
          <span className={styles.thumb}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <rect x="4" y="3" width="16" height="18" rx="2.5" />
              <path d="M8 8h8M8 12h5M8 16h8" />
            </svg>
          </span>
          {modeActuel === "miniapp" && <span className={styles.activeBadge}>Mode actuel</span>}
          <span className={styles.choiceTitle}>Créer une mini app</span>
          <span className={styles.choiceDesc}>
            Pas de conversation : l&apos;utilisateur renseigne quelques entrées (un CV, un lien
            LinkedIn…) et obtient un tableau de bord permanent, qu&apos;un bouton « Update »
            rafraîchit avec de nouvelles données.
          </span>
          <span className={styles.choiceFoot}>
            {modeActuel === "miniapp" ? "Configurer le tableau de bord" : "Activer et configurer"}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </button>

        <button
          type="button"
          className={[styles.choice, modeActuel === "visionneuse" ? styles.choiceOn : ""].filter(Boolean).join(" ")}
          onClick={chooseVisionneuse}
        >
          <span className={styles.thumb}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v18H6.5A2.5 2.5 0 0 1 4 18.5z" />
              <path d="M8 8h7M8 12h7M8 16h4" />
            </svg>
          </span>
          {modeActuel === "visionneuse" && <span className={styles.activeBadge}>Mode actuel</span>}
          <span className={styles.choiceTitle}>Créer une visionneuse</span>
          <span className={styles.choiceDesc}>
            Ni chat vide ni tableau de bord : l&apos;espace s&apos;ouvre directement en pleine page
            sur UN document que vous fixez ici (sommaire, pagination). La conversation reste
            possible, mais toujours au service de la lecture — jamais l&apos;un ou l&apos;autre.
          </span>
          <span className={styles.choiceFoot}>
            {modeActuel === "visionneuse" ? "Configurer le document" : "Activer et configurer"}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </button>

        <button
          type="button"
          className={[styles.choice, modeActuel === "collaboratif" ? styles.choiceOn : ""].filter(Boolean).join(" ")}
          onClick={chooseCollaboratif}
        >
          <span className={styles.thumb}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <circle cx="9" cy="8" r="3" />
              <circle cx="16" cy="9" r="2.5" />
              <path d="M3.5 18.5c.6-2.4 2.4-3.8 5.5-3.8s4.9 1.4 5.5 3.8" />
              <path d="M13 18.5c.5-2 1.8-3.2 3.5-3.2 1.4 0 2.5.8 3 2.2" />
            </svg>
          </span>
          {modeActuel === "collaboratif" && <span className={styles.activeBadge}>Mode actuel</span>}
          <span className={styles.choiceTitle}>Configurer Event Manager</span>
          <span className={styles.choiceDesc}>
            Plusieurs participants dans un salon : le gent collecte les dispos en privé, vérifie
            les options en ligne, propose un choix et tient la synthèse. Pour créer un{" "}
            <b>nouveau</b> Event Manager, utilisez le menu Créer à gauche.
          </span>
          <span className={styles.choiceFoot}>
            {modeActuel === "collaboratif" ? "Configurer la mission" : "Ouvrir Event Manager"}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </button>
      </div>

      <div className={styles.note}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <span>
          <b>Preview</b> ouvre toujours le gent tel qu&apos;il est configuré à l&apos;instant, vos
          dernières modifications comprises. <b>Diffuser le gent</b> est une action distincte :
          elle fige la version que verront les utilisateurs sur les canaux de l&apos;onglet
          Diffusion.
        </span>
      </div>
    </div>
  );
}
