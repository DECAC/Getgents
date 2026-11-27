/**
 * Voix Gemini (Publiciste, lot 3). SEUL module qui lit `GEMINI_API_KEY` (un
 * test le garde) : ces voix ne passent pas par OpenRouter, c'est TOUJOURS la
 * clé de la plateforme qui paie — réservé aux comptes complets.
 *
 * Mesuré le 27/11 : `gemini-3.1-flash-tts-preview` (le modèle de la maquette)
 * refuse une fois sur deux (`finishReason: SAFETY`, sans son, « retry ») sur
 * une phrase anodine ; `gemini-2.5-flash-preview-tts` répond à chaque fois.
 * D'où : trois essais sur le premier, puis repli. Le son arrive en PCM 16 bits
 * 24 kHz mono (`audio/l16`) : enveloppé ici en WAV.
 */
const MODELES = [
  { id: "gemini-3.1-flash-tts-preview", essais: 3 },
  { id: "gemini-2.5-flash-preview-tts", essais: 2 },
];

export function geminiConfigure(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/** Enveloppe du PCM 16 bits mono en WAV. */
export function pcmEnWav(pcm: Uint8Array, taux = 24000): Uint8Array {
  const tete = new ArrayBuffer(44);
  const d = new DataView(tete);
  const ecr = (o: number, s: string) => [...s].forEach((c, i) => d.setUint8(o + i, c.charCodeAt(0)));
  ecr(0, "RIFF");
  d.setUint32(4, 36 + pcm.length, true);
  ecr(8, "WAVEfmt ");
  d.setUint32(16, 16, true);
  d.setUint16(20, 1, true);
  d.setUint16(22, 1, true);
  d.setUint32(24, taux, true);
  d.setUint32(28, taux * 2, true);
  d.setUint16(32, 2, true);
  d.setUint16(34, 16, true);
  ecr(36, "data");
  d.setUint32(40, pcm.length, true);
  const sortie = new Uint8Array(44 + pcm.length);
  sortie.set(new Uint8Array(tete), 0);
  sortie.set(pcm, 44);
  return sortie;
}

export type ResultatVoix = { ok: true; wav: Uint8Array; modele: string } | { ok: false; statut: number; cause: string };

export async function voixGemini(prompt: string, nomVoix: string): Promise<ResultatVoix> {
  const cle = process.env.GEMINI_API_KEY;
  if (!cle) return { ok: false, statut: 503, cause: "gemini_non_configure" };
  let derniere = "inconnue";
  for (const m of MODELES) {
    for (let essai = 1; essai <= m.essais; essai++) {
      let r: Response;
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m.id}:generateContent`, {
          method: "POST",
          headers: { "x-goog-api-key": cle, "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: nomVoix } } } },
          }),
          signal: AbortSignal.timeout(60_000),
        });
      } catch (e) {
        derniere = `reseau:${(e as Error).name}`;
        continue;
      }
      if (r.status === 429) {
        // Plafond par minute (vu à trois appels simultanés) : une pause, puis un nouvel essai.
        derniere = "gemini_quota";
        if (essai < m.essais) await new Promise((ok) => setTimeout(ok, 5_000));
        continue;
      }
      if (!r.ok) {
        derniere = `gemini_${r.status}`;
        if (r.status === 401 || r.status === 403) return { ok: false, statut: 503, cause: derniere };
        continue;
      }
      const d = await r.json().catch(() => null);
      const c = d?.candidates?.[0];
      const p = c?.content?.parts?.[0]?.inlineData;
      if (!p?.data) {
        derniere = `refus_${c?.finishReason ?? "sans_audio"}`;
        continue;
      }
      const brut = Uint8Array.from(Buffer.from(p.data, "base64"));
      const taux = Number(/rate=(\d+)/.exec(p.mimeType ?? "")?.[1] ?? 24000);
      return { ok: true, wav: /wav/.test(p.mimeType ?? "") ? brut : pcmEnWav(brut, taux), modele: m.id };
    }
  }
  return { ok: false, statut: derniere === "gemini_quota" ? 429 : 502, cause: derniere };
}
