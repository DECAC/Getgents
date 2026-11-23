import { NextResponse } from "next/server";
import { lireJetonRappel } from "@/lib/jetonRappel";
import { clePourRappels, definirRappelsExpirationPour } from "@/lib/server/rappelsExpiration";
import { liensExpirantEntre, prolongerPartages } from "@/lib/server/artefactsPartages";
import { messagePlafond } from "@/lib/offre";
import { plafondsDuCompte } from "@/lib/server/offre";

export const dynamic = "force-dynamic";

/**
 * Exécute l'action d'un e-mail de rappel d'expiration : le POST de la page de
 * confirmation (jamais un GET). Le jeton signé dit le compte et l'action ; pas
 * de session. Idempotent : prolonger deux fois redonne 30 jours à partir de
 * maintenant, couper deux fois les rappels est sans effet.
 */
export async function POST(req: Request) {
  let body: { token?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token : "";
  const lu = lireJetonRappel(token, clePourRappels(), Date.now());
  if (!lu.ok)
    return NextResponse.json(
      { error: lu.raison === "expire" ? "Ce lien d'e-mail a expiré. Ouvrez Mes pages pour prolonger vos liens." : "Lien invalide." },
      { status: lu.raison === "expire" ? 410 : 400 }
    );
  const j = lu.jeton;

  if (j.t === "d") {
    const ok = await definirRappelsExpirationPour(j.u, false);
    return ok ? NextResponse.json({ ok: true, action: "desabonne" }) : NextResponse.json({ error: "L'enregistrement a échoué." }, { status: 500 });
  }

  const jetons = j.t === "p" ? [j.j] : (await liensExpirantEntre(j.u, j.de, j.a)).map((l) => l.jeton);
  if (!jetons.length) return NextResponse.json({ ok: true, action: "prolonge", prolonges: 0 });
  const r = await prolongerPartages(j.u, jetons);
  if (!r.prolonges.length && r.ignores.some((x) => x.cause === "plafond")) {
    const limite = plafondsDuCompte(j.u)?.liensActifs ?? 0;
    return NextResponse.json({ error: messagePlafond("liensActifs", limite) }, { status: 409 });
  }
  return NextResponse.json({ ok: true, action: "prolonge", prolonges: r.prolonges.length, ignores: r.ignores.length });
}
