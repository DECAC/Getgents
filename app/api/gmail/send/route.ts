import { NextRequest, NextResponse } from "next/server";
import { getConnectionStatus, sendMessage } from "@/lib/server/gmail";
import { GMAIL_NOT_CONNECTED_MESSAGE, parseEmailRecipients } from "@/lib/workspaceArtefacts";
import { requireGentOrDraftAccess } from "@/lib/server/gentGuard";

export async function POST(req: NextRequest) {
  let body: {
    gentId?: string;
    to?: string | string[];
    subject?: string;
    body?: string;
    htmlBody?: string;
    imageUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const gentId = body.gentId?.trim();
  if (!gentId) {
    return NextResponse.json({ error: "gentId requis." }, { status: 400 });
  }

  // Aucune garde jusqu'ici : avec un gentId, un tiers envoyait des e-mails
  // arbitraires DEPUIS LA BOÎTE GMAIL du créateur — un relais de hameçonnage
  // signé par un domaine légitime. Les jetons OAuth appartiennent au
  // propriétaire du gent, l'envoi aussi.
  const acces = await requireGentOrDraftAccess(gentId, "write");
  if (!acces.ok) return acces.response;

  const status = await getConnectionStatus(gentId);
  if (!status.connected) {
    return NextResponse.json({ error: GMAIL_NOT_CONNECTED_MESSAGE }, { status: 400 });
  }

  const rawTo = Array.isArray(body.to) ? body.to.join(", ") : body.to ?? "";
  const { emails, invalid } = parseEmailRecipients(rawTo);
  if (invalid.length) {
    return NextResponse.json({ error: `Adresse e-mail invalide : ${invalid.join(", ")}` }, { status: 400 });
  }
  if (!emails.length) {
    return NextResponse.json({ error: "Indiquez au moins un destinataire." }, { status: 400 });
  }

  const subject = body.subject?.trim() ?? "";
  const text = body.body ?? "";
  if (!subject) {
    return NextResponse.json({ error: "L'objet du message est requis." }, { status: 400 });
  }

  const result = await sendMessage(gentId, emails.join(", "), subject, text, {
    htmlBody: body.htmlBody,
    imageUrl: body.imageUrl,
  });

  try {
    const parsed = JSON.parse(result) as { error?: string };
    if (parsed?.error) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
  } catch {
    // Réponse Gmail brute (succès) — pas du JSON d'erreur.
  }

  return NextResponse.json({ ok: true, recipients: emails.length });
}
