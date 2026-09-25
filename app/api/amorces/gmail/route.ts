import { NextResponse } from "next/server";
import { requireGentAccess, requireUserWithQuota } from "@/lib/server/gentGuard";
import { genererAmorcesGmail } from "@/lib/server/amorcesGmail";
import type { Espace } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/i;

/**
 * Amorces tirées des en-têtes de la boîte mail connectée au gent.
 *
 * PROPRIÉTAIRE SEULEMENT : les jetons Gmail d'un gent sont ceux de son
 * créateur. Un co-éditeur, a fortiori un visiteur, ne doit rien apprendre de
 * sa boîte — même pas l'objet d'un message.
 */
export async function POST(req: Request) {
  let body: { gentId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const gentId = typeof body.gentId === "string" ? body.gentId : "";
  if (!ID_RE.test(gentId)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const acces = await requireGentAccess(gentId, "read");
  if (!acces.ok) {
    // Le gent n'existe côté serveur qu'après un premier Preview ou une
    // diffusion : on le dit, plutôt qu'un 404 sans explication.
    if (acces.response.status === 404) {
      return NextResponse.json(
        { ok: false, erreur: "Ce gent n'est pas encore enregistré : cliquez d'abord sur Preview ou « Diffuser le gent »." },
        { status: 404 }
      );
    }
    return acces.response;
  }
  if (acces.value.role !== "owner") {
    return NextResponse.json(
      { ok: false, erreur: "Seul le créateur du gent peut tirer des amorces de sa boîte mail." },
      { status: 403 }
    );
  }

  const garde = await requireUserWithQuota("llm");
  if (!garde.ok) return garde.response;

  const espace = acces.value.row.espace as Espace | null;
  const resultat = await genererAmorcesGmail(gentId, espace?.name || "Assistant", garde.value.ctx);
  if (!resultat.ok) return NextResponse.json({ ok: false, erreur: resultat.erreur }, { status: 502 });
  return NextResponse.json({ ok: true, amorces: resultat.amorces, messages: resultat.messages });
}
