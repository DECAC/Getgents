"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adresseDirecte, useCadreAvecRepli } from "@/components/shared/useCadreAvecRepli";
import { useStockagePartage } from "@/components/shared/useStockagePartage";
import AssistantDocument from "./AssistantDocument";
import Confidentialite from "./Confidentialite";
import EngagementLecteur from "./EngagementLecteur";
import { ChoixPrenom } from "./ChoixPrenom";
import { cleInvite, clePrenom, inviteDeLaListe } from "@/lib/groupesPages";
import type { LectureJointe } from "@/lib/engagement";
import { textes, type Langue } from "@/lib/langueLecteur";
import { ChoixLangue } from "./ChoixLangue";
import styles from "./partage.module.css";

/** La bulle « Une question sur ce document ? » ne s'affiche qu'une fois par navigateur. */
const CLE_BULLE = "getgents:partage:bulleVue";
const DELAI_BULLE_MS = 3000;

/** Identifiant d'une visite : tiré à chaque ouverture. */
function nouvelleVisite(): string {
  const o = new Uint8Array(16);
  crypto.getRandomValues(o);
  return Array.from(o, (x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Mesure de lecture (19/11 : plus de fenêtre de consentement). UNE ouverture
 * ANONYME par visite, envoyée tout de suite : ni lien, ni durée, ni appareil.
 * Le détail de la visite EN COURS (début, durée onglet visible, partie lue)
 * est mesuré ICI, dans la page, sans rien envoyer ni garder dans le
 * navigateur : il ne part qu'avec une réponse au bouton d'engagement, si le
 * lecteur coche « Joindre ma lecture ». `mesure()` le rend à cet instant.
 */
function useLecture(jeton: string, cadre: React.RefObject<HTMLIFrameElement | null>): () => LectureJointe {
  const etat = useRef({ debut: new Date().toISOString(), duree: 0, depuis: 0, profondeur: null as number | null });

  useEffect(() => {
    const e = etat.current;
    e.debut = new Date().toISOString();
    e.depuis = document.visibilityState === "visible" ? Date.now() : 0;
    const corps = JSON.stringify({ visite: nouvelleVisite(), consentement: false, duree: 0, profondeur: null });
    fetch(`/api/partage/${encodeURIComponent(jeton)}/lecture`, { method: "POST", headers: { "Content-Type": "application/json" }, body: corps, keepalive: true }).catch(() => {});

    const surMessage = (ev: MessageEvent) => {
      // Seul NOTRE cadre parle : un autre onglet ou une publicité n'écrit pas la mesure.
      if (ev.source !== cadre.current?.contentWindow) return;
      const d = ev.data as { getgents?: string; v?: unknown };
      if (d?.getgents === "profondeur" && typeof d.v === "number") e.profondeur = Math.max(e.profondeur ?? 0, Math.min(100, Math.round(d.v)));
    };
    const surVisibilite = () => {
      if (document.visibilityState === "hidden") {
        if (e.depuis) e.duree += (Date.now() - e.depuis) / 1000;
        e.depuis = 0;
      } else e.depuis = Date.now();
    };
    window.addEventListener("message", surMessage);
    document.addEventListener("visibilitychange", surVisibilite);
    // Le document a pu donner sa profondeur avant qu'on l'écoute : on la lui redemande.
    cadre.current?.contentWindow?.postMessage({ getgents: "profondeur?" }, "*");
    return () => {
      window.removeEventListener("message", surMessage);
      document.removeEventListener("visibilitychange", surVisibilite);
    };
  }, [jeton, cadre]);

  return useCallback(() => {
    const e = etat.current;
    const duree = e.duree + (e.depuis ? (Date.now() - e.depuis) / 1000 : 0);
    return { debut: e.debut, duree: Math.round(duree), profondeur: e.profondeur };
  }, []);
}

/**
 * Corps de la page d'un partage : le cadre de l'artefact et, s'il est activé,
 * l'assistant du document.
 *
 * Replié (à l'arrivée) : le document prend toute la page, un bouton flottant
 * en bas à droite l'annonce. Ouvert : document et assistant deviennent deux
 * cartes DÉTACHÉES côte à côte, le document se resserre — on consulte en
 * posant ses questions. Sous 1 000 px, l'assistant passe au-dessus du
 * document ; sur téléphone, il occupe la moitié basse et le document reste
 * utilisable au-dessus.
 *
 * Le cadre n'est JAMAIS démonté : changer sa taille ne le recharge pas,
 * l'artefact garde son état. L'assistant non plus : replier garde le fil.
 */
export default function VuePartage({
  jeton,
  titre,
  assistant,
  amorces,
  bandeau,
  auteur,
  protegee,
  engagement,
  destinataire,
  dejaRepondu,
  groupe,
  langue,
}: {
  jeton: string;
  titre: string;
  assistant: boolean;
  amorces: string[];
  bandeau: React.ReactNode;
  /** Nom de l'auteur : montré dans « Vos données sur cette page » seulement. */
  auteur: string | null;
  protegee: boolean;
  /** Bouton d'engagement réglé par l'auteur, ou null. */
  engagement: { intitule: string; mot: boolean } | null;
  destinataire: string;
  dejaRepondu: boolean;
  /** Lien de groupe : ses invités et ceux qui ont déjà répondu. */
  groupe: { nom: string; invites: string[]; repondus: string[] } | null;
  /** Langue de l'habillage (lot anglais 1). */
  langue: Langue;
}) {
  const t = textes(langue);
  const cadre = useRef<HTMLIFrameElement>(null);
  const srcDocument = `/api/partage/${encodeURIComponent(jeton)}/contenu`;
  // Domaine de contenu bloqué (filtre d'entreprise) : rechargement depuis getgents.ai.
  const repli = useCadreAvecRepli(srcDocument, cadre);
  const [conf, setConf] = useState(false);

  // Lien de groupe : le prénom choisi sur CET appareil (fonctionnel, rien n'est envoyé avant une réponse).
  const [prenom, setPrenom] = useState<string | null>(null);
  const [prenomLu, setPrenomLu] = useState(!groupe);
  const [changer, setChanger] = useState(false);
  const [repondus, setRepondus] = useState<string[]>(groupe?.repondus ?? []);
  useEffect(() => {
    if (!groupe) return;
    let p: string | null = null;
    try {
      p = inviteDeLaListe(groupe.invites, localStorage.getItem(clePrenom(jeton)));
    } catch {
      /* stockage fermé : on redemandera */
    }
    setPrenom(p);
    setPrenomLu(true);
  }, [groupe, jeton]);
  const choisirPrenom = (p: string) => {
    setPrenom(p);
    setChanger(false);
    try {
      localStorage.setItem(clePrenom(jeton), p);
    } catch {
      /* le choix vaut pour cette visite */
    }
  };
  const aRepondu = groupe ? !!prenom && repondus.some((r) => cleInvite(r) === cleInvite(prenom)) : dejaRepondu;

  const mesure = useLecture(jeton, cadre);
  // `window.storage` de l'artefact : votes communs à la page, données du lecteur sur cet appareil.
  useStockagePartage(cadre, `/api/partage/${encodeURIComponent(jeton)}/stockage`, `lien:${jeton}`);

  const [ouvert, setOuvert] = useState(false);
  const [agrandi, setAgrandi] = useState(false);
  const [bulle, setBulle] = useState(false);

  useEffect(() => {
    if (!assistant) return;
    let vue = false;
    try {
      vue = localStorage.getItem(CLE_BULLE) === "1";
    } catch {
      /* stockage fermé : la bulle s'affiche, c'est sans gravité */
    }
    if (vue) return;
    const t = window.setTimeout(() => {
      setBulle(true);
      try {
        localStorage.setItem(CLE_BULLE, "1");
      } catch {
        /* rien */
      }
    }, DELAI_BULLE_MS);
    return () => window.clearTimeout(t);
  }, [assistant]);

  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouvert]);

  const ouvrir = () => {
    setBulle(false);
    setOuvert(true);
  };
  const fermer = () => {
    setOuvert(false);
    setAgrandi(false);
  };

  return (
    <div className={styles.page} lang={langue}>
      <header className={styles.bandeau}>
        {bandeau}
        {groupe && engagement && prenom && (
          <span className={styles.quiBandeau}>
            {t.vous} <b>{prenom}</b>
            <button type="button" className={styles.lienConf} onClick={() => setChanger(true)}>
              {t.changer}
            </button>
          </span>
        )}
        <ChoixLangue langue={langue} libelle={t.choisirLangue} />
        <button type="button" className={styles.lienConf} onClick={() => setConf(true)}>
          {t.confidentialite}
        </button>
        <a className={styles.marque} href="/" target="_blank" rel="noopener noreferrer">
          Getgents
        </a>
      </header>
      <div className={styles.corps} data-ouvert={assistant && ouvert ? "oui" : "non"} data-agrandi={agrandi ? "oui" : "non"}>
        <iframe
          ref={cadre}
          className={styles.cadre}
          src={repli.direct ? adresseDirecte(srcDocument) : srcDocument}
          onLoad={repli.onLoad}
          title={titre}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-downloads"
          referrerPolicy="no-referrer"
        />
        {assistant && (
          <AssistantDocument
            jeton={jeton}
            amorces={amorces}
            ouvert={ouvert}
            agrandi={agrandi}
            onFermer={fermer}
            onAgrandir={() => setAgrandi((a) => !a)}
            onConfidentialite={() => setConf(true)}
            langue={langue}
          />
        )}
      </div>

      {groupe && engagement && prenomLu && (!prenom || changer) && (
        <ChoixPrenom invites={groupe.invites} repondus={repondus} onChoisir={choisirPrenom} onFermer={prenom ? () => setChanger(false) : undefined} langue={langue} />
      )}

      {conf && <Confidentialite titre={titre} auteur={auteur} protegee={protegee} onFermer={() => setConf(false)} langue={langue} />}

      {(engagement || assistant) && !(assistant && ouvert) && (
        <div className={styles.flottants}>
          {engagement && (
            <EngagementLecteur
              key={prenom ?? ""}
              jeton={jeton}
              intitule={engagement.intitule}
              mot={engagement.mot}
              destinataire={prenom ?? destinataire}
              dejaRepondu={aRepondu}
              invite={groupe ? prenom : null}
              onRepondu={() => prenom && setRepondus((r) => [...r, prenom])}
              cadre={cadre}
              mesure={mesure}
              langue={langue}
            />
          )}
          {assistant && (
            <button type="button" className={styles.lanceur} onClick={ouvrir} aria-label={t.ouvrirAssistant}>
              <span className={styles.lanceurEtoile} aria-hidden="true">
                ✦
              </span>
              {t.poserQuestion}
            </button>
          )}
        </div>
      )}
      {assistant && !ouvert && (
        <>
          {bulle && (
            <div className={styles.bulle} role="status">
              <button type="button" className={styles.bulleFermer} aria-label={t.masquer} onClick={() => setBulle(false)}>
                ✕
              </button>
              <b>{t.bulleTitre}</b>
              {t.bulleTexte}
            </div>
          )}
        </>
      )}
    </div>
  );
}
