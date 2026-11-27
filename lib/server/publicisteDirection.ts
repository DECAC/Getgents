import { enTetesOpenRouter, type ContexteLlm } from "@/lib/server/openRouterKey";
import { validerReponseStoryboard, type Scene } from "@/lib/publicisteStoryboard";
import { extractLlmMessageText } from "@/lib/server/llmMessageText";
import { resolveModelId } from "@/lib/allowedModels";
import { MODELE_CHAT_PAR_DEFAUT } from "@/lib/modeleConversation";
import type { FichePubliciste } from "@/lib/publiciste";
import {
  consigneDirection,
  validerProposition,
  MODELE_PLANCHE,
  MODELE_MUSIQUE,
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
export async function genererPlanche(ctx: ContexteLlm, prompt: string, modele = MODELE_PLANCHE, format = FORMAT_PLANCHE): Promise<ResultatPlanche> {
  if (!ctx.cle) return { ok: false, erreur: "Aucune clé de modèle disponible.", statut: 503 };
  const debut = Date.now();
  let res: Response;
  try {
    res = await fetch(OPENROUTER_API, {
      method: "POST",
      headers: enTetesOpenRouter(ctx.cle),
      body: JSON.stringify({
        model: modele,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
        image_config: { aspect_ratio: format },
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
  journal("planche", { modele, ok: !!url, ms: Date.now() - debut, cout });
  const m = url?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!m) return { ok: false, erreur: "Le modèle n'a renvoyé aucune image. Réessayez.", statut: 502 };
  return { ok: true, octets: Uint8Array.from(Buffer.from(m[2], "base64")), type: m[1], cout };
}

export type ResultatExtrait = { ok: true; octets: Uint8Array; cout: number } | { ok: false; erreur: string; statut: number };

/**
 * Un extrait de musique de 30 s (Lyria, lot 3). Lyria ne répond qu'en FLUX :
 * le son arrive en base64 dans `choices[0].delta.audio.data`, découpé ou non,
 * et le coût dans le dernier morceau (`usage.cost`). Mesuré le 27/11 : ~0,04 $,
 * MP3 de 30 s, une vingtaine de secondes.
 */
export async function genererExtraitMusique(ctx: ContexteLlm, prompt: string): Promise<ResultatExtrait> {
  if (!ctx.cle) return { ok: false, erreur: "Aucune clé de modèle disponible.", statut: 503 };
  const debut = Date.now();
  let res: Response;
  try {
    res = await fetch(OPENROUTER_API, {
      method: "POST",
      headers: enTetesOpenRouter(ctx.cle),
      body: JSON.stringify({
        model: MODELE_MUSIQUE,
        messages: [{ role: "user", content: prompt }],
        modalities: ["audio", "text"],
        audio: { format: "mp3" },
        stream: true,
        usage: { include: true },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(150_000),
    });
  } catch (e) {
    journal("musique_echec", { cause: (e as Error).name, ms: Date.now() - debut });
    return { ok: false, erreur: "Le compositeur n'a pas répondu à temps. Réessayez.", statut: 504 };
  }
  if (!res.ok || !res.body) {
    const corps = (await res.text().catch(() => "")).slice(0, 160);
    journal("musique_refus", { statut: res.status, corps });
    return { ok: false, erreur: `Le compositeur a refusé la demande (réf. ${res.status}).`, statut: res.status === 402 || res.status === 403 ? 503 : 502 };
  }
  const morceaux: string[] = [];
  let cout = 0;
  const lecteur = res.body.getReader();
  const dec = new TextDecoder();
  let reste = "";
  const lireLigne = (ligne: string) => {
    const l = ligne.trim();
    if (!l.startsWith("data:")) return;
    const donnee = l.slice(5).trim();
    if (!donnee || donnee === "[DONE]") return;
    try {
      const j = JSON.parse(donnee);
      const a = j?.choices?.[0]?.delta?.audio?.data;
      if (typeof a === "string" && a) morceaux.push(a);
      if (j?.usage?.cost != null) cout = Number(j.usage.cost) || cout;
    } catch {
      /* ligne de service */
    }
  };
  for (;;) {
    const { value, done } = await lecteur.read();
    if (done) break;
    reste += dec.decode(value, { stream: true });
    const lignes = reste.split("\n");
    reste = lignes.pop() ?? "";
    lignes.forEach(lireLigne);
  }
  lireLigne(reste);
  // Morceaux rembourrés séparément (« = » avant la fin) : décodés un à un.
  const separes = morceaux.slice(0, -1).some((m) => m.endsWith("="));
  const octets = separes
    ? Uint8Array.from(Buffer.concat(morceaux.map((m) => Buffer.from(m, "base64"))))
    : Uint8Array.from(Buffer.from(morceaux.join(""), "base64"));
  journal("musique", { ok: octets.length > 1000, ms: Date.now() - debut, cout, octets: octets.length });
  if (octets.length < 1000) return { ok: false, erreur: "Le compositeur n'a renvoyé aucun son. Réessayez.", statut: 502 };
  return { ok: true, octets, cout };
}

export type ResultatStoryboard = { ok: true; bulle: string[]; scenes: Scene[]; cout: number } | { ok: false; erreur: string; statut: number };

/** Lot 4 : écrire ou réviser le storyboard (un appel, JSON validé, deux essais). */
export async function ecrireStoryboard(ctx: ContexteLlm, consigne: string, revision: boolean): Promise<ResultatStoryboard> {
  if (!ctx.cle) return { ok: false, erreur: "Aucune clé de modèle disponible.", statut: 503 };
  const modele = ctx.source === "plateforme" ? resolveModelId(MODELE_CHAT_PAR_DEFAUT) : MODELE_CHAT_PAR_DEFAUT;
  let cout = 0;
  for (let essai = 1; essai <= 2; essai++) {
    const debut = Date.now();
    let res: Response;
    try {
      res = await fetch(OPENROUTER_API, {
        method: "POST",
        headers: enTetesOpenRouter(ctx.cle),
        body: JSON.stringify({ model: modele, messages: [{ role: "user", content: consigne }], max_tokens: 8_000, usage: { include: true } }),
        cache: "no-store",
        signal: AbortSignal.timeout(150_000),
      });
    } catch (e) {
      journal("storyboard_echec", { essai, cause: (e as Error).name });
      continue;
    }
    if (!res.ok) {
      const corps = (await res.text().catch(() => "")).slice(0, 160);
      journal("storyboard_refus", { essai, statut: res.status, corps });
      return { ok: false, erreur: `Le modèle a refusé la demande (réf. ${res.status}).`, statut: res.status === 402 || res.status === 403 ? 503 : 502 };
    }
    const data = await res.json();
    cout += Number(data?.usage?.cost ?? 0) || 0;
    const r = validerReponseStoryboard(jsonDuTexte(extractLlmMessageText(data)), revision);
    journal("storyboard", { revision, essai, ok: !!r, scenes: r?.scenes.length ?? 0, ms: Date.now() - debut, cout: data?.usage?.cost ?? null });
    if (r) return { ok: true, ...r, cout };
  }
  return { ok: false, erreur: "Le storyboard n'a pas pu être écrit. Réessayez.", statut: 502 };
}
