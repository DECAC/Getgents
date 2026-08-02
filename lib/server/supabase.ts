import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Client Supabase côté serveur uniquement (service_role : bypasse RLS —
// ne jamais l'importer depuis un composant client). Les routes /api/gents
// répondent 503 quand les variables ne sont pas configurées, et le front
// retombe alors sur le localStorage seul (mode maquette d'origine).
let cached: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Nomme précisément la ou les variables absentes, plutôt qu'un booléen muet :
 * « Supabase non configuré » ne dit pas laquelle des deux manque, alors qu'une
 * app peut n'avoir que l'URL ou que la clé de définie (oubli, mauvais
 * environnement Vercel — Production vs Preview).
 */
export function missingSupabaseEnvVars(): string[] {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cached) {
    cached = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
      global: {
        // Next.js patche fetch() avec un cache par défaut dans les route
        // handlers : sans no-store, les lectures Supabase renverraient des
        // données figées au premier appel.
        fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }),
      },
    });
  }
  return cached;
}
