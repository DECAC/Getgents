import { repliDirect } from "@/lib/server/domaineContenu";
import { marked } from "marked";
import { requireUser } from "@/lib/server/session";
import { contenuPourProprietaire } from "@/lib/server/pages";
import { CSP_ARTEFACT, documentArtefact } from "@/lib/documentArtefact";
import { cacheDocument, versDomaineContenu } from "@/lib/server/domaineContenu";
import { contenuAvecFichiers } from "@/lib/server/fichiersPages";

/**
 * Aperçu d'une page pour son PROPRIÉTAIRE (fiche, vignettes de la liste).
 * Même document et même isolement que chez le destinataire : CSP `sandbox`
 * sans `allow-same-origin` — le code de la page ne voit ni la session ni
 * Getgents, alors même que cette requête-ci porte les cookies du compte.
 * Avec `DOMAINE_CONTENU`, redirige vers le domaine de contenu.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser();
  if ("response" in auth) return new Response("Connexion requise.", { status: 401 });
  // Domaine de contenu : la session est vérifiée ICI ; le propriétaire est
  // dans l'adresse signée, et la lecture là-bas le revérifie.
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return new Response("Page introuvable.", { status: 404 });
  // `?direct=1` : repli du navigateur quand le domaine de contenu est bloqué
  // (useCadreAvecRepli) — le document est servi ici, isolé comme avant.
  const ailleurs = repliDirect(req, "page") ? null : versDomaineContenu(req, { t: "page", id: params.id, u: auth.user.id });
  if (ailleurs) return ailleurs;
  const page = await contenuPourProprietaire(auth.user.id, params.id).catch(() => null);
  if (!page) return new Response("Page introuvable.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const html = documentArtefact(await contenuAvecFichiers(page.id, page.contenu), page.format, page.titre, (md) => marked.parse(md, { async: false }) as string);
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": CSP_ARTEFACT,
      "Referrer-Policy": "no-referrer",
      "Cache-Control": cacheDocument("page"),
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
