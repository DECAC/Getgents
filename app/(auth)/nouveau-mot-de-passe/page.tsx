"use client";

import { useState } from "react";
import { AuthForm, Champ } from "../AuthForm";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { messageErreurAuth, verifierMotDePasse } from "@/lib/authMessages";

/**
 * Atterrissage du lien de réinitialisation. Le lien a déjà ouvert une session
 * (via /auth/callback) : il ne reste qu'à choisir le nouveau mot de passe.
 */
export default function NouveauMotDePassePage() {
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");

  return (
    <AuthForm
      titre="Choisir un nouveau mot de passe"
      bouton="Enregistrer"
      onSubmit={async () => {
        const probleme = verifierMotDePasse(motDePasse, confirmation);
        if (probleme) throw new Error(probleme);

        const supabase = getSupabaseBrowser();
        if (!supabase) throw new Error("Authentification non configurée sur ce déploiement.");
        const { error } = await supabase.auth.updateUser({ password: motDePasse });
        if (error) throw new Error(messageErreurAuth(error.message));
        // Rechargement complet : voir la note de l'écran de connexion.
        window.location.assign("/builder/mesgents");
        return null;
      }}
    >
      <Champ
        label="Nouveau mot de passe"
        type="password"
        value={motDePasse}
        onChange={setMotDePasse}
        autoComplete="new-password"
      />
      <Champ
        label="Confirmer"
        type="password"
        value={confirmation}
        onChange={setConfirmation}
        autoComplete="new-password"
      />
    </AuthForm>
  );
}
