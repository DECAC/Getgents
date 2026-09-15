/**
 * L'authentification est-elle configurée, et que faire quand elle ne l'est pas ?
 *
 * Le projet a toujours su fonctionner sans Supabase — « mode maquette »,
 * localStorage seul — et c'est précieux pour développer. Mais une plateforme
 * multi-comptes sans son service d'authentification n'est pas une maquette :
 * c'est un site ouvert qui croit être fermé.
 *
 * D'où la même convention que pour CRON_SECRET : en production, l'absence de
 * configuration ferme l'application au lieu de l'ouvrir. En développement,
 * elle laisse passer, avec un avertissement bruyant. Un service fermé est un
 * incident qu'on diagnostique ; un service ouvert par erreur, non.
 */

export interface AuthConfig {
  url: string;
  anonKey: string;
}

export function readAuthConfig(): AuthConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return url && anonKey ? { url, anonKey } : null;
}

export function isAuthConfigured(): boolean {
  return readAuthConfig() !== null;
}

/**
 * Que faire d'une requête quand l'authentification n'est pas configurée ?
 * Séparé de la lecture d'environnement pour être testable.
 */
export type UnconfiguredPolicy = "bloquer" | "laisser-passer";

export function unconfiguredPolicy(nodeEnv: string | undefined): UnconfiguredPolicy {
  return nodeEnv === "production" ? "bloquer" : "laisser-passer";
}

/** Variables manquantes, nommées — « non configuré » ne dit pas laquelle. */
export function missingAuthEnvVars(): string[] {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return missing;
}
