import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "@/lib/server/supabaseAuth";
import { destinationDuLien, typeLienValide } from "@/lib/invitation";
import { claimOrphanGentsOnce, sealGrantsForUser } from "@/lib/server/claimOrphans";

/**
 * Atterrissage d'un lien par JETON (`token_hash`), la forme que recommande
 * Supabase pour un rendu serveur : le modèle d'e-mail « Invite user » doit
 * pointer ici —
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite
 * Le jeton est vérifié CÔTÉ SERVEUR et la session posée en cookies (seul un
 * route handler peut l'écrire), puis l'invité choisit son mot de passe
 * (/bienvenue). Le modèle par défaut passe par le fragment de l'adresse,
 * lu par `AtterrissageLien` dans le navigateur.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const echec = (code: string) => NextResponse.redirect(new URL(`/bienvenue?erreur=${encodeURIComponent(code)}`, url.origin));

  if (!tokenHash || !typeLienValide(type)) return echec("lien_incomplet");

  const response = NextResponse.redirect(new URL(destinationDuLien(type), url.origin));
  const client = createAuthClient({
    getAll: () => request.cookies.getAll().map(({ name, value }) => ({ name, value })),
    setAll: (cookies) => {
      for (const { name, value, options } of cookies) response.cookies.set(name, value, options);
    },
  });
  if (!client) return echec("auth_non_configuree");

  const { data, error } = await client.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    console.info(JSON.stringify({ tag: "getgents:auth", event: "lien_refuse", type, code: error.code ?? error.message.slice(0, 60) }));
    return echec(error.code ?? "lien_invalide");
  }

  // Mêmes suites qu'une connexion par /auth/callback ; un échec ici n'empêche
  // jamais la connexion (journalisé par chacune).
  if (data.user) {
    await claimOrphanGentsOnce(data.user.id);
    const emailConfirme = data.user.email_confirmed_at ? (data.user.email ?? "").toLowerCase() || null : null;
    await sealGrantsForUser(data.user.id, emailConfirme);
  }
  console.info(JSON.stringify({ tag: "getgents:auth", event: "lien_accepte", type }));
  return response;
}
