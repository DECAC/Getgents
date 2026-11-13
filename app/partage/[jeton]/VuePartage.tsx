"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AssistantDocument from "./AssistantDocument";
import Confidentialite from "./Confidentialite";
import { BATTEMENT_MS, cleConsentement, DELAI_WIDGET_MS, type Consentement } from "@/lib/activitePage";
import styles from "./partage.module.css";

/** La bulle « Une question sur ce document ? » ne s'affiche qu'une fois par navigateur. */
const CLE_BULLE = "getgents:partage:bulleVue";
const DELAI_BULLE_MS = 3000;

function lireChoix(jeton: string): Consentement | null {
  try {
    const v = localStorage.getItem(cleConsentement(jeton));
    return v === "partage" || v === "anonyme" ? v : null;
  } catch {
    return null;
  }
}

/** Identifiant d'une visite : tiré à l'ouverture, et à nouveau à chaque changement de choix. */
function nouvelleVisite(): string {
  const o = new Uint8Array(16);
  crypto.getRandomValues(o);
  return Array.from(o, (x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Mesure de lecture. Anonyme (par défaut, et tant que le visiteur n'a rien
 * choisi) : UN battement par ouverture, rien d'autre. Partagée : la durée
 * (onglet visible seulement) et la profondeur lue, renvoyées toutes les
 * 15 s et quand l'onglet se cache. Changer d'avis ouvre une NOUVELLE
 * visite : une visite anonyme ne devient jamais nominative.
 */
function useLecture(jeton: string, choix: Consentement | null, cadre: React.RefObject<HTMLIFrameElement>) {
  useEffect(() => {
    const partage = choix === "partage";
    const visite = nouvelleVisite();
    let duree = 0;
    let profondeur: number | null = null;
    let depuis = document.visibilityState === "visible" ? Date.now() : 0;
    const envoyer = (fin = false) => {
      if (depuis) {
        duree += (Date.now() - depuis) / 1000;
        depuis = document.visibilityState === "visible" ? Date.now() : 0;
      }
      const corps = JSON.stringify({ visite, consentement: partage, duree: Math.round(duree), profondeur });
      const url = `/api/partage/${encodeURIComponent(jeton)}/lecture`;
      if (fin && navigator.sendBeacon) navigator.sendBeacon(url, new Blob([corps], { type: "application/json" }));
      else fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: corps, keepalive: true }).catch(() => {});
    };
    if (!partage) {
      // Anonyme : UNE ouverture. Sans choix fait, on attend (30 s, ou le départ
      // du visiteur) : celui qui accepte entre-temps ne compte qu'une fois,
      // en lecture partagée.
      let parti = false;
      const une = () => {
        if (parti) return;
        parti = true;
        envoyer(true);
      };
      if (choix === "anonyme") {
        une();
        return;
      }
      const t = window.setTimeout(une, 30_000);
      const surCache = () => document.visibilityState === "hidden" && une();
      document.addEventListener("visibilitychange", surCache);
      window.addEventListener("pagehide", une);
      return () => {
        window.clearTimeout(t);
        document.removeEventListener("visibilitychange", surCache);
        window.removeEventListener("pagehide", une);
      };
    }
    envoyer();
    // Le document a pu donner sa profondeur avant qu'on l'écoute : on la lui redemande.
    cadre.current?.contentWindow?.postMessage({ getgents: "profondeur?" }, "*");
    const surMessage = (e: MessageEvent) => {
      // Seul NOTRE cadre parle : un autre onglet ou une publicité n'écrit pas la mesure.
      if (e.source !== cadre.current?.contentWindow) return;
      const d = e.data as { getgents?: string; v?: unknown };
      if (d?.getgents === "profondeur" && typeof d.v === "number") profondeur = Math.max(profondeur ?? 0, Math.min(100, Math.round(d.v)));
    };
    const surVisibilite = () => {
      if (document.visibilityState === "hidden") envoyer(true);
      else depuis = Date.now();
    };
    const surDepart = () => envoyer(true);
    window.addEventListener("message", surMessage);
    window.addEventListener("pagehide", surDepart);
    document.addEventListener("visibilitychange", surVisibilite);
    const t = window.setInterval(() => document.visibilityState === "visible" && envoyer(), BATTEMENT_MS);
    return () => {
      envoyer(true);
      window.clearInterval(t);
      window.removeEventListener("message", surMessage);
      window.removeEventListener("pagehide", surDepart);
      document.removeEventListener("visibilitychange", surVisibilite);
    };
  }, [jeton, choix, cadre]);
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
}: {
  jeton: string;
  titre: string;
  assistant: boolean;
  amorces: string[];
  bandeau: React.ReactNode;
  /** Nom de l'auteur : montré dans « Vos données sur cette page » seulement. */
  auteur: string | null;
  protegee: boolean;
}) {
  const cadre = useRef<HTMLIFrameElement>(null);
  const [choix, setChoix] = useState<Consentement | null>(null);
  const [choixLu, setChoixLu] = useState(false);
  const [widget, setWidget] = useState(false);
  const [conf, setConf] = useState(false);

  useEffect(() => {
    setChoix(lireChoix(jeton));
    setChoixLu(true);
  }, [jeton]);

  // Le widget : après 10 s de lecture, jamais à l'arrivée, et seulement sans choix fait.
  useEffect(() => {
    if (!choixLu || choix) return;
    const t = window.setTimeout(() => setWidget(true), DELAI_WIDGET_MS);
    return () => window.clearTimeout(t);
  }, [choixLu, choix]);

  const choisir = useCallback(
    (c: Consentement) => {
      setChoix(c);
      setWidget(false);
      try {
        localStorage.setItem(cleConsentement(jeton), c);
      } catch {
        /* stockage fermé : le choix vaut pour cette visite */
      }
    },
    [jeton]
  );

  // Rien n'est envoyé avant d'avoir relu le choix : une visite partagée ne doit pas commencer anonyme, ni l'inverse.
  useLecture(jeton, choixLu ? choix : null, cadre);

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
    <div className={styles.page}>
      <header className={styles.bandeau}>
        {bandeau}
        {choix && (
          <button type="button" className={styles.etatDonnees} data-choix={choix} onClick={() => setConf(true)} title="Modifier">
            {choix === "partage" ? "✓ Données partagées avec l'auteur" : "Navigation anonyme"}
          </button>
        )}
        <button type="button" className={styles.lienConf} onClick={() => setConf(true)}>
          Confidentialité
        </button>
        <a className={styles.marque} href="/" target="_blank" rel="noopener noreferrer">
          Getgents
        </a>
      </header>
      <div className={styles.corps} data-ouvert={assistant && ouvert ? "oui" : "non"} data-agrandi={agrandi ? "oui" : "non"}>
        <iframe
          ref={cadre}
          className={styles.cadre}
          src={`/api/partage/${encodeURIComponent(jeton)}/contenu`}
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
          />
        )}
      </div>

      {widget && !conf && (
        <div className={styles.widget} role="dialog" aria-label="Partager vos données avec l'auteur">
          <button type="button" className={styles.widgetFermer} aria-label="Non merci" onClick={() => choisir("anonyme")}>
            ✕
          </button>
          <b>Partager vos données avec l&apos;auteur ?</b>
          <p>Vos données de navigation sur cette page seront partagées avec l&apos;auteur, pour un meilleur suivi.</p>
          <div className={styles.widgetActions}>
            <button type="button" className={styles.widgetOui} onClick={() => choisir("partage")}>
              Partager
            </button>
            <button type="button" className={styles.widgetNon} onClick={() => choisir("anonyme")}>
              Non merci
            </button>
            <button type="button" className={styles.widgetPlus} onClick={() => setConf(true)}>
              En savoir plus
            </button>
          </div>
        </div>
      )}

      {conf && <Confidentialite titre={titre} auteur={auteur} choix={choix} protegee={protegee} onChoix={choisir} onFermer={() => setConf(false)} />}

      {assistant && !ouvert && (
        <>
          {bulle && (
            <div className={styles.bulle} role="status">
              <button type="button" className={styles.bulleFermer} aria-label="Masquer" onClick={() => setBulle(false)}>
                ✕
              </button>
              <b>Une question sur ce document ?</b>
              L&apos;assistant y répond, à partir du document seulement.
            </div>
          )}
          <button type="button" className={styles.lanceur} onClick={ouvrir} aria-label="Ouvrir l'assistant du document">
            <span className={styles.lanceurEtoile} aria-hidden="true">
              ✦
            </span>
            Poser une question
          </button>
        </>
      )}
    </div>
  );
}
