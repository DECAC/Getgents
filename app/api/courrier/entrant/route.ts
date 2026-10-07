import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { traiterCourrierEntrant } from "@/lib/server/courrier";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function egal(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Webhook « Inbound parsing » de Brevo. Brevo ne signe pas ses envois : la
 * garde est un secret dans l'URL (`?secret=`, `BREVO_INBOUND_SECRET`), qui
 * sert aussi de graine aux adresses des gents. Sans secret configuré, la
 * route est FERMÉE. Toute autre issue répond 200 : Brevo réessaierait sinon,
 * et un courrier refusé ne doit pas être rejoué.
 */
export async function POST(req: Request) {
  const secret = process.env.BREVO_INBOUND_SECRET ?? "";
  const fourni = new URL(req.url).searchParams.get("secret") ?? "";
  if (!secret || !egal(fourni, secret)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let charge: unknown = null;
  try {
    charge = await req.json();
  } catch {
    return NextResponse.json({ ok: true, issue: "charge_illisible" });
  }
  const issue = await traiterCourrierEntrant(charge, secret);
  return NextResponse.json({ ok: true, issue });
}
