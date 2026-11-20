import { NextResponse } from "next/server";
import { corpsEmailContact, MESSAGE_CONTACT, normaliserMessage, objetContact, validerMessage } from "@/lib/contact";
import { adresseNotificationsEditeur } from "@/lib/server/adresseEditeur";
import { sendBrevoEmail } from "@/lib/server/brevo";
import { offreDe } from "@/lib/server/offre";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Par compte, sur une heure glissante. */
const PLAFOND_PAR_HEURE = 5;
const envois = new Map<string, number[]>();

function journal(event: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ tag: "getgents:contact", event, ...extra }));
}

/**
 * « Nous contacter » (Mon compte) → e-mail à l'éditeur, « Répondre » vers
 * l'utilisateur.
 *
 * Comptes CONNECTÉS seulement : l'expéditeur est connu, d'où l'absence de
 * champ piège. Le plafond est tenu EN MÉMOIRE de l'instance — volontairement
 * approximatif (une fonction froide repart de zéro) : il arrête une boucle,
 * pas un acteur déterminé, qui n'aurait de toute façon que sa propre boîte à
 * remplir… et la nôtre. Rien n'est gardé en base (pas de migration) : un
 * échec d'envoi est DIT à l'utilisateur, dont le texte reste dans le champ.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  let brut: { message?: unknown };
  try {
    brut = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }
  const message = typeof brut.message === "string" ? brut.message : "";
  const probleme = validerMessage(message);
  if (probleme) return NextResponse.json({ error: MESSAGE_CONTACT[probleme] }, { status: 400 });

  const maintenant = Date.now();
  const recents = (envois.get(user.id) ?? []).filter((t) => maintenant - t < 3600_000);
  if (recents.length >= PLAFOND_PAR_HEURE) {
    journal("plafond", { userId: user.id });
    return NextResponse.json({ error: MESSAGE_CONTACT.trop }, { status: 429 });
  }

  const texte = normaliserMessage(message);
  const editeur = adresseNotificationsEditeur();
  const envoi = await sendBrevoEmail(
    editeur.adresse,
    objetContact(texte),
    corpsEmailContact(texte, {
      email: user.confirmedEmail,
      nomAffiche: user.nomAffiche,
      userId: user.id,
      offre: offreDe(user.id),
    }),
    user.confirmedEmail ? { replyTo: user.confirmedEmail } : {}
  );
  // Ni le message ni l'adresse ne sont journalisés.
  journal(envoi.ok ? "message_envoye" : "envoi_echoue", {
    userId: user.id,
    longueur: texte.length,
    destinataire: editeur.origine,
    note: envoi.ok ? undefined : envoi.note,
  });
  if (!envoi.ok) return NextResponse.json({ error: MESSAGE_CONTACT.envoi }, { status: 502 });

  envois.set(user.id, [...recents, maintenant]);
  return NextResponse.json({ ok: true });
}
