import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { refusOffrePages } from "@/lib/server/offre";
import { ecrireProjet, lireProjet } from "@/lib/server/publicisteProjets";
import { validerEtat } from "@/lib/publiciste";

export const dynamic = "force-dynamic";

/**
 * Projet du gent « Le Publiciste » (migration 040) : lu et écrit par son
 * auteur seul — le propriétaire est celui de la session, jamais un paramètre.
 * Réservé aux comptes complets.
 */
const MESSAGE_NON_INSTALLE = "L'enregistrement du projet n'est pas encore installé (migration 040).";

async function auteur() {
  const auth = await requireUser();
  if ("response" in auth) return { refus: auth.response };
  const horsOffre = refusOffrePages(auth.user.id);
  if (horsOffre) return { refus: horsOffre };
  return { userId: auth.user.id };
}

const gentValide = (g: unknown): g is string => typeof g === "string" && /^[\w-]{1,120}$/.test(g);

export async function GET(req: Request) {
  const a = await auteur();
  if ("refus" in a) return a.refus;
  const gent = new URL(req.url).searchParams.get("gent");
  if (!gentValide(gent)) return NextResponse.json({ error: "gent_invalide" }, { status: 400 });
  const r = await lireProjet(a.userId, gent);
  if (!r.ok) return NextResponse.json({ error: r.cause, message: r.cause === "non_installe" ? MESSAGE_NON_INSTALLE : "Lecture du projet impossible." }, { status: 503 });
  return NextResponse.json({ etat: r.etat, version: r.version });
}

export async function PUT(req: Request) {
  const a = await auteur();
  if ("refus" in a) return a.refus;
  let body: { gent?: unknown; etat?: unknown; version?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!gentValide(body.gent)) return NextResponse.json({ error: "gent_invalide" }, { status: 400 });
  const etat = validerEtat(body.etat);
  if (!etat) return NextResponse.json({ error: "etat_invalide" }, { status: 400 });
  const version = typeof body.version === "number" && Number.isInteger(body.version) && body.version >= 0 ? body.version : -1;
  if (version < 0) return NextResponse.json({ error: "version_invalide" }, { status: 400 });
  const r = await ecrireProjet(a.userId, body.gent, etat, version);
  if (!r.ok) {
    if (r.cause === "conflit") return NextResponse.json({ error: "conflit", message: "Le projet a changé ailleurs : il est relu." }, { status: 409 });
    return NextResponse.json({ error: r.cause, message: r.cause === "non_installe" ? MESSAGE_NON_INSTALLE : "Enregistrement impossible." }, { status: 503 });
  }
  return NextResponse.json({ version: r.version });
}
