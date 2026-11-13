import { NextResponse } from "next/server";
import { corpsEmailDemande, MESSAGE_DEMANDE, normaliserDemande, validerDemande } from "@/lib/demandeAcces";
import { adresseNotificationsEditeur } from "@/lib/server/adresseEditeur";
import { sendBrevoEmail } from "@/lib/server/brevo";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Par adresse, sur 24 h ; au total, sur 1 h. Au-delà, ce n'est plus une demande. */
const PLAFOND_PAR_ADRESSE = 3;
const PLAFOND_GLOBAL_HEURE = 30;

function journal(event: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ tag: "getgents:acces", event, ...extra }));
}

/**
 * Demande d'accès déposée depuis /inscription.
 *
 * ROUTE OUVERTE, et elle doit l'être : le visiteur n'a pas de compte — c'est
 * ce qu'il demande. Une route ouverte qui envoie des e-mails est un
 * distributeur de courrier indésirable sans garde-fou : champ piège, et
 * plafonds lus dans la table elle-même (par adresse, et au total).
 *
 * La base D'ABORD, l'e-mail ENSUITE : un e-mail perdu ne fait pas perdre la
 * demande. L'e-mail est attendu (quelques centaines de ms) : une promesse
 * laissée en vol après la réponse peut être coupée par l'hébergeur.
 */
export async function POST(req: Request) {
  let brut: { email?: unknown; motivation?: unknown; piege?: unknown };
  try {
    brut = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }
  const texte = (v: unknown) => (typeof v === "string" ? v : "");
  const demande = normaliserDemande({ email: texte(brut.email), motivation: texte(brut.motivation), piege: texte(brut.piege) });

  const probleme = validerDemande(demande);
  if (probleme === "robot") {
    // Rien n'est gardé ni envoyé ; on ne dit pas au robot qu'il a été repéré.
    journal("piege_rempli");
    return NextResponse.json({ ok: true });
  }
  if (probleme) return NextResponse.json({ error: MESSAGE_DEMANDE[probleme] }, { status: 400 });

  const supabase = getSupabaseAdmin();
  let id: string | null = null;
  if (supabase) {
    const jour = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const heure = new Date(Date.now() - 3600 * 1000).toISOString();
    const [parAdresse, total] = await Promise.all([
      supabase.from("demandes_acces").select("id", { count: "exact", head: true }).eq("email", demande.email).gte("created_at", jour),
      supabase.from("demandes_acces").select("id", { count: "exact", head: true }).gte("created_at", heure),
    ]);
    if (parAdresse.error || total.error) {
      journal("lecture_echouee", { erreur: (parAdresse.error ?? total.error)!.message.slice(0, 160) });
      return NextResponse.json({ error: MESSAGE_DEMANDE.serveur }, { status: 503 });
    }
    if ((parAdresse.count ?? 0) >= PLAFOND_PAR_ADRESSE || (total.count ?? 0) >= PLAFOND_GLOBAL_HEURE) {
      journal("plafond", { parAdresse: parAdresse.count, total: total.count });
      return NextResponse.json({ error: MESSAGE_DEMANDE.trop }, { status: 429 });
    }
    const { data, error } = await supabase
      .from("demandes_acces")
      .insert({ email: demande.email, motivation: demande.motivation })
      .select("id")
      .single();
    if (error || !data) {
      journal("enregistrement_echoue", { erreur: error?.message.slice(0, 160) });
      return NextResponse.json({ error: MESSAGE_DEMANDE.serveur }, { status: 503 });
    }
    id = data.id as string;
  } else {
    // Développement sans Supabase : rien n'est gardé, et on le dit.
    journal("non_gardee", { cause: "supabase_non_configure" });
  }

  const editeur = adresseNotificationsEditeur();
  const envoi = await sendBrevoEmail(editeur.adresse, `Demande d'accès — ${demande.email}`, corpsEmailDemande(demande), {
    replyTo: demande.email,
  });
  if (envoi.ok && supabase && id) await supabase.from("demandes_acces").update({ notifie: true }).eq("id", id);
  // L'adresse du demandeur n'est PAS journalisée : savoir qu'une demande est
  // arrivée, et si l'e-mail est parti, suffit à diagnostiquer.
  journal(envoi.ok ? "demande_recue" : "notification_echouee", { id, gardee: !!id, destinataire: editeur.origine, note: envoi.ok ? undefined : envoi.note });

  return NextResponse.json({ ok: true });
}
