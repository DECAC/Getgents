"use client";

import { useCallback, useEffect, useState } from "react";
import { useEspace } from "@/lib/context/EspaceContext";
import { SafeHTMLDoc } from "./SafeHTML";
import { MiniBarChart } from "./MiniBarChart";
import { ChecklistView } from "./ChecklistView";
import { MapArtefact } from "./MapArtefact";
import { DashboardArtefact } from "./dashboard/DashboardArtefact";
import { ReportArtefact } from "./ReportArtefact";
import { ImageArtefact } from "./ImageArtefact";
import { ProfileSummaryArtefact } from "./ProfileSummaryArtefact";
import { ArtefactWorkspaceActions } from "./ArtefactWorkspaceActions";
import { ArtefactIcon } from "./ArtefactIcon";
import { hasReportBody } from "@/lib/reportArtefact";
import type { Artefact } from "@/lib/types";
import styles from "./Modal.module.css";

function VisualGrid() {
  return (
    <div className={styles.visualGrid}>
      <div>
        <svg viewBox="0 0 200 190">
          <rect width="200" height="190" fill="#CFE0DD" />
          <rect y="120" width="200" height="70" fill="#A9C6BE" />
          <rect x="20" y="80" width="26" height="44" fill="#E8C66B" />
          <rect x="52" y="70" width="26" height="54" fill="#E0A05C" />
          <rect x="84" y="88" width="26" height="36" fill="#D88B7A" />
          <rect x="116" y="74" width="26" height="50" fill="#E8C66B" />
          <rect x="148" y="92" width="26" height="32" fill="#C97A6A" />
          <circle cx="160" cy="35" r="16" fill="#F2DDA0" />
        </svg>
      </div>
      <div>
        <svg viewBox="0 0 95 90">
          <rect width="95" height="90" fill="#B9D4D8" />
          <path d="M0 60 L30 35 L60 55 L95 30 L95 90 L0 90 Z" fill="#7FA8A0" />
        </svg>
      </div>
      <div>
        <svg viewBox="0 0 95 90">
          <rect width="95" height="90" fill="#E4D9C4" />
          <circle cx="48" cy="45" r="22" fill="none" stroke="#B7956A" strokeWidth="3" />
          <path d="M20 70 Q48 50 76 70" fill="none" stroke="#9C7B52" strokeWidth="3" />
        </svg>
      </div>
    </div>
  );
}

/**
 * Le CORPS d'un artefact, sans cadre ni commandes.
 *
 * Extrait pour que la fenetre plein ecran ET le volet lateral montrent
 * exactement le meme rendu. Deux rendus separes divergeraient a la premiere
 * evolution — et c'est precisement ce qu'un aperçu ne doit pas faire : ce que
 * l'on garde doit etre ce que l'on a vu.
 *
 * `interactif` a false pour un APERÇU en attente de verdict : l'artefact
 * n'existe pas encore dans l'espace, donc cocher une case ou lancer une
 * generation d'image n'aurait rien a quoi s'accrocher.
 */
export function ArtefactCorps({
  artefact,
  interactif,
}: {
  artefact: Artefact;
  interactif: boolean;
}) {
  const { toggleChecklistItem, userPosition, generateProfileSummaryMedia } = useEspace();
  const isReport = hasReportBody(artefact);
  return (
    <>
      {artefact.dashboard && <DashboardArtefact spec={artefact.dashboard} />}
      {artefact.profileSummary && (
        <ProfileSummaryArtefact
          summary={artefact.profileSummary}
          artefactId={artefact.id}
          canGenerate={interactif}
          onGenerateMedia={
            interactif ? (mediaId) => generateProfileSummaryMedia(artefact.id, mediaId) : undefined
          }
        />
      )}
      {artefact.imageUrl && (
        <ImageArtefact
          src={artefact.imageUrl}
          alt={artefact.title}
          caption={artefact.imageCaption}
          source={artefact.imageSource}
        />
      )}
      {artefact.visual && !artefact.imageUrl && !artefact.profileSummary && (
        <div className={styles.visualWrap}>
          <VisualGrid />
        </div>
      )}
      {artefact.chartData && <MiniBarChart data={artefact.chartData} />}
      {artefact.mapPoints && (
        <MapArtefact points={artefact.mapPoints} height={380} userPosition={userPosition} />
      )}
      {artefact.checklistItems && (
        <ChecklistView
          items={artefact.checklistItems}
          onToggle={interactif ? (i) => toggleChecklistItem(artefact.id, i) : () => undefined}
        />
      )}
      {isReport ? (
        <ReportArtefact artefact={artefact} />
      ) : (
        artefact.body && !artefact.imageUrl && !artefact.profileSummary && (
          <SafeHTMLDoc html={artefact.body} />
        )
      )}
    </>
  );
}

export function ArtefactModal() {
  const {
    currentEspace,
    modalArtefactId,
    pendingArtefactVerdict,
    closeModal,
    toggleChecklistItem,
    userPosition,
    removeArtefact,
    generateProfileSummaryMedia,
    confirmArtefactProposal,
    verdictEnVolet,
  } = useEspace();

  const isVerdict = !!pendingArtefactVerdict;

  const artefact = pendingArtefactVerdict
    ? pendingArtefactVerdict.preview
    : modalArtefactId
      ? currentEspace.artefacts.find((a) => a.id === modalArtefactId) ?? null
      : null;

  // Fermer sans choisir = Jeter : évite de laisser l'espace pollué ou
  // l'utilisateur coincé avec une popup sans décision.
  /**
   * Téléchargement PDF par l'impression du navigateur.
   *
   * Aucune dépendance ajoutée, et le résultat est un vrai PDF : la boîte
   * d'impression propose « Enregistrer au format PDF » sur tous les systèmes.
   * L'ancien bouton était un `alert("non implémenté")`.
   *
   * La classe pose l'isolation : sans elle, c'est la page ENTIÈRE qui part à
   * l'imprimante — conversation comprise. Elle est retirée après coup, y
   * compris si l'utilisateur annule (`afterprint` se déclenche aussi).
   */
  /**
   * « Recharger » RE-REND l'artefact tel qu'il est enregistre. Aucun appel au
   * modele, donc aucun cout et aucune attente.
   *
   * Ce n'est pas une regeneration, et c'est voulu : un contenu different se
   * demande DANS la conversation, ou l'on peut dire ce qu'on veut de plus.
   * Ici, on repare un RENDU qui s'est mal passe — un graphique monte a largeur
   * nulle, une carte qui n'a pas pris, une image en echec. Changer la cle
   * remonte le sous-arbre, ce qui refait exactement ce travail-la.
   */
  const [cleRendu, setCleRendu] = useState(0);

  const imprimer = useCallback(() => {
    const corps = document.body;
    corps.classList.add("impressionArtefact");
    const nettoyer = () => {
      corps.classList.remove("impressionArtefact");
      window.removeEventListener("afterprint", nettoyer);
    };
    window.addEventListener("afterprint", nettoyer);
    window.print();
    // Filet : certains navigateurs n'émettent pas `afterprint`.
    window.setTimeout(nettoyer, 1000);
  }, []);

  const dismissOrClose = useCallback(() => {
    if (pendingArtefactVerdict) {
      confirmArtefactProposal(pendingArtefactVerdict.proposalMessageId, "dismiss");
      return;
    }
    closeModal();
  }, [pendingArtefactVerdict, confirmArtefactProposal, closeModal]);

  /**
   * La fenetre s'ouvre-t-elle VRAIMENT ? Question distincte de « un artefact
   * existe-t-il ». En mode volet, un apercu en attente de verdict n'ouvre
   * aucune fenetre — et les effets ci-dessous doivent le savoir, sans quoi ils
   * bloquent le defilement de la page et capturent la touche Echap pour une
   * fenetre invisible.
   */
  const afficheFenetre = !!artefact && !(isVerdict && verdictEnVolet);

  useEffect(() => {
    if (afficheFenetre) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [afficheFenetre]);

  useEffect(() => {
    if (!afficheFenetre) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismissOrClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [afficheFenetre, dismissOrClose]);

  /**
   * Un artefact fraichement produit ne s'impose PLUS en fenetre plein ecran.
   *
   * Il apparaissait par-dessus la conversation, exigeant « Garder » ou
   * « Jeter » avant qu'on ait pu relire ce qui venait d'etre dit — une
   * decision demandee au pire moment, sur un artefact qu'on n'avait pas
   * encore lu. Il s'affiche desormais dans le volet lateral, ou il attend
   * sans rien bloquer.
   *
   * Le drapeau est pose par la coquille qui possede un volet. Ailleurs — un
   * ecran sans volet — la fenetre reste le seul chemin, et rien ne change.
   */
  if (!afficheFenetre || !artefact) return null;

  const isDashboard = !!artefact.dashboard;
  const isReport = hasReportBody(artefact);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) dismissOrClose(); }}
    >
      <div
        // Repère pour l'impression : seul ce sous-arbre reste visible quand le
        // navigateur imprime — voir `@media print` dans globals.css.
        data-impression="artefact"
        className={[styles.modal, isDashboard || isReport ? styles.modalWide : ""].filter(Boolean).join(" ")}
      >
        <div className={styles.head}>
          <ArtefactIcon icon={artefact.icon} className={styles.ti} />
          <div>
            <h3 className={styles.title} id="modal-title">{artefact.title}</h3>
            <div className={styles.meta}>
              <span className={styles.typePill}>{artefact.type}</span>
              <span>{artefact.date}</span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={dismissOrClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <ArtefactCorps key={cleRendu} artefact={artefact} interactif={!isVerdict} />
        </div>

        {isVerdict && pendingArtefactVerdict ? (
          <div className={[styles.foot, styles.footVerdict].join(" ")}>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => confirmArtefactProposal(pendingArtefactVerdict.proposalMessageId, "dismiss")}
            >
              Jeter
            </button>
            <button
              type="button"
              className={styles.btnPrim}
              onClick={() => confirmArtefactProposal(pendingArtefactVerdict.proposalMessageId, "add")}
            >
              Garder dans l&apos;espace
            </button>
          </div>
        ) : (
          <div className={styles.foot}>
            <span className={styles.footLabel}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6z" />
              </svg>
              Généré par Getgents
            </span>
            {/*
              Trois actions, pas davantage.
              « Retirer de l'espace » est parti : fermer l'artefact depuis
              l'espace du gent fait déjà exactement cela, et deux chemins vers
              une suppression valent une suppression accidentelle.
              « Mettre à jour » et l'ancien « Exporter en PDF » étaient des
              `alert("non implémenté")` — un bouton qui ment est pire qu'un
              bouton absent.
            */}
            <button type="button" className={styles.btnGhost} onClick={closeModal}>
              Fermer
            </button>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => setCleRendu((k) => k + 1)}
              title="Réafficher l'artefact — utile si un graphique ou une carte s'est mal affiché"
            >
              Recharger
            </button>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={imprimer}
              title="Ouvre l'impression du navigateur — choisir « Enregistrer au format PDF »"
            >
              Télécharger en PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
