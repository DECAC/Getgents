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
  ADRESSE_DEMANDE_ACCES,
  lienDemandeAcces,
} from "@/lib/inscriptions";
import styles from "../auth.module.css";

/**
 * Écran d'accès restreint, servi à la place du formulaire.
 *
 * Il occupe l'adresse `/inscription` plutôt qu'une page à part : c'est là que
 * mènent tous les appels à l'action du site, et c'est là qu'on arrive en
 * cherchant à s'inscrire. Rediriger ailleurs ferait perdre l'intention.
 */
function AccesRestreint() {
  return (
    <>
      <h1 className={styles.title}>{TITRE_ACCES_RESTREINT}</h1>
      <p className={styles.lede}>{MESSAGE_ACCES_RESTREINT}</p>
      <p className={styles.lede}>{INVITATION_DEMANDE_ACCES}</p>
      {/* Même apparence que le bouton d'envoi du formulaire qu'il remplace :
          c'est l'action principale de l'écran, elle doit en avoir le poids. */}
      <a className={styles.submit} href={lienDemandeAcces()}>
        Écrire à {ADRESSE_DEMANDE_ACCES}
      </a>
      <div className={styles.aside}>
        <Link href="/connexion">J&apos;ai déjà un compte</Link>
      </div>
    </>
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
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/builder/mesgents`,
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
