import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readAuthConfig } from "@/lib/authConfig";

/**
 * Client Supabase SERVEUR lié aux cookies, clé anon.
 *
 * Distinct des deux autres, et volontairement limité à `auth.getUser()` :
 * - `lib/supabaseBrowser.ts` (anon, navigateur) fait l'authentification ;
 * - celui-ci vérifie l'identité côté serveur ;
 * - `lib/server/supabase.ts` (service_role) fait les écritures métier, après
 *   contrôle d'appartenance.
 *
 * Jamais `getSession()` : cette méthode se contente de décoder le jeton
 * présent dans le cookie, sans le vérifier. `getUser()` interroge Supabase et
 * valide la signature — c'est la seule des deux sur laquelle on peut fonder
 * une autorisation.
 */

export interface CookieRecord {
  name: string;
  value: string;
}

/**
 * Adaptateur minimal vers le magasin de cookies de l'appelant : `cookies()`
 * dans un composant serveur, `request.cookies` / `response.cookies` dans le
 * middleware. La bibliothèque nomme et découpe elle-même les cookies de
 * session ; on ne fait que les transporter.
 */
export interface CookieBridge {
  getAll(): CookieRecord[];
  setAll(cookies: { name: string; value: string; options?: Record<string, unknown> }[]): void;
}

export function createAuthClient(bridge: CookieBridge): SupabaseClient | null {
  const config = readAuthConfig();
  if (!config) return null;

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => bridge.getAll(),
      setAll: (cookies) => bridge.setAll(cookies),
    },
  });
}

/** Pont en LECTURE SEULE — pour un composant serveur, où l'on ne peut pas écrire. */
export function readOnlyBridge(getAll: () => CookieRecord[]): CookieBridge {
  return {
    getAll,
    // Un composant serveur ne peut pas poser de cookie : Next l'interdit hors
    // route handler et middleware. Le rafraîchissement du jeton a lieu dans le
    // middleware, qui, lui, peut écrire — ignorer ici est donc correct, et non
    // une perte silencieuse.
    setAll: () => undefined,
  };
}
