import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { enregistrerArtefact } from "@/lib/server/artefactsPartages";
import { modeleMail, validerDemande } from "@/lib/mcpPartage";
import { origineDeRequete } from "@/lib/oauthMcp";

/**
 * « + Partager à… » depuis la fiche : un nouveau lien pour une page EXISTANTE,
 * sans repasser par Claude ni recopier le contenu. Même chemin que le
 * repartage du connecteur (`pageId`), donc mêmes gardes.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const corps = (await req.json().catch(() => ({}))) as { destinataire?: unknown; message?: unknown };
  const v = validerDemande({ page: params.id, destinataire: corps.destinataire, message: corps.message });
  if (!v.ok) return NextResponse.json({ error: v.erreur }, { status: 400 });
  try {
    const a = await enregistrerArtefact(v.demande, null, "getgents", { userId: auth.user.id, clientId: "" });
    if (!a) return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
    const lien = `${origineDeRequete(req.url, req.headers)}/partage/${a.jeton}`;
    const mail = modeleMail({ ...v.demande, titre: a.titre }, lien);
    console.log(JSON.stringify({ tag: "getgents:pages", event: "partage_depuis_getgents", ownerId: auth.user.id }));
    return NextResponse.json({ lien, jeton: a.jeton, objet: mail.objet, corps: mail.corps });
  } catch (e) {
    console.error(JSON.stringify({ tag: "getgents:pages", event: "partage_echoue", detail: (e as Error).message }));
    return NextResponse.json({ error: "Le lien n'a pas pu être créé. Réessayez." }, { status: 500 });
  }
}
