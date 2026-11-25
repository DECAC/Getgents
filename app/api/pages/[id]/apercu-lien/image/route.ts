import { requireUser } from "@/lib/server/session";
import { lirePage } from "@/lib/server/pages";
import { engagementDeLaPage } from "@/lib/server/engagementPages";
import { langueDuLecteur } from "@/lib/server/langueLecteur";
import { etatApercu, imageCapture } from "@/lib/server/apercusLien";
import { vignetteAvecCapture } from "@/lib/server/vignetteCapture";

/**
 * La vignette AVEC capture, pour l'auteur, avant de l'activer : exactement
 * l'image que recevront WhatsApp, LinkedIn… (même fonction que
 * `app/partage/[jeton]/opengraph-image.tsx`). Montre la capture rangée,
 * même si elle n'est plus celle de la version courante.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const auth = await requireUser();
  if ("response" in auth) return new Response("Connexion requise.", { status: 401 });
  const page = await lirePage(auth.user.id, id).catch(() => null);
  if (!page) return new Response("Page introuvable.", { status: 404 });
  const etat = await etatApercu(page.id);
  const png = etat?.version != null ? await imageCapture(page.id, etat.version) : null;
  if (!png) return new Response("Aucune capture.", { status: 404 });
  const [reglage, langue] = await Promise.all([
    engagementDeLaPage(page.id).catch(() => null),
    langueDuLecteur({ pageId: page.id, contenu: page.contenu }, undefined).catch(() => "fr" as const),
  ]);
  const image = await vignetteAvecCapture({ png, titre: page.titre, action: reglage?.actif ? reglage.intitule : null, langue });
  image.headers.set("Cache-Control", "private, no-store");
  return image;
}
