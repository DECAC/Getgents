import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { nomCookie } from "@/lib/accesCode";
import { choixValides, ligneChoix, motValide, type ChoixLecteur } from "@/lib/engagement";
import { courrielAuteur } from "@/lib/server/activitePages";
import { decisionAcces } from "@/lib/server/accesPartage";
import { lireArtefact } from "@/lib/server/artefactsPartages";
import { sendBrevoEmail } from "@/lib/server/brevo";
import { engagementDeLaPage, enregistrerReponse } from "@/lib/server/engagementPages";
import { getUser } from "@/lib/server/session";

/**
 * Le LECTEUR clique le bouton d'engagement. Le jeton du lien fait l'accès,
 * comme pour le document ; une page protégée exige son code. UNE réponse par
 * lien ; le nom transmis est celui du lien. L'auteur reçoit un e-mail.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const echapper = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function courriel(titre: string, destinataire: string, intitule: string, mot: string | null, choix: ChoixLecteur[], lienFiche: string): { objet: string; html: string } {
  return {
    objet: `${destinataire} : « ${intitule} »`,
    html:
      `<p><b>${echapper(destinataire)}</b> a répondu « ${echapper(intitule)} » sur votre page <b>${echapper(titre)}</b>.</p>` +
      (choix.length
        ? `<p style="margin:12px 0 4px"><b>Ses choix dans la page :</b></p><ul style="margin:0 0 12px">${choix.map((c) => `<li>${echapper(ligneChoix(c))}</li>`).join("")}</ul>`
        : "") +
      (mot ? `<blockquote style="margin:0 0 0 8px;padding-left:12px;border-left:3px solid #ccc">${echapper(mot).replace(/\n/g, "<br>")}</blockquote>` : "") +
      `<p><a href="${echapper(lienFiche)}">Voir la page dans Getgents</a></p>`,
  };
}

export async function POST(req: Request, props: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await props.params;
  const a = await lireArtefact(jeton).catch(() => null);
  if (!a?.pageId || !a.ownerId) return NextResponse.json({ error: "Ce lien n'existe pas ou a expiré." }, { status: 404 });
  if ((await decisionAcces(a, (await cookies()).get(nomCookie(a.jeton))?.value)) !== "ouvert")
    return NextResponse.json({ error: "Accès protégé : validez votre code." }, { status: 403 });
  const reglage = await engagementDeLaPage(a.pageId).catch(() => null);
  if (!reglage?.actif) return NextResponse.json({ error: "L'auteur ne propose pas de réponse sur cette page." }, { status: 409 });
  const moi = await getUser();
  if (moi && moi.id === a.ownerId)
    return NextResponse.json({ error: "Vous êtes l'auteur de cette page : votre réponse n'est pas enregistrée. Ouvrez le lien en navigation privée pour essayer." }, { status: 409 });

  const corps = (await req.json().catch(() => ({}))) as { mot?: unknown; choix?: unknown };
  const choix = choixValides(corps.choix);
  const m = reglage.mot ? motValide(corps.mot) : { ok: true as const, mot: null };
  if (!m.ok) return NextResponse.json({ error: "Votre mot est trop long (500 caractères au plus)." }, { status: 400 });

  const r = await enregistrerReponse(a, reglage.intitule, m.mot, choix).catch(() => "erreur" as const);
  if (r === "deja") return NextResponse.json({ error: "Vous avez déjà répondu sur ce lien.", deja: true }, { status: 409 });
  if (r !== "ok") return NextResponse.json({ error: "Votre réponse n'a pas pu être envoyée. Réessayez." }, { status: 503 });

  // L'e-mail ne conditionne pas la réponse : elle est gardée, la fiche l'affiche.
  const adresse = await courrielAuteur(a.ownerId).catch(() => null);
  let notifie = false;
  if (adresse) {
    const c = courriel(a.titre, a.destinataire, reglage.intitule, m.mot, choix, `${new URL(req.url).origin}/pages/${a.pageId}`);
    notifie = (await sendBrevoEmail(adresse, c.objet, c.html).catch(() => ({ ok: false }))).ok;
  }
  console.log(JSON.stringify({ tag: "getgents:engagement", event: "reponse", avecMot: !!m.mot, choix: choix.length, notifie }));
  return NextResponse.json({ ok: true });
}
