import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { lireArtefact } from "@/lib/server/artefactsPartages";
import { decisionAcces } from "@/lib/server/accesPartage";
import { nomCookie } from "@/lib/accesCode";
import { appareilDe, battementValide } from "@/lib/activitePage";
import { enregistrerLecture } from "@/lib/server/activitePages";
import { getUser } from "@/lib/server/session";
import { origineDeRequete } from "@/lib/oauthMcp";

/**
 * Battement de lecture d'une page partagée. Le destinataire n'a pas de
 * compte : le jeton du lien fait l'accès, comme pour le document. Sans son
 * accord (widget), la visite est ANONYME — seul le jour est gardé. Les
 * visites de l'auteur lui-même ne comptent pas.
 *
 * Répond toujours 204 : une mesure qui échoue ne doit jamais gêner la
 * lecture, et le navigateur n'a rien à en faire. L'échec est journalisé.
 */
export const dynamic = "force-dynamic";

const rien = () => new NextResponse(null, { status: 204 });

export async function POST(req: Request, { params }: { params: { jeton: string } }) {
  try {
    const b = battementValide(await req.json().catch(() => null));
    if (!b) return rien();
    const a = await lireArtefact(params.jeton);
    if (!a?.pageId) return rien();
    if ((await decisionAcces(a, cookies().get(nomCookie(a.jeton))?.value)) !== "ouvert") return rien();
    const moi = await getUser();
    if (moi && moi.id === a.ownerId) return rien();
    await enregistrerLecture(a, b, appareilDe(req.headers.get("user-agent")), origineDeRequete(req.url, req.headers));
  } catch (e) {
    console.error(JSON.stringify({ tag: "getgents:activite", event: "lecture_echouee", detail: (e as Error).message }));
  }
  return rien();
}
