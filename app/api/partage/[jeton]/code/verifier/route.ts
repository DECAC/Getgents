import { NextResponse } from "next/server";
import { lireArtefact } from "@/lib/server/artefactsPartages";
import { cleAcces, verifierCode } from "@/lib/server/accesPartage";
import { codeSaisi, DUREE_ACCES_MS, nomCookie, signerAcces } from "@/lib/accesCode";

/**
 * Vérifie le code ; s'il est bon, pose le cookie d'accès DE CE LIEN (signé,
 * HttpOnly, 30 jours). Le document et l'assistant le revérifient à chaque
 * requête : l'écran du code n'est pas la seule garde.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { jeton: string } }) {
  const a = await lireArtefact(params.jeton);
  if (!a) return NextResponse.json({ error: "Ce lien n'existe pas ou a expiré." }, { status: 404 });
  const corps = (await req.json().catch(() => ({}))) as { code?: unknown };
  const code = codeSaisi(corps.code);
  if (!code) return NextResponse.json({ error: "Le code compte 6 chiffres." }, { status: 400 });
  const cle = cleAcces();
  if (!cle) return NextResponse.json({ error: "Service momentanément indisponible." }, { status: 503 });
  try {
    const r = await verifierCode(a.jeton, code);
    if (!r.ok) return NextResponse.json({ error: r.erreur }, { status: r.status });
  } catch (e) {
    console.error(JSON.stringify({ tag: "getgents:acces", event: "verification_echouee", detail: (e as Error).message }));
    return NextResponse.json({ error: "La vérification a échoué. Réessayez." }, { status: 500 });
  }
  const expire = Date.now() + DUREE_ACCES_MS;
  const rep = NextResponse.json({ ok: true });
  rep.cookies.set(nomCookie(a.jeton), signerAcces(cle, a.jeton, expire), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(DUREE_ACCES_MS / 1000),
  });
  return rep;
}
