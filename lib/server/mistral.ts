/**
 * « Ma voix » (Publiciste, lot 3) : la voix de l'auteur, recomposée par
 * Mistral (Voxtral TTS) à partir de SON enregistrement, joint à chaque
 * requête (`ref_audio`, rien n'est gardé chez Mistral). SEUL module qui lit
 * `MISTRAL_API_KEY` (un test le garde) : toujours la clé de la plateforme.
 * Mistral refuse une référence de plus de 30 s (vécu le 27/11) : le
 * navigateur la coupe avant l'envoi.
 */
export const MODELE_TTS = "voxtral-mini-tts-3-0";

export function mistralConfigure(): boolean {
  return !!process.env.MISTRAL_API_KEY;
}

export type ResultatMaVoix = { ok: true; wav: Uint8Array } | { ok: false; statut: number; cause: string };

export async function voixRecomposee(texte: string, reference: Uint8Array): Promise<ResultatMaVoix> {
  const cle = process.env.MISTRAL_API_KEY;
  if (!cle) return { ok: false, statut: 503, cause: "mistral_non_configure" };
  let r: Response;
  try {
    r = await fetch("https://api.mistral.ai/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODELE_TTS, input: texte, ref_audio: Buffer.from(reference).toString("base64"), response_format: "wav" }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    return { ok: false, statut: 504, cause: `reseau:${(e as Error).name}` };
  }
  if (!r.ok) {
    const detail = (await r.text().catch(() => "")).slice(0, 160);
    console.error(JSON.stringify({ tag: "getgents:publiciste", event: "ma_voix_refus", statut: r.status, detail }));
    return { ok: false, statut: r.status === 401 || r.status === 403 ? 503 : 502, cause: `mistral_${r.status}` };
  }
  const j = (await r.json().catch(() => null)) as { audio_data?: string } | null;
  if (!j?.audio_data) return { ok: false, statut: 502, cause: "mistral_sans_audio" };
  return { ok: true, wav: Uint8Array.from(Buffer.from(j.audio_data, "base64")) };
}
