import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { replyAsGent } from "@/lib/server/gentReply";
import { sendWhatsAppText } from "@/lib/server/whatsapp";
import type { Espace } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Normalise un numéro pour comparaison (chiffres seulement) : Meta renvoie le
// wa_id sans « + », l'app stocke souvent « +33… ».
function digits(n: string): string {
  return n.replace(/\D/g, "");
}

/**
 * Vérification de l'abonnement au webhook par Meta (GET avec hub.challenge).
 * Meta appelle cette URL une fois à la configuration ; on renvoie le challenge
 * si le verify_token correspond à WHATSAPP_VERIFY_TOKEN.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

interface WebhookMessage {
  from: string;
  type: string;
  text?: { body: string };
}

/**
 * Messages entrants. Meta POST une notification à chaque message reçu par le
 * numéro business. On répond toujours 200 rapidement (Meta réessaie sinon) et
 * on traite le premier message texte : on retrouve le gent dont le canal
 * WhatsApp cible l'expéditeur, on fait répondre le gent, on renvoie la réponse
 * par WhatsApp (fenêtre de 24 h ouverte par ce message → texte libre autorisé)
 * et on persiste l'échange.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Extraction du premier message texte de la charge utile Meta.
  let msg: WebhookMessage | undefined;
  try {
    const entry = (body as { entry?: { changes?: { value?: { messages?: WebhookMessage[] } }[] }[] }).entry ?? [];
    for (const e of entry) {
      for (const c of e.changes ?? []) {
        const m = c.value?.messages?.[0];
        if (m) {
          msg = m;
          break;
        }
      }
      if (msg) break;
    }
  } catch {
    // charge utile inattendue (statuts de livraison, etc.) → ignorée
  }

  if (!msg || msg.type !== "text" || !msg.text?.body) {
    return NextResponse.json({ ok: true });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ ok: true });

  const sender = digits(msg.from);
  const { data } = await supabase.from("published_gents").select("id, espace");
  const match = (data ?? []).find((row) => {
    const ch = (row.espace as Espace).channel;
    return ch?.kind === "whatsapp" && ch.to && digits(ch.to) === sender;
  });

  if (!match) {
    // Aucun gent associé à ce numéro : on répond poliment sans planter.
    await sendWhatsAppText(msg.from, "Ce numéro n'est associé à aucun gent actif. Configurez la diffusion WhatsApp depuis Getgents.");
    return NextResponse.json({ ok: true });
  }

  const result = await replyAsGent(match.espace as Espace, msg.text.body);
  await sendWhatsAppText(msg.from, result.reply);
  await supabase.from("published_gents").upsert({ id: match.id, espace: result.espace });

  return NextResponse.json({ ok: true });
}
