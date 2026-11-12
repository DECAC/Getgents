import { marked } from "marked";
import { requireUser } from "@/lib/server/session";
import { contenuPourProprietaire } from "@/lib/server/pages";
import { CSP_ARTEFACT, documentArtefact } from "@/lib/documentArtefact";

/**
 * Aperçu d'une page pour son PROPRIÉTAIRE (fiche, vignettes de la liste).
 * Même document et même isolement que chez le destinataire : CSP `sandbox`
 * sans `allow-same-origin` — le code de la page ne voit ni la session ni
 * Getgents, alors même que cette requête-ci porte les cookies du compte.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return new Response("Connexion requise.", { status: 401 });
  const page = await contenuPourProprietaire(auth.user.id, params.id).catch(() => null);
  if (!page) return new Response("Page introuvable.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const html = documentArtefact(page.contenu, page.format, page.titre, (md) => marked.parse(md, { async: false }) as string);
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": CSP_ARTEFACT,
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
