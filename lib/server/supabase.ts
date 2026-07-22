import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Client Supabase côté serveur uniquement (service_role : bypasse RLS —
// ne jamais l'importer depuis un composant client). Les routes /api/gents
// répondent 503 quand les variables ne sont pas configurées, et le front
// retombe alors sur le localStorage seul (mode maquette d'origine).
let cached: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
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
