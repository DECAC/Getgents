"use client";

import { useState } from "react";
import { EXEMPLES, exemplesDuPublic, PUBLICS, type IdExemple, type Public } from "@/lib/exemplesPages";
import { PictoPublic } from "./PictoPublic";
import type { Offre } from "@/lib/offre";
import styles from "./pages.module.css";

/**
 * Écran d'un compte SANS page (18/11, piste D choisie par l'éditeur).
 *
 * Constat des premiers comptes : on arrivait sans artefact sous la main, et
 * il fallait repartir dans Claude ou ChatGPT avant de pouvoir faire quoi que
 * ce soit. D'où, EN PREMIER, une page d'exemple créée d'un clic : on se
 * l'envoie, on l'ouvre en lecteur, on interroge son assistant — et l'on sait
 * ce que vivra son propre client. Coller son code et connecter Claude
 * viennent ensuite.
 *
 * Question d'accueil (19/11) : « Avec qui voulez-vous partager ? » — quatre
 * publics, chacun ouvre SES exemples ; « Voir les cinq exemples » les montre
 * tous. Rien n'est gardé : la question oriente, elle ne règle rien.
 */
export function AccueilPages({ offre, onNouvelle }: { offre: Offre; onNouvelle: () => void }) {
  const [enCours, setEnCours] = useState<IdExemple | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [choix, setChoix] = useState<Public | "tous" | null>(null);
  const montres = choix === "tous" ? EXEMPLES : choix ? exemplesDuPublic(choix) : [];

  async function creerExemple(id: IdExemple) {
    setEnCours(id);
    setErreur(null);
    const r = await fetch("/api/pages/exemple", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exemple: id }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { id?: string; error?: string } | undefined;
    if (r?.ok && j?.id) {
      window.location.assign(`/pages/${j.id}`);
      return;
    }
    setErreur(j?.error ?? "La page d'exemple n'a pas pu être créée. Réessayez.");
    setEnCours(null);
  }

  return (
    <section className={styles.accueil}>
      <svg className={styles.accueilDecor} viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g opacity=".55">
          <rect x="1000" y="60" width="40" height="40" rx="10" fill="var(--sage-tint)" transform="rotate(12 1020 80)" />
          <rect x="1110" y="250" width="26" height="26" rx="7" fill="var(--gold-tint)" transform="rotate(-18 1123 263)" />
          <rect x="60" y="680" width="34" height="34" rx="9" fill="var(--blue-tint)" transform="rotate(20 77 697)" />
          <rect x="1040" y="700" width="22" height="22" rx="6" fill="var(--success-tint)" />
          <circle cx="900" cy="760" r="8" fill="var(--sage-tint)" />
          <circle cx="150" cy="110" r="6" fill="var(--gold-tint)" />
        </g>
        <text x="1008" y="88" fontSize="14" fontWeight="800" fill="var(--sage)" opacity=".7">GG</text>
        <text x="110" y="500" fontSize="22" fill="var(--sage-tint)">✦</text>
      </svg>

      <div className={styles.accueilContenu}>
        <h1 className={styles.accueilTitre}>{offre === "pages" ? "Bienvenue sur Getgents Pages" : "Créez votre première page"}</h1>
        <p className={styles.accueilLede}>
          Voyez d&apos;abord ce que reçoit votre lecteur : créez une page d&apos;exemple, envoyez-la-vous, ouvrez-la et posez une question à son assistant. Comptez
          trois minutes.
        </p>

        <h2 className={styles.publicsQuestion}>Avec qui voulez-vous partager ?</h2>
        <div className={styles.publics} role="group" aria-label="Avec qui voulez-vous partager ?">
          {PUBLICS.map((p) => (
            <button key={p.id} type="button" className={styles.publicCarte} aria-pressed={choix === p.id} onClick={() => setChoix(p.id)}>
              <PictoPublic public={p.id} className={styles.publicPicto} />
              <b>{p.titre}</b>
              <span>{p.sous}</span>
            </button>
          ))}
        </div>

        {montres.length > 0 && (
          <div className={styles.exemples}>
            {montres.map((ex) => (
              <div key={ex.id} className={styles.exempleCarte} data-exemple={ex.id}>
                <span className={styles.exempleApercu} aria-hidden="true" />
                <div>
                  <span className={styles.cheminTag}>Page d&apos;exemple</span>
                  <h2>{ex.titre}</h2>
                  <p>{ex.resume}</p>
                  <button type="button" className={styles.principal} disabled={enCours !== null} onClick={() => void creerExemple(ex.id)}>
                    {enCours === ex.id ? "Création…" : "Essayer cet exemple"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {choix !== "tous" && (
          <p className={styles.aide}>
            {choix ? "Ou " : "Vous préférez choisir vous-même ? "}
            <button type="button" className={styles.lienTexteFort} onClick={() => setChoix("tous")}>
              {choix ? "voir" : "Voir"} les {EXEMPLES.length} exemples
            </button>
            .
          </p>
        )}
        {erreur && (
          <p className={styles.erreur} role="alert">
            {erreur}
          </p>
        )}
        <p className={styles.aide}>Les exemples sont fictifs et n&apos;envoient rien à personne : vous les supprimez quand vous voulez.</p>

        <div className={styles.chemins}>
          <div className={styles.chemin}>
            <span className={styles.cheminTagGris}>Votre propre page</span>
            <h2>Coller le code d&apos;un artefact</h2>
            <p>Dans Claude ou ChatGPT, bouton « Copier » sur l&apos;artefact, puis collez-le ici. Marche avec tous les assistants.</p>
            <button type="button" className={styles.secondaire} onClick={onNouvelle}>
              + Nouvelle page
            </button>
          </div>
          <div className={styles.chemin}>
            <span className={styles.cheminTag}>Le plus rapide ensuite</span>
            <h2>Partager depuis Claude</h2>
            <p>Connectez Getgents, puis dites à Claude : « partage cette page à marie@acme.fr ». Guides pour ChatGPT, Mistral et Perplexity au même endroit.</p>
            <a href="/pages?guide=claude" className={styles.secondaire} style={{ textDecoration: "none" }}>
              Connecter un assistant
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
