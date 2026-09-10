"use client";

import { useEffect, useRef, useState } from "react";
import { EspaceProvider, useEspace } from "@/lib/context/EspaceContext";
import { WorkspaceCanvas } from "@/components/center/WorkspaceCanvas";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { ArtefactModal } from "@/components/shared/ArtefactModal";
import { DocumentViewerModal } from "@/components/shared/DocumentViewerModal";
import { FileDownloadControl } from "@/components/shared/FileDownloadControl";
import { SignalerIncident } from "@/components/shared/SignalerIncident";
import { aDesArtefacts, nombreDArtefacts, MESSAGE_ESPACE_VIDE } from "@/lib/espaceArtefacts";
import type { Espace } from "@/lib/types";
import styles from "./SharedGentShell.module.css";

/**
 * Vue « utilisation simple » d'un gent, ouverte par un lien de partage :
 * pleine page, sans rail de navigation, sans aside et sans lien vers le studio.
 * Le destinataire dispose de l'artefact figé (avec ses boutons d'action) et du
 * module conversationnel — rien d'autre.
 *
 * L'agencement reprend délibérément celui de l'espace : conversation à gauche,
 * espace de travail à droite, et les mêmes déclencheurs d'amorce tant que
 * la conversation n'a pas commencé (sur un canevas vierge, ou en bandeau
 * sous l'aperçu d'application).
 * Une mise en page propre au partage désorientait — le destinataire découvrait
 * une interface que le créateur n'avait jamais vue en Preview.
 */
function SharedGentBody({ token }: { token: string }) {
  const { currentEspace, assistantOpen, openAssistant, closeAssistant, miniAppMode, documentViewerOpen } =
    useEspace();

  /**
   * Écran étroit : le canevas est masqué par la feuille de style, et c'est lui
   * qui porte d'ordinaire les questions d'amorce. La conversation doit alors
   * les reprendre — sans quoi le fil s'ouvre vide.
   *
   * Suivi en direct plutôt que lu une fois : une rotation d'appareil fait
   * passer d'un régime à l'autre, et un état figé au montage afficherait les
   * questions en double sur grand écran, ou pas du tout après rotation.
   */
  const [etroit, setEtroit] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 860px)");
    const suivre = () => setEtroit(mq.matches);
    suivre();
    mq.addEventListener("change", suivre);
    return () => mq.removeEventListener("change", suivre);
  }, []);

  // Sur téléphone, la conversation s'ouvre D'EMBLÉE.
  //
  // Le destinataire d'un lien vient pour parler au gent, pas pour lire un
  // écran d'accueil. Sur grand écran l'accueil et la conversation cohabitent ;
  // sur un téléphone ils se disputent la même hauteur, et l'accueil gagnait —
  // il fallait repérer un bouton « Discuter » pour atteindre ce qu'on était
  // venu chercher. Une seule fois : rouvrir de force après une fermeture
  // volontaire empêcherait de revenir à l'accueil.
  useEffect(() => {
    if (miniAppMode) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 860px)").matches) return;
    openAssistant();
    // Volontairement sans `assistantOpen` en dépendance : cet effet ne doit
    // s'exécuter qu'au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miniAppMode]);
  // Un gent en mode mini-application s'utilise par son tableau de bord : le
  // destinataire n'a pas non plus accès à la conversation.
  const chatAvailable = !miniAppMode;
  // Visionneuse ouverte : la conversation y est déjà rendue, à droite du
  // document (voir DocumentViewerModal) — ne pas la monter deux fois.
  const chatOpen = chatAvailable && assistantOpen && !documentViewerOpen;

  /**
   * Le volet d'artefact, à droite de la conversation.
   *
   * Par défaut FERMÉ : la conversation prend toute la largeur. L'agencement
   * précédent réservait en permanence une colonne au canevas, qui restait
   * vide tant que le gent n'avait rien produit — et à moitié vide ensuite,
   * un seul module ne remplissant pas la moitié d'un écran.
   *
   * Il s'ouvre TOUT SEUL quand un artefact arrive : c'est le moment où il a
   * quelque chose à montrer, et le seul où l'interrompre se justifie.
   */
  const [voletOuvert, setVoletOuvert] = useState(false);
  const compte = nombreDArtefacts(currentEspace);
  const comptePrecedent = useRef(compte);
  useEffect(() => {
    // On compare au compte PRÉCÉDENT, pas à zéro : rouvrir le volet à chaque
    // rendu d'un espace déjà garni le rendrait impossible à fermer.
    if (compte > comptePrecedent.current) setVoletOuvert(true);
    comptePrecedent.current = compte;
  }, [compte]);

  const espaceGarni = aDesArtefacts(currentEspace);
  // Deux colonnes seulement si la conversation ET le volet sont là. Sur écran
  // étroit la feuille de style ramène à une colonne : le volet n'a pas la
  // place, et « Le gent » reste le chemin vers le canevas.
  const deuxColonnes = chatOpen && voletOuvert;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <span className={styles.icon}>{currentEspace.icon}</span>
        <div className={styles.headMeta}>
          <h1 className={styles.title}>{currentEspace.gent}</h1>
          <div className={styles.sub}>
            <span className={styles.subObjectif}>{currentEspace.name}</span>
            {/* L'attribution vit ICI, et non seulement dans `CenterHeader` :
                cet en-tête est le seul que voient les destinataires d'un lien
                et les visiteurs d'un gent public — c'est-à-dire exactement le
                public à qui cette mention s'adresse. Elle n'apparaît que si
                elle a une valeur : « Propulsé par » suivi du nom du gent, déjà
                écrit au-dessus, ne dirait rien. */}
            {currentEspace.propulsePar?.trim() && (
              <span className={styles.subAuteur}>
                Propulsé par <b>{currentEspace.propulsePar}</b>
              </span>
            )}
          </div>
        </div>
        <div className={styles.headActions}>
          {/* Bascule permanente entre la conversation et l'espace du gent.
              Sur téléphone la conversation occupe tout l'écran, et le canevas
              — artefacts, documents, tableau de bord — disparaissait sans
              qu'aucun chemin n'y ramène. On ne pouvait plus ni télécharger, ni
              voir ce que le gent avait produit : il fallait deviner qu'un
              bouton de fermeture, dans l'en-tête du panneau, faisait office de
              retour. Ces deux segments disent où l'on est et où l'on peut
              aller, à tout instant. */}
          {chatAvailable && (
            <div className={styles.bascule} role="tablist" aria-label="Affichage">
              <button
                type="button"
                role="tab"
                aria-selected={assistantOpen}
                className={assistantOpen ? styles.basculeOn : undefined}
                onClick={openAssistant}
              >
                Conversation
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!assistantOpen}
                className={!assistantOpen ? styles.basculeOn : undefined}
                onClick={closeAssistant}
              >
                Le gent
              </button>
            </div>
          )}
          <FileDownloadControl variant="shared" />
          <SignalerIncident token={token} />
        </div>
      </header>

      <div
        className={[styles.body, deuxColonnes ? styles.bodyWithChat : "", chatOpen ? styles.bodyChat : ""]
          .filter(Boolean)
          .join(" ")}
      >
        {/* `starters` : sur téléphone le canevas est masqué, et c'est lui qui
            porte d'ordinaire les questions d'amorce. Sans cela, le
            destinataire d'un lien arrivait sur un fil vide — rien à lire,
            rien à toucher, aucune idée de ce qu'on peut demander. */}
        {/* `embedded` sur écran étroit : la grille lui donne déjà toute la
            place, il ne doit pas se comporter en tiroir superposé. Sur grand
            écran il reste une colonne redimensionnable. */}
        {chatOpen && <AssistantPanel starters={etroit || !voletOuvert} embedded={etroit || !voletOuvert} />}
        {/* Le canevas n'est monté que s'il a une place : en volet à côté de la
            conversation, ou en pleine page sous l'onglet « Le gent ». */}
        {(!chatOpen || voletOuvert) && (
        <main className={styles.main}>
          {chatOpen && (
            <div className={styles.voletBarre}>
              <span className={styles.voletTitre}>Ce que le gent a produit</span>
              <button
                type="button"
                className={styles.voletFermer}
                onClick={() => setVoletOuvert(false)}
                // Fermer ne détruit rien : le canevas reste atteignable par
                // « Le gent ». Le dire évite de faire hésiter le visiteur.
                title="Fermer — vous le retrouverez dans « Le gent »"
              >
                Fermer
              </button>
            </div>
          )}
          <div className={styles.mainInner}>
            {/* Même canvas que l'espace : aperçu d'application (avec déclencheurs
                d'amorce tant que la conversation n'a pas commencé) ou ancien
                canevas d'artefacts. Sans lui, un artefact accepté par le
                destinataire était bien enregistré mais ne s'affichait nulle part. */}
            {espaceGarni ? (
              <WorkspaceCanvas espace={currentEspace} />
            ) : (
              /* Un espace vide sans un mot est un cul-de-sac : le visiteur
                 n'a aucune raison d'y revenir. On explique la mécanique. */
              <div className={styles.vide}>
                <p className={styles.videTexte}>{MESSAGE_ESPACE_VIDE}</p>
                {chatAvailable && !assistantOpen && (
                  <button type="button" className={styles.videAction} onClick={openAssistant}>
                    Ouvrir la conversation
                  </button>
                )}
              </div>
            )}
          </div>
        </main>
        )}
      </div>

      <DocumentViewerModal />
      <ArtefactModal />
    </div>
  );
}

export function SharedGentShell({ token, espace }: { token: string; espace: Espace }) {
  return (
    <EspaceProvider initialId="shared" shareToken={token} initialEspaces={{ shared: espace }}>
      <SharedGentBody token={token} />
    </EspaceProvider>
  );
}
