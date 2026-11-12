import { marked } from "marked";
import { cookies } from "next/headers";
import { decisionAcces } from "@/lib/server/accesPartage";
import { nomCookie } from "@/lib/accesCode";
import { lireArtefact } from "@/lib/server/artefactsPartages";
import { CSP_ARTEFACT, documentArtefact } from "@/lib/documentArtefact";

/**
 * Le document de l'artefact, chargé dans le cadre de /partage/<jeton>.
 *
 * Hors du middleware (comme toute route /api/) : la politique du site, à
 * nonce, bloquerait les scripts de l'artefact. Celle-ci les autorise, mais
 * sous `sandbox` — origine opaque, donc ni cookies, ni stockage, ni appel
 * authentifié vers Getgents. Ouvert directement dans un onglet, le document
 * reste isolé de la même façon : la protection est dans la réponse, pas dans
 * le cadre.
 */

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { jeton: string } }) {
  const a = await lireArtefact(params.jeton);
  if (!a) return new Response("Ce lien n'existe pas ou a expiré.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  // Page protégée par code : sans cookie d'accès valide, rien ne sort.
  if ((await decisionAcces(a, cookies().get(nomCookie(a.jeton))?.value)) !== "ouvert")
    return new Response("Accès protégé : validez votre code sur la page du lien.", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const html = documentArtefact(a.contenu, a.format, a.titre, (md) => marked.parse(md, { async: false }) as string);
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": CSP_ARTEFACT,
      // Le jeton est dans l'adresse : il ne part pas chez les CDN que l'artefact appelle.
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
