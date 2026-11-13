"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthForm, Champ } from "../AuthForm";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { MESSAGE_INSCRIPTION, messageErreurAuth, verifierMotDePasse } from "@/lib/authMessages";
import {
  INSCRIPTIONS_OUVERTES,
  INVITATION_DEMANDE_ACCES,
  MESSAGE_ACCES_RESTREINT,
  TITRE_ACCES_RESTREINT,
} from "@/lib/inscriptions";
import { MESSAGE_DEMANDE, MOTIVATION_MAX, MOTIVATION_MIN, validerDemande } from "@/lib/demandeAcces";
import styles from "../auth.module.css";

/**
 * Écran d'accès restreint, servi à la place du formulaire d'inscription.
 *
 * Il occupe l'adresse `/inscription` plutôt qu'une page à part : c'est là que
 * mènent tous les appels à l'action du site, et c'est là qu'on arrive en
 * cherchant à s'inscrire. Rediriger ailleurs ferait perdre l'intention.
 *
 * La demande se fait ICI, par un formulaire : le lien `mailto` d'avant
 * ouvrait la messagerie du visiteur (quand il en avait une de configurée),
 * et l'on perdait ceux qui n'allaient pas au bout.
 */
function AccesRestreint() {
  const [email, setEmail] = useState("");
  const [motivation, setMotivation] = useState("");
  // Champ piège : invisible et hors du parcours au clavier. Un humain le
  // laisse vide ; un robot qui remplit tout se trahit.
  const [piege, setPiege] = useState("");

  return (
    <AuthForm
      titre={TITRE_ACCES_RESTREINT}
      lede={
        <>
          {MESSAGE_ACCES_RESTREINT} {INVITATION_DEMANDE_ACCES}
        </>
      }
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
        <span className={styles.label}>Ce que vous aimeriez construire avec Getgents</span>
        <textarea
          className={[styles.input, styles.zoneTexte].join(" ")}
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          rows={4}
          maxLength={MOTIVATION_MAX}
          placeholder="Ex. : un assistant qui suit les devis de mes chantiers et me prépare les relances."
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

export default function InscriptionPage() {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");

  // Le formulaire n'est pas seulement masqué : il n'est pas monté du tout.
  // Un champ caché reste soumettable, et l'écran doit dire ce qui se passe
  // plutôt que laisser croire à une panne.
  if (!INSCRIPTIONS_OUVERTES) return <AccesRestreint />;

  return (
    <AuthForm
      titre="Créer un compte"
      lede="Un compte, vos gents à vous : vous les construisez, vous choisissez qui y accède."
      bouton="Créer mon compte"
      succes={(m) => m}
      onSubmit={async () => {
        const probleme = verifierMotDePasse(motDePasse, confirmation);
        if (probleme) throw new Error(probleme);

        const supabase = getSupabaseBrowser();
        if (!supabase) throw new Error("Authentification non configurée sur ce déploiement.");
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: motDePasse,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/accueil`,
          },
        });
        if (error) throw new Error(messageErreurAuth(error.message));
        // Même message que l'adresse soit libre ou déjà prise : l'écran ne
        // doit pas servir à découvrir qui est inscrit.
        return MESSAGE_INSCRIPTION;
      }}
      aside={<Link href="/connexion">J&apos;ai déjà un compte</Link>}
    >
      <Champ label="Adresse e-mail" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <Champ
        label="Mot de passe"
        type="password"
        value={motDePasse}
        onChange={setMotDePasse}
        autoComplete="new-password"
      />
      <Champ
        label="Confirmer le mot de passe"
        type="password"
        value={confirmation}
        onChange={setConfirmation}
        autoComplete="new-password"
      />
    </AuthForm>
  );
}
