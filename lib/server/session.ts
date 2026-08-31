import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAuthClient, readOnlyBridge } from "@/lib/server/supabaseAuth";
import { isAuthConfigured, missingAuthEnvVars, unconfiguredPolicy } from "@/lib/authConfig";

/**
 * Identité du demandeur — source unique de vérité côté serveur.
 *
 * Aucune route ne relit les cookies elle-même : c'est ainsi qu'une garde
 * finit par diverger d'une autre, et qu'un chemin oublié reste ouvert.
 */

export interface SessionUser {
  id: string;
  /**
   * Adresse en minuscules, renseignée UNIQUEMENT si elle est confirmée.
   * `lib/gentAccess.ts` s'en sert pour honorer une invitation pas encore
   * scellée : la remplir sans confirmation permettrait de s'inscrire avec
   * l'adresse d'autrui pour hériter de ses accès.
   */
  confirmedEmail: string | null;
}

export async function getUser(): Promise<SessionUser | null> {
  const client = createAuthClient(readOnlyBridge(() => cookies().getAll()));
  if (!client) return null;

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;

  return {
    id: data.user.id,
    confirmedEmail: data.user.email_confirmed_at ? (data.user.email ?? "").toLowerCase() || null : null,
  };
}

/**
 * Refus prêt à retourner, ou l'utilisateur. Le type discriminé évite le piège
 * classique — oublier de retourner la réponse et poursuivre le traitement.
 *
 * Usage : `const auth = await requireUser(); if ("response" in auth) return auth.response;`
 */
export type AuthOutcome = { user: SessionUser } | { response: NextResponse };

export async function requireUser(): Promise<AuthOutcome> {
  if (!isAuthConfigured()) {
    if (unconfiguredPolicy(process.env.NODE_ENV) === "bloquer") {
      console.error(
        JSON.stringify({
          tag: "getgents:auth",
          event: "auth_not_configured",
          missing: missingAuthEnvVars(),
          detail: "Authentification non configurée : accès refusé en production.",
        })
      );
      return {
        response: NextResponse.json(
          { error: "auth_not_configured", missing: missingAuthEnvVars() },
          { status: 503 }
        ),
      };
    }
    // Développement local sans Supabase : le mode maquette reste utilisable.
    console.warn(
      `[getgents] Authentification non configurée (${missingAuthEnvVars().join(", ")}) — ` +
        `accès laissé ouvert en développement. En production, ces routes seraient refusées.`
    );
    return { user: { id: "dev-local", confirmedEmail: null } };
  }

  const user = await getUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
    };
  }
  return { user };
}
