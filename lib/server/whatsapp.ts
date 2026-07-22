// Provider WhatsApp Business Cloud API (Meta). L'envoi se fait côté serveur
// avec un token permanent et l'ID du numéro expéditeur, tous deux en variables
// d'environnement — jamais exposés au navigateur. Sans configuration, le
// runner saute la livraison en le traçant, sans casser le run.
const GRAPH_BASE = process.env.WHATSAPP_API_URL ?? "https://graph.facebook.com/v21.0";

export function isWhatsAppConfigured(): boolean {
  return !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;
}

export interface WhatsAppResult {
  ok: boolean;
  note: string;
}

/**
 * Envoie un message texte libre. À noter : hors de la fenêtre de service de
 * 24 h (dernier message entrant de l'utilisateur), Meta n'autorise QUE les
 * messages « template » pré-approuvés — un texte libre échoue alors avec une
 * erreur explicite, remontée telle quelle dans la note de livraison.
 */
export async function sendWhatsAppText(to: string, body: string): Promise<WhatsAppResult> {
  if (!isWhatsAppConfigured()) return { ok: false, note: "WhatsApp non configuré (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)" };
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const token = process.env.WHATSAPP_TOKEN!;

  try {
    const res = await fetch(`${GRAPH_BASE}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to.replace(/[^\d+]/g, ""),
        type: "text",
        text: { preview_url: true, body: body.slice(0, 4096) },
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      return { ok: false, note: `échec WhatsApp ${res.status} : ${detail}` };
    }
    const data = (await res.json()) as { messages?: { id: string }[] };
    return { ok: true, note: `livré (id ${data.messages?.[0]?.id ?? "?"})` };
  } catch (e) {
    return { ok: false, note: `échec réseau WhatsApp : ${(e as Error).message.slice(0, 160)}` };
  }
}

/**
 * Envoie un message « template » pré-approuvé — seule voie autorisée par Meta
 * hors de la fenêtre de service de 24 h (donc pour une note quotidienne non
 * sollicitée). `bodyParams` remplit les variables {{1}}, {{2}}… du corps du
 * template dans l'ordre.
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode = "en_US",
  bodyParams: string[] = []
): Promise<WhatsAppResult> {
  if (!isWhatsAppConfigured()) return { ok: false, note: "WhatsApp non configuré (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)" };
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const token = process.env.WHATSAPP_TOKEN!;

  const components = bodyParams.length
    ? [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text: text.slice(0, 1024) })) }]
    : undefined;

  try {
    const res = await fetch(`${GRAPH_BASE}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/[^\d+]/g, ""),
        type: "template",
        template: { name: templateName, language: { code: languageCode }, ...(components ? { components } : {}) },
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return { ok: false, note: `échec template ${res.status} : ${detail}` };
    }
    const data = (await res.json()) as { messages?: { id: string }[] };
    return { ok: true, note: `template livré (id ${data.messages?.[0]?.id ?? "?"})` };
  } catch (e) {
    return { ok: false, note: `échec réseau WhatsApp : ${(e as Error).message.slice(0, 160)}` };
  }
}
