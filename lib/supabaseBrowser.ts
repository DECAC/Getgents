"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readAuthConfig } from "@/lib/authConfig";

/**
 * Client Supabase du NAVIGATEUR, clé anon.
 *
 * Il ne sert qu'à l'authentification : inscription, connexion, déconnexion,
 * réinitialisation de mot de passe, et l'écoute des changements de session.
 * Il ne lit JAMAIS de donnée métier — gents, brouillons, artefacts passent
 * par /api/*, où le serveur contrôle l'appartenance. Le RLS existe, mais il
 * ne doit pas devenir la seule barrière côté client.
 */
let cached: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient | null {
  const config = readAuthConfig();
  if (!config) return null;
  if (!cached) cached = createBrowserClient(config.url, config.anonKey);
  return cached;
}
