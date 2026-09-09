// Provider e-mail transactionnel Brevo (ex-Sendinblue). API REST simple :
// une clé api-key côté serveur suffit, pas de validation de template. C'est le
// canal de diffusion le plus direct pour les notes de veille (aucun compte
// Meta ni opt-in par code requis, contrairement à WhatsApp).
const BREVO_API = process.env.BREVO_API_URL ?? "https://api.brevo.com/v3/smtp/email";

export function isBrevoConfigured(): boolean {
  return !!process.env.BREVO_API_KEY && !!process.env.BREVO_SENDER_EMAIL;
}

export interface EmailResult {
  ok: boolean;
  note: string;
}

/** Envoie un e-mail HTML. Le sujet et le corps sont composés par l'appelant. */
export async function sendBrevoEmail(to: string, subject: string, htmlContent: string): Promise<EmailResult> {
  if (!isBrevoConfigured()) return echec("Brevo non configuré (BREVO_API_KEY / BREVO_SENDER_EMAIL)");
  const senderEmail = process.env.BREVO_SENDER_EMAIL!;
  const senderName = process.env.BREVO_SENDER_NAME ?? "Getgents";

  try {
    const res = await fetch(BREVO_API, {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY!,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: to.trim() }],
        subject: subject.slice(0, 200),
        htmlContent,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      return echec(`échec Brevo ${res.status} : ${detail}`);
    }
    const data = (await res.json()) as { messageId?: string };
    return { ok: true, note: `livré (${data.messageId ?? "ok"})` };
  } catch (e) {
    return echec(`échec réseau Brevo : ${(e as Error).message.slice(0, 160)}`);
  }
}

/**
 * Un échec d'envoi LAISSE UNE TRACE.
 *
 * Ce module ne journalisait rien. Pire, un commentaire de `invitations.ts`
 * affirmait que « sendBrevoEmail journalise » — c'était faux, et cette
 * croyance a laissé la seule voie d'invitation échouer en silence : le
 * créateur voyait « invitation envoyée », le destinataire ne recevait rien,
 * et aucun journal ne le disait.
 *
 * L'adresse du destinataire n'est PAS journalisée : c'est une donnée
 * personnelle, et savoir QU'UN envoi a échoué suffit à diagnostiquer.
 */
function echec(note: string): EmailResult {
  console.error(JSON.stringify({ tag: "getgents:email", event: "envoi_echoue", note }));
  return { ok: false, note };
}
