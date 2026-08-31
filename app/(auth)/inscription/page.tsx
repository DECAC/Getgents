"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthForm, Champ } from "../AuthForm";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { MESSAGE_INSCRIPTION, messageErreurAuth, verifierMotDePasse } from "@/lib/authMessages";

export default function InscriptionPage() {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");

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
