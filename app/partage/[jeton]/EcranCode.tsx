"use client";

import { useRef, useState } from "react";
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
}: {
  jeton: string;
  masque: string;
  etat: "code" | "sans_adresse" | "indisponible";
}) {
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
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Le code n'a pas pu être envoyé.");
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
      if (!r.ok) throw new Error(j.error || "Code refusé.");
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
              Cette page est protégée
            </h1>
            <p className={styles.porteTexte}>
              Ce lien n&apos;est rattaché à aucune adresse e-mail : impossible de vous envoyer un code. Demandez un nouveau lien à la personne qui
              vous l&apos;a envoyé.
            </p>
          </>
        )}

        {etat === "indisponible" && (
          <>
            <h1 id="porte-titre" className={styles.porteTitre}>
              Page momentanément indisponible
            </h1>
            <p className={styles.porteTexte}>Le contrôle d&apos;accès ne répond pas. Réessayez dans quelques minutes.</p>
          </>
        )}

        {etat === "code" && etape === "demande" && (
          <>
            <h1 id="porte-titre" className={styles.porteTitre}>
              Cette page vous est réservée
            </h1>
            <p className={styles.porteTexte}>
              Pour l&apos;ouvrir, confirmez que vous êtes bien son destinataire : nous envoyons un code à <b>{masque}</b>.
            </p>
            <button type="button" className={styles.porteBouton} onClick={envoyer} disabled={enCours}>
              {enCours ? "Envoi…" : "Recevoir mon code"}
            </button>
            {message && <p className={styles.porteErreur}>{message}</p>}
            <p className={styles.porteMention}>Ce n&apos;est pas votre adresse ? Demandez un nouveau lien à la personne qui vous l&apos;a envoyé.</p>
          </>
        )}

        {etat === "code" && etape === "saisie" && (
          <>
            <h1 id="porte-titre" className={styles.porteTitre}>
              Saisissez votre code
            </h1>
            <p className={styles.porteTexte}>
              Envoyé à <b>{masque}</b>. Il est valable 10 minutes.
            </p>
            <label className={styles.cases} onClick={() => champ.current?.focus()}>
              <span className={styles.visuellementCache}>Code à 6 chiffres</span>
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
              {enCours ? "Vérification…" : "Ouvrir la page"}
            </button>
            {message && <p className={styles.porteErreur}>{message}</p>}
            <p className={styles.porteLien}>
              Rien reçu ? Regardez vos indésirables, ou{" "}
              <button type="button" onClick={envoyer} disabled={enCours}>
                renvoyer le code
              </button>
            </p>
            <p className={styles.porteMention}>Une fois validé, ce navigateur s&apos;en souvient 30 jours.</p>
          </>
        )}
      </div>
    </div>
  );
}
