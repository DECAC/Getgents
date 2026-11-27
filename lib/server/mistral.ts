/**
 * Synthèse vocale Mistral (Voxtral TTS) pour le Publiciste. SEUL module qui
 * lit `MISTRAL_API_KEY` (un test le garde, comme pour OpenRouter) : Mistral
 * ne passe pas par OpenRouter, donc ni par la clé du créateur ni par ses
 * quotas — c'est TOUJOURS la clé de la plateforme qui paie.
 *
 * Plafond (lot 1, gent réservé à l'éditeur) : compté EN MÉMOIRE de
 * l'instance, par compte et par heure — approximatif, voulu. Avant toute
 * ouverture, un vrai plafond par compte et par mois, en base.
 */
import { voixMistral, texteADire } from "@/lib/publiciste";

export const MODELE_TTS = "voxtral-mini-tts-3-0";
export const PLAFOND_PHRASES_PAR_HEURE = 300;

export function mistralConfigure(): boolean {
  return !!process.env.MISTRAL_API_KEY;
}

const compteurs = new Map<string, { heure: number; n: number }>();

/** Compte une phrase pour ce compte ; faux si le plafond horaire est atteint. */
export function compterPhrase(userId: string, maintenant = Date.now()): boolean {
  const heure = Math.floor(maintenant / 3_600_000);
  const c = compteurs.get(userId);
  if (!c || c.heure !== heure) {
    compteurs.set(userId, { heure, n: 1 });
    return true;
  }
  if (c.n >= PLAFOND_PHRASES_PAR_HEURE) return false;
  c.n++;
  return true;
}

export type ResultatVoix = { ok: true; wav: Uint8Array } | { ok: false; statut: number; cause: string };

/** Fait dire `texte` par une voix toute prête. Rend le WAV, ou la cause de l'échec. */
export async function direTexte(texte: string, voix: string): Promise<ResultatVoix> {
  const cle = process.env.MISTRAL_API_KEY;
  if (!cle) return { ok: false, statut: 503, cause: "mistral_non_configure" };
  const voiceId = voixMistral(voix);
  if (!voiceId) return { ok: false, statut: 400, cause: "voix_inconnue" };
  const input = texteADire(texte);
  if (!input) return { ok: false, statut: 400, cause: "texte_vide" };
  let r: Response;
  try {
    r = await fetch("https://api.mistral.ai/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODELE_TTS, input, voice_id: voiceId, response_format: "wav" }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    return { ok: false, statut: 504, cause: `reseau: ${(e as Error).message}`.slice(0, 200) };
  }
  if (!r.ok) {
    const detail = (await r.text().catch(() => "")).slice(0, 200);
    return { ok: false, statut: r.status, cause: `mistral_${r.status}: ${detail}` };
  }
  try {
    const j = (await r.json()) as { audio_data?: string };
    if (!j.audio_data) return { ok: false, statut: 502, cause: "reponse_sans_audio" };
    return { ok: true, wav: Uint8Array.from(Buffer.from(j.audio_data, "base64")) };
  } catch {
    return { ok: false, statut: 502, cause: "reponse_illisible" };
  }
}
