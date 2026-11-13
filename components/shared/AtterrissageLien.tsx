"use client";

import { useEffect } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { destinationDuLien, lireFragment } from "@/lib/invitation";

/**
 * Lien d'invitation au modèle d'e-mail PAR DÉFAUT de Supabase : la session
 * arrive dans le fragment de l'adresse (`#access_token=…&type=invite`), que
 * le serveur ne voit jamais. Monté dans le layout racine — l'invité peut
 * atterrir sur n'importe quelle page (l'accueil public, le plus souvent).
 * Ne fait rien sans fragment d'invitation ou de réinitialisation.
 */
export function AtterrissageLien() {
  useEffect(() => {
    const f = lireFragment(window.location.hash);
    if (!f) return;
    // Le fragment porte des jetons : il ne doit rester ni dans la barre
    // d'adresse ni dans l'historique.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (f.genre === "erreur") {
      window.location.assign(`/bienvenue?erreur=${encodeURIComponent(f.code)}`);
      return;
    }
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    void supabase.auth
      .setSession({ access_token: f.accessToken, refresh_token: f.refreshToken })
      .then(({ error }) => window.location.assign(error ? `/bienvenue?erreur=${encodeURIComponent(error.code ?? "lien_invalide")}` : destinationDuLien(f.type)));
  }, []);
  return null;
}
