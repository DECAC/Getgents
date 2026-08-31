"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthForm, Champ } from "../AuthForm";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { destinationApresConnexion, messageErreurAuth } from "@/lib/authMessages";

function Connexion() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");

  return (
    <AuthForm
      titre="Se connecter"
      lede="Retrouvez vos gents et reprenez où vous en étiez."
      bouton="Se connecter"
      onSubmit={async () => {
        const supabase = getSupabaseBrowser();
        if (!supabase) throw new Error("Authentification non configurée sur ce déploiement.");
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: motDePasse });
        if (error) throw new Error(messageErreurAuth(error.message));
        // Navigation PLEINE PAGE, et non router.replace : les cookies de
        // session viennent d'être posés par le navigateur, et seul un
        // rechargement garantit que le middleware et les composants serveur
        // les voient. Enchaîner replace() et refresh() laissait l'utilisateur
        // sur l'écran de connexion, connecté mais sans rien qui bouge.
        window.location.assign(destinationApresConnexion(params.get("next")));
        return null;
      }}
      aside={
        <>
          <Link href="/inscription">Créer un compte</Link>
          <Link href="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
        </>
      }
    >
      <Champ label="Adresse e-mail" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <Champ
        label="Mot de passe"
        type="password"
        value={motDePasse}
        onChange={setMotDePasse}
        autoComplete="current-password"
      />
    </AuthForm>
  );
}

export default function ConnexionPage() {
  // useSearchParams impose une frontière Suspense en rendu statique.
  return (
    <Suspense fallback={null}>
      <Connexion />
    </Suspense>
  );
}
