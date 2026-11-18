import { NextResponse } from "next/server";
import { verifierMotDePasse, MESSAGE_INSCRIPTION } from "@/lib/authMessages";
import { EMAIL_VALIDE } from "@/lib/demandeAcces";
import { emailConfirmation, emailDejaInscrit, emailNouvelleInscription } from "@/lib/emailInscription";
import { MESSAGE_INSCRIPTIONS_COMPLETES, POUR_QUOI_MAX, validerInscription } from "@/lib/inscriptions";
import { adresseNotificationsEditeur } from "@/lib/server/adresseEditeur";
import { sendBrevoEmail } from "@/lib/server/brevo";
import { comptesCrees, etatInscriptions, journalInscription, noterInscription } from "@/lib/server/inscriptions";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Au-delà, ce n'est plus un essai mais un robot : l'inscription attend une heure. */
const PLAFOND_HEURE = 10;

/**
 * Inscription libre PLAFONNÉE (18/11). Supabase garde ses inscriptions
 * publiques FERMÉES : c'est ICI que le compte est créé, avec la clé de
 * service, APRÈS vérification du plafond (`INSCRIPTIONS_PLAFOND`).
 *
 * `generateLink({ type: "signup" })` crée le compte NON confirmé et rend le
 * jeton ; l'e-mail part par Brevo (le nôtre, pas celui de Supabase), vers
 * `/auth/confirm?type=signup` — même vérification serveur que l'invitation.
 *
 * L'écran dit la MÊME chose que l'adresse soit libre ou déjà inscrite : il ne
 * doit pas servir à découvrir qui a un compte. La personne déjà inscrite
 * reçoit un e-mail qui le lui dit, à elle.
 */
export async function POST(req: Request) {
  let brut: Record<string, unknown>;
  try {
    brut = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }
  const texte = (v: unknown) => (typeof v === "string" ? v : "");
  const d = {
    email: texte(brut.email).trim().toLowerCase(),
    motDePasse: texte(brut.motDePasse),
    pourQuoi: texte(brut.pourQuoi).replace(/\r\n/g, "\n").trim().slice(0, POUR_QUOI_MAX + 1),
    piege: texte(brut.piege),
  };
  const probleme = validerInscription(d, EMAIL_VALIDE, verifierMotDePasse);
  if (probleme === "robot") {
    journalInscription("piege_rempli");
    return NextResponse.json({ ok: true, message: MESSAGE_INSCRIPTION });
  }
  if (probleme) return NextResponse.json({ error: probleme }, { status: 400 });

  const etat = await etatInscriptions();
  if (etat.genre === "fermees") return NextResponse.json({ error: "Les inscriptions ne sont pas ouvertes." }, { status: 409 });
  if (etat.genre === "completes") {
    journalInscription("plafond_atteint", { plafond: etat.plafond });
    return NextResponse.json({ error: MESSAGE_INSCRIPTIONS_COMPLETES, complet: true }, { status: 409 });
  }
  const derniereHeure = await comptesCrees(new Date(Date.now() - 3600 * 1000));
  if (derniereHeure === null || derniereHeure >= PLAFOND_HEURE) {
    journalInscription("plafond_horaire", { derniereHeure });
    return NextResponse.json({ error: "Beaucoup d'inscriptions en ce moment : réessayez dans une heure." }, { status: 429 });
  }

  const origine = new URL(req.url).origin;
  const sb = getSupabaseAdmin();
  if (!sb) {
    // Développement sans Supabase : aucun compte réel, le lien est écrit au journal.
    await noterInscription("dev", d.pourQuoi);
    journalInscription("compte_simule", { lien: `${origine}/auth/confirm?token_hash=dev&type=signup` });
    return NextResponse.json({ ok: true, message: MESSAGE_INSCRIPTION });
  }

  const { data, error } = await sb.auth.admin.generateLink({
    type: "signup",
    email: d.email,
    password: d.motDePasse,
    options: { data: { origine: "inscription" } },
  });
  if (error || !data?.user || !data.properties?.hashed_token) {
    const code = (error as { code?: string } | null)?.code ?? "";
    const deja = /exists|already|registered/i.test(`${code} ${error?.message ?? ""}`);
    if (deja) {
      const m = emailDejaInscrit(d.email, origine);
      const envoi = await sendBrevoEmail(d.email, m.objet, m.html);
      journalInscription("adresse_deja_inscrite", { avertie: envoi.ok });
      return NextResponse.json({ ok: true, message: MESSAGE_INSCRIPTION });
    }
    journalInscription("creation_refusee", { code, erreur: (error?.message ?? "sans jeton").slice(0, 160) });
    const mdp = /password/i.test(error?.message ?? "");
    return NextResponse.json(
      { error: mdp ? "Ce mot de passe est refusé : choisissez-en un plus long ou plus varié." : "Le compte n'a pas pu être créé. Réessayez dans un instant." },
      { status: mdp ? 400 : 503 }
    );
  }

  const lien = `${origine}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=signup`;
  const m = emailConfirmation(d.email, lien);
  const envoi = await sendBrevoEmail(d.email, m.objet, m.html);
  if (!envoi.ok) {
    // Sans e-mail, le compte ne pourrait jamais être activé — et l'adresse serait
    // « déjà inscrite » au prochain essai. On le retire : la personne réessaie.
    await sb.auth.admin.deleteUser(data.user.id).catch(() => undefined);
    journalInscription("email_non_envoye", { note: envoi.note });
    return NextResponse.json({ error: "L'e-mail de confirmation n'a pas pu partir. Réessayez dans un instant." }, { status: 503 });
  }

  await noterInscription(data.user.id, d.pourQuoi);
  const editeur = adresseNotificationsEditeur();
  const notif = await sendBrevoEmail(
    editeur.adresse,
    `Inscription — ${d.email}`,
    emailNouvelleInscription(d.email, d.pourQuoi, etat.restantes - 1),
    { replyTo: d.email }
  );
  // L'adresse n'est PAS journalisée.
  journalInscription("compte_cree", { restantes: etat.restantes - 1, notifie: notif.ok, destinataire: editeur.origine });
  return NextResponse.json({ ok: true, message: MESSAGE_INSCRIPTION });
}
