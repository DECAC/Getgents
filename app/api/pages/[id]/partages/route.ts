import { NextResponse } from "next/server";
import { langueDuLecteur } from "@/lib/server/langueLecteur";
import { PlafondAtteint } from "@/lib/offre";
import { requireUser } from "@/lib/server/session";
import { enregistrerArtefact, lireArtefact, revoquerPartage } from "@/lib/server/artefactsPartages";
import { modeleMail, validerDemande } from "@/lib/mcpPartage";
import { origineDeRequete } from "@/lib/oauthMcp";
import { invitesValides } from "@/lib/groupesPages";
import { definirGroupe, groupesDisponibles } from "@/lib/server/groupesPages";

/**
 * « + Partager à… » depuis la fiche : un nouveau lien pour une page EXISTANTE,
 * sans repasser par Claude ni recopier le contenu. Même chemin que le
 * repartage du connecteur (`pageId`), donc mêmes gardes.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const corps = (await req.json().catch(() => ({}))) as { destinataire?: unknown; message?: unknown; invites?: unknown };
  const v = validerDemande({ page: params.id, destinataire: corps.destinataire, message: corps.message });
  if (!v.ok) return NextResponse.json({ error: v.erreur }, { status: 400 });
  // Lien de GROUPE : `invites` présent. Vérifié AVANT de créer le lien, sinon un refus laisserait un lien ordinaire au nom du groupe.
  const groupe = corps.invites === undefined ? null : invitesValides(corps.invites);
  if (groupe && groupe.length === 0) return NextResponse.json({ error: "Ajoutez au moins un invité, un prénom par ligne." }, { status: 400 });
  if (groupe && !(await groupesDisponibles().catch(() => false)))
    return NextResponse.json({ error: "Les liens de groupe ne sont pas encore installés (migration 033 à passer dans Supabase)." }, { status: 503 });
  try {
    const a = await enregistrerArtefact(v.demande, null, "getgents", { userId: auth.user.id, clientId: "" });
    if (!a) return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
    if (groupe) {
      const g = await definirGroupe(auth.user.id, a.jeton, groupe).catch((e) => `erreur: ${(e as Error).message}`);
      if (g !== "ok") {
        // Sans sa liste, le lien serait un lien ORDINAIRE au nom du groupe : on le coupe aussitôt.
        await revoquerPartage(auth.user.id, a.jeton).catch(() => false);
        console.error(JSON.stringify({ tag: "getgents:pages", event: "groupe_non_enregistre", cause: g }));
        return NextResponse.json({ error: "Le lien de groupe n'a pas pu être créé. Réessayez." }, { status: 500 });
      }
    }
    const lien = `${origineDeRequete(req.url, req.headers)}/partage/${a.jeton}`;
    // Le mail est lu par le destinataire : dans la langue des lecteurs de la page.
    const langue = await langueDuLecteur({ pageId: a.pageId, contenu: (await lireArtefact(a.jeton).catch(() => null))?.contenu ?? "" }, undefined).catch(
      () => "fr" as const
    );
    const mail = modeleMail({ ...v.demande, titre: a.titre }, lien, langue);
    console.log(JSON.stringify({ tag: "getgents:pages", event: "partage_depuis_getgents", ownerId: auth.user.id, groupe: groupe ? groupe.length : 0 }));
    return NextResponse.json({ lien, jeton: a.jeton, objet: mail.objet, corps: mail.corps, langue });
  } catch (e) {
    if (e instanceof PlafondAtteint) {
      console.info(JSON.stringify({ tag: "getgents:offre", event: "plafond", genre: e.genre }));
      return NextResponse.json({ error: e.message, plafond: e.genre }, { status: 409 });
    }
    console.error(JSON.stringify({ tag: "getgents:pages", event: "partage_echoue", detail: (e as Error).message }));
    return NextResponse.json({ error: "Le lien n'a pas pu être créé. Réessayez." }, { status: 500 });
  }
}
