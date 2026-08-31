"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthForm, Champ } from "../AuthForm";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { MESSAGE_MOT_DE_PASSE_OUBLIE, messageErreurAuth } from "@/lib/authMessages";

export default function MotDePasseOubliePage() {
  const [email, setEmail] = useState("");

  return (
    <AuthForm
      titre="Mot de passe oublié"
      lede="Indiquez votre adresse : vous recevrez un lien pour en choisir un nouveau."
      bouton="Envoyer le lien"
      succes={(m) => m}
      onSubmit={async () => {
        const supabase = getSupabaseBrowser();
        if (!supabase) throw new Error("Authentification non configurée sur ce déploiement.");
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback?next=/nouveau-mot-de-passe`,
        });
        if (error) throw new Error(messageErreurAuth(error.message));
        // Réponse identique que l'adresse existe ou non.
        return MESSAGE_MOT_DE_PASSE_OUBLIE;
      }}
      aside={<Link href="/connexion">Revenir à la connexion</Link>}
    >
      <Champ label="Adresse e-mail" type="email" value={email} onChange={setEmail} autoComplete="email" />
    </AuthForm>
  );
}
