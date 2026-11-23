"use client";

import { useRef, useState } from "react";
import { textes, type Langue } from "@/lib/langueLecteur";
import styles from "./partage.module.css";

/**
 * Écran d'une page protégée par code. Le document n'est PAS chargé ici : le
 * flou de fond est un décor, la vraie page ne part qu'après validation (et
 * ses routes revérifient le cookie d'accès).
 *
 * Le destinataire ne tape pas son adresse : le code part à celle à laquelle
 * le lien a été adressé, montrée masquée.
 */
export default function EcranCode({
  jeton,
  masque,
  etat,
  langue,
}: {
  jeton: string;
  masque: string;
  etat: "code" | "sans_adresse" | "indisponible";
  langue: Langue;
}) {
  const t = textes(langue);
  const [etape, setEtape] = useState<"demande" | "saisie">("demande");
  const [code, setCode] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  async function envoyer() {
    setEnCours(true);
    setMessage(null);
    try {
      const r = await fetch(`/api/partage/${encodeURIComponent(jeton)}/code`, { method: "POST" });
      const brut = await r.text();
      let j: { error?: string; cause?: string } = {};
      try {
        j = JSON.parse(brut);
      } catch {
        // Réponse qui n'est PAS celle de la route (page d'erreur de
        // l'hébergeur) : l'en-tête x-vercel-error ou le début du corps la nomment.
      }
      if (!r.ok) {
        const hebergeur = r.headers.get("x-vercel-error") ?? (j.cause ? "" : brut.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 60));
        throw new Error(`${j.error || t.codeNonEnvoye} (${t.reference} ${j.cause ?? `http-${r.status}`}${hebergeur ? ` · ${hebergeur}` : ""})`);
      }
      setEtape("saisie");
      setCode("");
      window.setTimeout(() => champ.current?.focus(), 50);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  async function verifier(valeur: string) {
    if (valeur.length !== 6 || enCours) return;
    setEnCours(true);
    setMessage(null);
    try {
      const r = await fetch(`/api/partage/${encodeURIComponent(jeton)}/code/verifier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: valeur }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || t.codeRefuse);
      // Le cookie d'accès est posé : la page se recharge et sert le document.
      window.location.reload();
    } catch (e) {
      setMessage((e as Error).message);
      setCode("");
      setEnCours(false);
      champ.current?.focus();
    }
  }

  return (
    <div className={styles.porte}>
      <div className={styles.porteFond} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className={styles.porteCarte} role="dialog" aria-labelledby="porte-titre">
        <div className={styles.porteIcone} aria-hidden="true">
          {etape === "saisie" ? "✉️" : "🔒"}
        </div>

        {etat === "sans_adresse" && (
          <>
            <h1 id="porte-titre" className={styles.porteTitre}>
              {t.porteSansAdresseTitre}
            </h1>
            <p className={styles.porteTexte}>{t.porteSansAdresseTexte}</p>
          </>
        )}

        {etat === "indisponible" && (
          <>
            <h1 id="porte-titre" className={styles.porteTitre}>
              {t.porteIndispoTitre}
            </h1>
            <p className={styles.porteTexte}>{t.porteIndispoTexte}</p>
          </>
        )}

        {etat === "code" && etape === "demande" && (
          <>
            <h1 id="porte-titre" className={styles.porteTitre}>
              {t.porteTitre}
            </h1>
            <p className={styles.porteTexte}>{t.porteTexte(masque)}</p>
            <button type="button" className={styles.porteBouton} onClick={envoyer} disabled={enCours}>
              {enCours ? t.envoi : t.recevoirCode}
            </button>
            {message && <p className={styles.porteErreur}>{message}</p>}
            <p className={styles.porteMention}>{t.pasVotreAdresse}</p>
          </>
        )}

        {etat === "code" && etape === "saisie" && (
          <>
            <h1 id="porte-titre" className={styles.porteTitre}>
              {t.saisirTitre}
            </h1>
            <p className={styles.porteTexte}>{t.envoyeA(masque)}</p>
            <label className={styles.cases} onClick={() => champ.current?.focus()}>
              <span className={styles.visuellementCache}>{t.codeSixChiffres}</span>
              <input
                ref={champ}
                className={styles.casesChamp}
                value={code}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                disabled={enCours}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                  setMessage(null);
                  if (v.length === 6) void verifier(v);
                }}
              />
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className={[styles.case, code[i] ? styles.caseRemplie : "", i === code.length ? styles.caseCourante : ""].join(" ")} aria-hidden="true">
                  {code[i] ?? ""}
                </span>
              ))}
            </label>
            <button type="button" className={styles.porteBouton} onClick={() => verifier(code)} disabled={code.length !== 6 || enCours}>
              {enCours ? t.verification : t.ouvrirPage}
            </button>
            {message && <p className={styles.porteErreur}>{message}</p>}
            <p className={styles.porteLien}>
              {t.rienRecu}{" "}
              <button type="button" onClick={envoyer} disabled={enCours}>
                {t.renvoyer}
              </button>
            </p>
            <p className={styles.porteMention}>{t.souvenir}</p>
          </>
        )}
      </div>
    </div>
  );
}
