import { NextResponse } from "next/server";
import { requireUserWithQuota } from "@/lib/server/gentGuard";
import { lireProjet } from "@/lib/server/publicisteProjets";
import { ecrireStoryboard } from "@/lib/server/publicisteDirection";
import { idValide, refusPubliciste } from "@/lib/server/routePubliciste";
import { JEUX_VOIX, MA_VOIX, VOIX_GEMINI } from "@/lib/publicisteDirection";
import { consigneRevision, consigneStoryboard, validerScenes, type ContexteStoryboard } from "@/lib/publicisteStoryboard";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Publiciste, lot 4 : écrire le storyboard, ou le RÉVISER d'après les
 * corrections et remarques de l'auteur. Rien n'est écrit ici : la page range
 * la proposition (une révision n'est appliquée qu'après son accord).
 * La révision part des scènes envoyées par la page (avec les corrections pas
 * encore enregistrées) ; le contexte (brief, choix) est relu dans le projet.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await requireUserWithQuota("llm");
  if (!garde.ok) return garde.response;
  const { id } = await params;
  if (!idValide(id)) return NextResponse.json({ error: "id_invalide" }, { status: 400 });
  const body = await req.json().catch(() => null);
  const reviser = body?.mode === "reviser";
  const scenes = reviser ? validerScenes(body?.scenes) : null;
  if (reviser && !scenes) return NextResponse.json({ error: "scenes_invalides" }, { status: 400 });
  const commentaire = typeof body?.commentaire === "string" ? body.commentaire.trim().slice(0, 2000) : "";

  const projet = await lireProjet(garde.value.user.id, id);
  if (!projet.ok) return refusPubliciste(projet.cause);
  const { etat } = projet;
  const v = etat.direction?.visuel?.visuel?.find((p) => p.id === etat.choix.visuel);
  const m = etat.direction?.musique?.musique?.find((p) => p.id === etat.choix.musique);
  const voix = etat.choix.voix === MA_VOIX ? "la voix de l'auteur lui-même" : VOIX_GEMINI.find((x) => x.id === etat.choix.voix)?.nom;
  const c: ContexteStoryboard = {
    ...(v ? { univers: { nom: v.nom, desc: v.desc } } : {}),
    ...(m ? { musique: { nom: m.nom, ressenti: m.ressenti } } : {}),
    ...(voix ? { voix } : {}),
    ...(etat.voix?.jeu ? { jeu: JEUX_VOIX.find((j) => j.id === etat.voix?.jeu)?.nom } : {}),
  };
  const consigne = reviser ? consigneRevision(etat.fiche, c, scenes!, commentaire) : consigneStoryboard(etat.fiche, c);
  const r = await ecrireStoryboard(garde.value.ctx, consigne, reviser);
  if (!r.ok) return NextResponse.json({ error: "storyboard_echec", message: r.erreur }, { status: r.statut });
  return NextResponse.json({ bulle: r.bulle, scenes: r.scenes, cout: r.cout });
}
