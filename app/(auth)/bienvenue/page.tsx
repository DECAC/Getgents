"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthForm, Champ } from "../AuthForm";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { messageErreurAuth, verifierMotDePasse } from "@/lib/authMessages";
import { MESSAGE_NOM_INVALIDE, nomAfficheValide, normaliserNomAffiche } from "@/lib/nomAffiche";
import { messageLienInvalide } from "@/lib/invitation";
import styles from "../auth.module.css";

/**
 * Atterrissage d'une INVITATION (`lib/invitation.ts`) : le lien a ouvert une
 * session, mais l'invité n'a pas encore de mot de passe. Il le choisit ici,
 * avec son nom affiché (montré à ses destinataires dans « Vos données sur
 * cette page »), puis arrive dans son espace.
 */
export default function BienvenuePage() {
  const [etat, setEtat] = useState<"verification" | "pret" | "invalide">("verification");
  const [code, setCode] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    const erreur = new URLSearchParams(window.location.search).get("erreur");
    if (erreur) {
      setCode(erreur);
      setEtat("invalide");
      return;
    }
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setEtat("invalide");
      return;
    }
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return setEtat("invalide");
      setEmail(data.user.email ?? null);
      setNom(String(data.user.user_metadata?.nom_affiche ?? ""));
      setEtat("pret");
    });
  }, []);

  if (etat === "verification") return <p className={styles.lede}>Ouverture de votre invitation…</p>;

  if (etat === "invalide")
    return (
      <div>
        <h1 className={styles.title}>Lien d&apos;invitation</h1>
        <p className={styles.lede}>{messageLienInvalide(code)}</p>
        <p className={styles.aside}>
          <Link href="/connexion">Se connecter</Link> · <Link href="/mot-de-passe-oublie">Mot de passe oublié</Link>
        </p>
      </div>
    );

  return (
    <AuthForm
      titre="Bienvenue sur Getgents"
      lede={
        <>
          Choisissez votre mot de passe{email ? <> pour <b>{email}</b></> : null}. Vous vous connecterez ensuite avec cette adresse.
        </>
      }
      bouton="Enregistrer et commencer"
      onSubmit={async () => {
        const probleme = verifierMotDePasse(motDePasse, confirmation);
        if (probleme) throw new Error(probleme);
        const n = normaliserNomAffiche(nom);
        if (n && !nomAfficheValide(n)) throw new Error(MESSAGE_NOM_INVALIDE);
        const supabase = getSupabaseBrowser();
        if (!supabase) throw new Error("Authentification non configurée sur ce déploiement.");
        const { error } = await supabase.auth.updateUser({ password: motDePasse, data: { nom_affiche: n } });
        if (error) throw new Error(messageErreurAuth(error.message));
        // Rechargement complet : les cookies de session doivent être relus par le serveur.
        window.location.assign("/accueil");
        return null;
      }}
    >
      <Champ label="Votre nom (facultatif, vu par vos destinataires)" type="text" value={nom} onChange={setNom} autoComplete="name" required={false} />
      <Champ label="Mot de passe" type="password" value={motDePasse} onChange={setMotDePasse} autoComplete="new-password" />
      <Champ label="Confirmer le mot de passe" type="password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
    </AuthForm>
  );
}
