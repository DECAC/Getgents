"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthForm, Champ } from "../AuthForm";
import { MESSAGE_INSCRIPTION, verifierMotDePasse } from "@/lib/authMessages";
import {
  INVITATION_DEMANDE_ACCES,
  MESSAGE_ACCES_RESTREINT,
  MESSAGE_INSCRIPTIONS_COMPLETES,
  POUR_QUOI_MAX,
  TITRE_ACCES_RESTREINT,
} from "@/lib/inscriptions";
import { MESSAGE_DEMANDE, MOTIVATION_MAX, MOTIVATION_MIN, validerDemande } from "@/lib/demandeAcces";
import styles from "../auth.module.css";

export function AccesRestreint({ complet = false }: { complet?: boolean }) {
  const [email, setEmail] = useState("");
  const [motivation, setMotivation] = useState("");
  // Champ piège : invisible et hors du parcours au clavier. Un humain le
  // laisse vide ; un robot qui remplit tout se trahit.
  const [piege, setPiege] = useState("");

  return (
    <AuthForm
      titre={complet ? "Les places de l'essai sont prises" : TITRE_ACCES_RESTREINT}
      lede={complet ? MESSAGE_INSCRIPTIONS_COMPLETES : <>{MESSAGE_ACCES_RESTREINT} {INVITATION_DEMANDE_ACCES}</>}
      bouton="Envoyer ma demande"
      succes={(m) => m}
      onSubmit={async () => {
        const probleme = validerDemande({ email, motivation, piege });
        if (probleme && probleme !== "robot") throw new Error(MESSAGE_DEMANDE[probleme]);
        const res = await fetch("/api/demande-acces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, motivation, piege }),
        }).catch(() => null);
        if (!res) throw new Error("Connexion impossible. Vérifiez votre réseau et réessayez.");
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? MESSAGE_DEMANDE.serveur);
        return `Demande reçue. Nous vous répondrons à ${email.trim().toLowerCase()}.`;
      }}
      aside={<Link href="/connexion">J&apos;ai déjà un compte</Link>}
    >
      <Champ label="Votre adresse e-mail" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <label className={styles.field}>
        <span className={styles.label}>Avec qui voulez-vous partager, et quoi ?</span>
        <textarea
          className={[styles.input, styles.zoneTexte].join(" ")}
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          rows={4}
          maxLength={MOTIVATION_MAX}
          placeholder="Ex. : les propositions que je prépare avec Claude, pour mes clients."
          required
        />
        <span className={styles.compteur} aria-live="polite">
          {motivation.trim().length < MOTIVATION_MIN
            ? `${MOTIVATION_MIN} caractères au moins`
            : `${motivation.length} / ${MOTIVATION_MAX}`}
        </span>
      </label>
      <label className={styles.piege} aria-hidden="true">
        Site web
        <input type="text" tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} />
      </label>
    </AuthForm>
  );
}

/**
 * Inscription libre plafonnée (18/11) : le compte est créé par le SERVEUR
 * (`/api/inscription`), jamais par `supabase.auth.signUp` depuis le
 * navigateur — Supabase garde ses inscriptions publiques fermées.
 */
export function FormulaireInscription({ restantes }: { restantes: number }) {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pourQuoi, setPourQuoi] = useState("");
  const [piege, setPiege] = useState("");

  return (
    <AuthForm
      titre="Créer votre compte"
      lede={`Getgents Pages est gratuit pendant l'essai. ${restantes > 1 ? `Il reste ${restantes} places.` : "Il reste une place."}`}
      bouton="Créer mon compte"
      succes={(m) => m}
      onSubmit={async () => {
        const probleme = verifierMotDePasse(motDePasse, confirmation);
        if (probleme) throw new Error(probleme);
        const res = await fetch("/api/inscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, motDePasse, pourQuoi, piege }),
        }).catch(() => null);
        if (!res) throw new Error("Connexion impossible. Vérifiez votre réseau et réessayez.");
        const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string; complet?: boolean };
        if (data.complet) {
          // Plus de place entre l'affichage et l'envoi : l'écran passe à la demande d'accès.
          window.location.reload();
          return null;
        }
        if (!res.ok) throw new Error(data.error ?? "Le compte n'a pas pu être créé. Réessayez dans un instant.");
        return data.message ?? MESSAGE_INSCRIPTION;
      }}
      aside={<Link href="/connexion">J&apos;ai déjà un compte</Link>}
    >
      <Champ label="Adresse e-mail" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <Champ label="Mot de passe" type="password" value={motDePasse} onChange={setMotDePasse} autoComplete="new-password" />
      <Champ label="Confirmer le mot de passe" type="password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
      <label className={styles.field}>
        <span className={styles.label}>Avec qui voulez-vous partager, et quoi ? (facultatif)</span>
        <textarea
          className={[styles.input, styles.zoneTexte].join(" ")}
          value={pourQuoi}
          onChange={(e) => setPourQuoi(e.target.value)}
          rows={3}
          maxLength={POUR_QUOI_MAX}
          placeholder="Ex. : les propositions que je prépare avec Claude, pour mes clients."
        />
      </label>
      <label className={styles.piege} aria-hidden="true">
        Site web
        <input type="text" tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} />
      </label>
    </AuthForm>
  );
}
