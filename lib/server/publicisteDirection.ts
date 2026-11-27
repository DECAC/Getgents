import { enTetesOpenRouter, type ContexteLlm } from "@/lib/server/openRouterKey";
import { extractLlmMessageText } from "@/lib/server/llmMessageText";
import { resolveModelId } from "@/lib/allowedModels";
import { MODELE_CHAT_PAR_DEFAUT } from "@/lib/modeleConversation";
import type { FichePubliciste } from "@/lib/publiciste";
import {
  consigneDirection,
  validerProposition,
  MODELE_PLANCHE,
  FORMAT_PLANCHE,
  type ChoixPrecedents,
  type EtapeDirection,
  type Proposition,
} from "@/lib/publicisteDirection";

/**
 * Publiciste, lot 2 : les appels au modèle de la direction artistique.
 * Payés par le CONTEXTE de l'auteur (sa clé, ou celle de la plateforme et
 * son quota) — jamais une clé lue ici. Chaque appel est court : les pistes
 * d'une étape, ou UNE planche. Le coût réel est relu dans la réponse
 * d'OpenRouter (`usage.cost`).
 */

const OPENROUTER_API = process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";

function journal(event: string, donnees: Record<string, unknown>) {
  console.log(JSON.stringify({ tag: "getgents:publiciste", event, ...donnees }));
}

/** Le premier objet JSON d'un texte (le modèle l'entoure parfois d'une clôture de code). */
function jsonDuTexte(t: string): unknown {
  const debut = t.indexOf("{");
  const fin = t.lastIndexOf("}");
  if (debut < 0 || fin <= debut) return null;
  try {
    return JSON.parse(t.slice(debut, fin + 1));
  } catch {
    return null;
  }
}

export type ResultatProposition = { ok: true; proposition: Proposition; cout: number } | { ok: false; erreur: string; statut: number };

/** Trois pistes pour une étape. Une seconde tentative si la première réponse est inutilisable. */
export async function proposerPistes(
  ctx: ContexteLlm,
  etape: EtapeDirection,
  fiche: FichePubliciste,
  avant: ChoixPrecedents,
  remarque?: string
): Promise<ResultatProposition> {
  if (!ctx.cle) return { ok: false, erreur: "Aucune clé de modèle disponible.", statut: 503 };
  const modele = ctx.source === "plateforme" ? resolveModelId(MODELE_CHAT_PAR_DEFAUT) : MODELE_CHAT_PAR_DEFAUT;
  const consigne = consigneDirection(etape, fiche, avant, remarque);
  let cout = 0;
  for (let essai = 1; essai <= 2; essai++) {
    const debut = Date.now();
    let res: Response;
    try {
      res = await fetch(OPENROUTER_API, {
        method: "POST",
        headers: enTetesOpenRouter(ctx.cle),
        body: JSON.stringify({ model: modele, messages: [{ role: "user", content: consigne }], max_tokens: 4_000, usage: { include: true } }),
        cache: "no-store",
        signal: AbortSignal.timeout(120_000),
      });
    } catch (e) {
      journal("pistes_echec", { etape, essai, cause: (e as Error).name });
      continue;
    }
    if (!res.ok) {
      const corps = (await res.text().catch(() => "")).slice(0, 160);
      journal("pistes_refus", { etape, essai, statut: res.status, corps });
      return { ok: false, erreur: `Le modèle a refusé la demande (réf. ${res.status}).`, statut: res.status === 402 || res.status === 403 ? 503 : 502 };
    }
    const data = await res.json();
    cout += Number(data?.usage?.cost ?? 0) || 0;
    const proposition = validerProposition(etape, jsonDuTexte(extractLlmMessageText(data)), remarque);
    journal("pistes", { etape, essai, ok: !!proposition, ms: Date.now() - debut, cout: data?.usage?.cost ?? null });
    if (proposition) return { ok: true, proposition, cout };
  }
  return { ok: false, erreur: "Les pistes n'ont pas pu être préparées. Réessayez.", statut: 502 };
}

export type ResultatPlanche = { ok: true; octets: Uint8Array; type: string; cout: number } | { ok: false; erreur: string; statut: number };

/** Une planche d'ambiance, au format de la maquette (928×1152). */
export async function genererPlanche(ctx: ContexteLlm, prompt: string): Promise<ResultatPlanche> {
  if (!ctx.cle) return { ok: false, erreur: "Aucune clé de modèle disponible.", statut: 503 };
  const debut = Date.now();
  let res: Response;
  try {
    res = await fetch(OPENROUTER_API, {
      method: "POST",
      headers: enTetesOpenRouter(ctx.cle),
      body: JSON.stringify({
        model: MODELE_PLANCHE,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
        image_config: { aspect_ratio: FORMAT_PLANCHE },
        usage: { include: true },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(150_000),
    });
  } catch (e) {
    journal("planche_echec", { cause: (e as Error).name, ms: Date.now() - debut });
    return { ok: false, erreur: "Le modèle d'image n'a pas répondu à temps. Réessayez.", statut: 504 };
  }
  if (!res.ok) {
    const corps = (await res.text().catch(() => "")).slice(0, 160);
    journal("planche_refus", { statut: res.status, corps });
    return { ok: false, erreur: `Le modèle d'image a refusé la demande (réf. ${res.status}).`, statut: res.status === 402 || res.status === 403 ? 503 : 502 };
  }
  const data = await res.json();
  const msg = data?.choices?.[0]?.message ?? {};
  const url: string | undefined = msg?.images?.[0]?.image_url?.url;
  const cout = Number(data?.usage?.cost ?? 0) || 0;
  journal("planche", { ok: !!url, ms: Date.now() - debut, cout });
  const m = url?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!m) return { ok: false, erreur: "Le modèle n'a renvoyé aucune image. Réessayez.", statut: 502 };
  return { ok: true, octets: Uint8Array.from(Buffer.from(m[2], "base64")), type: m[1], cout };
}
