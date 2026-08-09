import { NextResponse } from "next/server";
import { diffusedEspace, DIFFUSED_COLUMNS } from "@/lib/server/gentVersions";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { describeShareLinksFailure, getShareLink, TOKEN_RE } from "@/lib/server/shareLinks";
import { canOpen } from "@/lib/shareLink";
import { generateStarters } from "@/lib/server/starters";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Params {
  params: { token: string };
}

/**
 * Déclencheurs vus par le destinataire d'un lien de partage.
 *
 * Ils sont générés UNE SEULE FOIS par gent puis écrits dans sa version
 * diffusée : le premier visiteur d'un gent qui n'en a pas encore paie l'appel,
 * tous les suivants lisent la valeur en base. Sans cette écriture, chaque
 * ouverture de lien coûterait un appel au modèle — un lien partagé largement
 * deviendrait un générateur d'appels facturés.
 *
 * C'est aussi ce qui permet aux gents diffusés AVANT l'arrivée des
 * déclencheurs d'en afficher sans que leur créateur ait à republier.
 */
export async function POST(_req: Request, { params }: Params) {
  const token = params.token;
  if (!TOKEN_RE.test(token)) return NextResponse.json({ error: "invalid_token" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ starters: [] });

  let link;
  try {
    link = await getShareLink(token);
  } catch (e) {
    const { error, hint, status } = describeShareLinksFailure(e);
    return NextResponse.json({ error, hint }, { status });
  }
  if (!link || !canOpen(link)) return NextResponse.json({ starters: [] });

  const { data, error } = await supabase
    .from("published_gents")
    .select(DIFFUSED_COLUMNS)
    .eq("id", link.gentId)
    .maybeSingle();
  if (error) return NextResponse.json({ starters: [] });

  const espace = diffusedEspace(data);
  if (!espace || espace.pinnedArtefact?.enabled) return NextResponse.json({ starters: [] });
  if (espace.starters?.length) return NextResponse.json({ starters: espace.starters });

  const starters = await generateStarters(espace);
  if (!starters.length) return NextResponse.json({ starters: [] });

  // Écrit dans la version diffusée : c'est celle que sert ce lien, et la seule
  // que les prochains visiteurs liront.
  await supabase
    .from("published_gents")
    .update({ diffused: { ...espace, starters, startersGeneratedAt: new Date().toISOString() } })
    .eq("id", link.gentId);

  return NextResponse.json({ starters });
}
