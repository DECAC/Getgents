import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { PROLONGATION_MAX, prolongerPartages } from "@/lib/server/artefactsPartages";
import { plafondsDuCompte } from "@/lib/server/offre";
import { messagePlafond } from "@/lib/offre";

/**
 * Prolonge des liens (30 jours à partir d'aujourd'hui). Double garde :
 * session ET propriété (`prolongerPartages` filtre sur `owner_id`).
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const corps = (await req.json().catch(() => ({}))) as { jetons?: unknown };
  if (!Array.isArray(corps.jetons) || corps.jetons.length === 0 || corps.jetons.length > PROLONGATION_MAX || !corps.jetons.every((j) => typeof j === "string"))
    return NextResponse.json({ error: `Jetons attendus : 1 à ${PROLONGATION_MAX}.` }, { status: 400 });
  try {
    const r = await prolongerPartages(auth.user.id, corps.jetons as string[]);
    if (r.prolonges.length === 0) {
      if (r.ignores.some((i) => i.cause === "plafond")) {
        const limite = plafondsDuCompte(auth.user.id)?.liensActifs ?? 0;
        return NextResponse.json({ error: messagePlafond("liensActifs", limite), plafond: "liensActifs" }, { status: 409 });
      }
      return NextResponse.json({ error: "Ce lien ne peut pas être prolongé (révoqué ou introuvable)." }, { status: 404 });
    }
    return NextResponse.json(r);
  } catch (e) {
    console.error(JSON.stringify({ tag: "getgents:partage", event: "prolongation_echouee", detail: (e as Error).message }));
    return NextResponse.json({ error: "La prolongation n'a pas pu être enregistrée. Réessayez." }, { status: 500 });
  }
}
