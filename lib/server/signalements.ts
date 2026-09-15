import { getSupabaseAdmin } from "@/lib/server/supabase";
import { sendBrevoEmail, isBrevoConfigured } from "@/lib/server/brevo";
import { appUrl } from "@/lib/server/invitations";
import {
  corpsEmailSignalement,
  sujetEmailSignalement,
  type Signalement,
} from "@/lib/signalement";
import { ADRESSE_DEMANDE_ACCES } from "@/lib/inscriptions";

/**
 * Enregistrement et notification des signalements d'incident.
 *
 * L'ORDRE COMPTE, et c'est tout le sujet de ce module : on écrit en base
 * D'ABORD, on notifie ENSUITE. Un envoi qui échoue — fournisseur en panne,
 * clé absente, adresse rejetée — ne doit pas faire disparaître le retour de
 * quelqu'un qui a pris la peine de l'écrire. Une notification perdue se
 * rattrape en lisant la table ; un signalement perdu ne se rattrape pas.
 */

/** Adresse de la plateforme, en copie de tous les signalements. */
export const ADRESSE_PLATEFORME = ADRESSE_DEMANDE_ACCES;

/**
 * Combien de signalements ce lien a-t-il déposés depuis `secondes` ?
 *
 * Sert de garde-fou de débit. Une route ouverte qui envoie des e-mails est un
 * distributeur de courrier indésirable si on la laisse sans plafond. Le compte
 * se lit dans la table des signalements plutôt que dans un compteur dédié :
 * une infrastructure de moins, et la donnée est déjà là.
 *
 * En cas d'erreur on renvoie 0 — donc on laisse passer. Refuser un
 * signalement parce que notre compteur est en panne punirait l'utilisateur
 * d'un incident dont il n'est pas l'auteur, et sur une route dont l'objet est
 * justement de recueillir les incidents.
 */
export async function signalementsRecents(token: string, secondes: number): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;

  const depuis = new Date(Date.now() - secondes * 1000).toISOString();
  const { count, error } = await supabase
    .from("gent_reports")
    .select("id", { count: "exact", head: true })
    .eq("token", token)
    .gte("created_at", depuis);

  if (error) return 0;
  return count ?? 0;
}

export async function enregistrerSignalement(input: {
  gentId: string;
  token: string | null;
  signalement: Signalement;
}): Promise<{ ok: boolean; id?: number }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false };

  const { data, error } = await supabase
    .from("gent_reports")
    .insert({
      gent_id: input.gentId,
      token: input.token,
      appreciation: input.signalement.appreciation,
      motif: input.signalement.motif,
      precision: input.signalement.precision.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error(
      JSON.stringify({ tag: "getgents:signalement", event: "insert_failed", detail: error.message })
    );
    return { ok: false };
  }
  return { ok: true, id: data?.id as number | undefined };
}

/**
 * Prévient le propriétaire du gent, avec copie à la plateforme.
 *
 * Le propriétaire d'abord : c'est SON gent, et c'est lui qui peut corriger.
 * Envoyer uniquement à la plateforme marcherait tant qu'il n'y a qu'un
 * créateur, et deviendrait faux — et indiscret — dès qu'un tiers publie : ses
 * retours d'utilisateurs partiraient chez nous et pas chez lui.
 *
 * Ne lève jamais : la réponse au visiteur ne dépend pas de notre messagerie.
 */
export async function notifierSignalement(input: {
  gentId: string;
  nomGent: string;
  signalement: Signalement;
  reportId?: number;
}): Promise<void> {
  if (!isBrevoConfigured()) return;

  const corps = corpsEmailSignalement({
    nomGent: input.nomGent,
    signalement: input.signalement,
    lien: `${appUrl()}/builder/${input.gentId}`,
  });
  const sujet = sujetEmailSignalement(input.nomGent);

  const destinataires = new Set<string>([ADRESSE_PLATEFORME]);
  const emailProprietaire = await adresseDuProprietaire(input.gentId);
  if (emailProprietaire) destinataires.add(emailProprietaire);

  let envoye = false;
  for (const adresse of Array.from(destinataires)) {
    const res = await sendBrevoEmail(adresse, sujet, corps).catch(() => ({ ok: false }));
    if (res.ok) envoye = true;
  }

  if (envoye && input.reportId !== undefined) {
    const supabase = getSupabaseAdmin();
    await supabase
      ?.from("gent_reports")
      .update({ notifie_le: new Date().toISOString() })
      .eq("id", input.reportId);
  }
}

/** Adresse du propriétaire d'un gent, ou `null` si le gent n'a pas été réclamé. */
async function adresseDuProprietaire(gentId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data } = await supabase
    .from("published_gents")
    .select("owner_id")
    .eq("id", gentId)
    .maybeSingle();

  const ownerId = (data?.owner_id as string | null) ?? null;
  if (!ownerId) return null;

  const { data: user } = await supabase.auth.admin.getUserById(ownerId);
  return user?.user?.email ?? null;
}

/**
 * Prévient qu'un invité s'est servi d'un gent — au plus UNE FOIS PAR JOUR et
 * par lien.
 *
 * `recordShareEvent(token, "chat")` se déclenche à chaque tour de
 * conversation. Notifier là serait envoyer vingt e-mails pour une discussion
 * de vingt messages, et plusieurs centaines par jour pour une poignée
 * d'invités actifs : le fournisseur limiterait, et surtout le destinataire
 * cesserait de les lire — ce qui annule exactement l'objectif.
 *
 * Ce qu'on veut savoir est « quelqu'un s'est mis à utiliser ce gent », pas
 * « une phrase de plus a été écrite ». Une notification par lien et par jour
 * porte cette information sans le bruit.
 *
 * Ne lève jamais : une notification n'a pas à casser une conversation.
 */
export async function notifierUsageInvite(input: {
  gentId: string;
  nomGent: string;
  token: string;
  label?: string | null;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase || !isBrevoConfigured()) return;

  try {
    const { data } = await supabase
      .from("share_usage_notices")
      .select("notifie_le")
      .eq("token", input.token)
      .maybeSingle();

    const dernier = data?.notifie_le ? new Date(data.notifie_le as string).getTime() : 0;
    if (Date.now() - dernier < 24 * 60 * 60 * 1000) return;

    // On marque AVANT d'envoyer : deux messages arrivés dans la même seconde
    // ne doivent pas produire deux e-mails. Un envoi raté coûte alors une
    // notification, ce qui est très préférable à une rafale.
    await supabase
      .from("share_usage_notices")
      .upsert({ token: input.token, gent_id: input.gentId, notifie_le: new Date().toISOString() });

    const qui = input.label?.trim();
    await sendBrevoEmail(
      ADRESSE_PLATEFORME,
      `Votre gent « ${input.nomGent} » est utilisé`,
      [
        `<p>Quelqu'un vient de se servir de <b>${echapper(input.nomGent)}</b>` +
          (qui ? ` via le partage « ${echapper(qui)} »` : " via un lien de partage") +
          ".</p>",
        "<p style=\"color:#666;font-size:12px\">Une seule notification par lien et par jour : " +
          "vous n'en recevrez pas une par message. Le contenu des conversations n'est pas " +
          "transmis, et l'utilisateur n'est pas identifié.</p>",
      ].join("\n")
    );
  } catch (e) {
    console.error(
      JSON.stringify({
        tag: "getgents:signalement",
        event: "usage_notice_failed",
        detail: (e as Error).message,
      })
    );
  }
}

function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
