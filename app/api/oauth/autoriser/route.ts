import { NextResponse } from "next/server";
import { adresseAvecParametres, validerDemande } from "@/lib/oauthMcp";
import { creerCode, lireClient } from "@/lib/server/oauthMcp";
import { requireUser } from "@/lib/server/session";

/**
 * Le consentement du commercial, envoyé par la page /oauth/autoriser. Rend
 * l'adresse où le navigateur doit aller (code ou refus) : la page y navigue
 * elle-même — un formulaire classique suivi d'une redirection vers claude.ai
 * serait bloqué par `form-action 'self'` de notre CSP.
 *
 * La demande est REVÉRIFIÉE ici, pas reprise de la page : c'est ce corps qui
 * fait foi, et n'importe qui peut l'écrire.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Contre la falsification inter-sites : un appel venu d'une autre origine
  // ne consent pas au nom du commercial connecté.
  const origine = req.headers.get("origin");
  if (origine && new URL(origine).host !== (req.headers.get("x-forwarded-host") ?? new URL(req.url).host))
    return NextResponse.json({ error: "origine_refusee" }, { status: 403 });

  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const corps = (await req.json().catch(() => ({}))) as { parametres?: Record<string, string>; decision?: string };
  const parametres = corps.parametres ?? {};
  const v = validerDemande(parametres, await lireClient(parametres.client_id));
  if (!v.ok) {
    if ("afficher" in v) return NextResponse.json({ error: v.afficher }, { status: 400 });
    const r = v.renvoyer;
    return NextResponse.json({ redirection: adresseAvecParametres(r.adresseRetour, { error: r.erreur, error_description: r.description, state: r.state }) });
  }
  const d = v.demande;
  if (corps.decision !== "autoriser")
    return NextResponse.json({ redirection: adresseAvecParametres(d.adresseRetour, { error: "access_denied", state: d.state }) });
  const code = await creerCode(d, auth.user.id);
  return NextResponse.json({ redirection: adresseAvecParametres(d.adresseRetour, { code, state: d.state }) });
}
