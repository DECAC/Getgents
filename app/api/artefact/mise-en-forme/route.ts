import { NextResponse } from "next/server";
import { requireUserWithQuota } from "@/lib/server/gentGuard";
import { mettreEnFormeNote } from "@/lib/server/miseEnForme";
import { resolveModelId } from "@/lib/allowedModels";
import { CONTENU_MAX } from "@/lib/miseEnForme";
import { MODELE_CHAT_PAR_DEFAUT } from "@/lib/modeleConversation";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * « Mettre en forme » une note gardée. Réservé aux comptes connectés : c'est
 * un appel au modèle facturé, et le visiteur d'un lien n'a pas de compte à
 * qui l'imputer. Rien n'est écrit ici — le navigateur range le résultat comme
 * une nouvelle version de la note.
 */
export async function POST(req: Request) {
  const garde = await requireUserWithQuota("llm");
  if (!garde.ok) return garde.response;

  let body: { titre?: unknown; contenu?: unknown; modele?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const titre = typeof body.titre === "string" ? body.titre.slice(0, 140) : "Note";
  const contenu = typeof body.contenu === "string" ? body.contenu.slice(0, CONTENU_MAX + 100) : "";
  if (!contenu.trim()) return NextResponse.json({ error: "contenu_vide" }, { status: 400 });

  const demande = typeof body.modele === "string" && body.modele ? body.modele : MODELE_CHAT_PAR_DEFAUT;
  // Clé de la plateforme : seul un modèle du catalogue est accepté.
  const modele = garde.value.ctx.source === "plateforme" ? resolveModelId(demande) : demande;

  const resultat = await mettreEnFormeNote(titre, contenu, modele, garde.value.ctx);
  if (!resultat.ok) return NextResponse.json({ ok: false, erreur: resultat.erreur }, { status: 502 });
  return NextResponse.json({ ok: true, dashboard: resultat.dashboard });
}
