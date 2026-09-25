import { consigneAmorces, lireAmorces } from "@/lib/amorcesContextuelles";
import { enTetesRecents } from "@/lib/server/gmail";
import { extractLlmMessageText } from "@/lib/server/llmMessageText";
import { enTetesOpenRouter, type ContexteLlm } from "@/lib/server/openRouterKey";
import { resolveModelId } from "@/lib/allowedModels";

const OPENROUTER_API = process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";
/** Un modèle rapide suffit : il reformule des en-têtes en quatre questions. */
const MODELE_AMORCES = "google/gemini-2.5-flash";

/** Les erreurs Gmail arrivent en JSON pour le modèle (`{"error":"…"}`) : on en garde la phrase. */
function messageLisible(erreur: string): string {
  try {
    const o = JSON.parse(erreur) as { error?: unknown };
    if (typeof o.error === "string") return o.error;
  } catch {
    // déjà une phrase
  }
  return erreur;
}

export async function genererAmorcesGmail(
  gentId: string,
  nomGent: string,
  ctx: ContexteLlm
): Promise<{ ok: true; amorces: string[]; messages: number } | { ok: false; erreur: string }> {
  const lus = await enTetesRecents(gentId);
  if (!lus.ok) return { ok: false, erreur: messageLisible(lus.erreur) };
  // Boîte vide sur la période : les amorces génériques du gent restent.
  if (!lus.entetes.length) return { ok: true, amorces: [], messages: 0 };
  if (!ctx.cle) return { ok: false, erreur: "Aucune clé de modèle disponible." };

  const modele = ctx.source === "plateforme" ? resolveModelId(MODELE_AMORCES) : MODELE_AMORCES;
  const debut = Date.now();
  try {
    const res = await fetch(OPENROUTER_API, {
      method: "POST",
      headers: enTetesOpenRouter(ctx.cle),
      body: JSON.stringify({
        model: modele,
        messages: [{ role: "user", content: consigneAmorces(lus.entetes, nomGent) }],
        max_tokens: 600,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { ok: false, erreur: `Le modèle a répondu ${res.status}` };
    const amorces = lireAmorces(extractLlmMessageText(await res.json()));
    console.log(
      JSON.stringify({
        tag: "getgents:amorces",
        event: "gmail",
        gentId,
        messages: lus.entetes.length,
        amorces: amorces.length,
        dureeMs: Date.now() - debut,
      })
    );
    return { ok: true, amorces, messages: lus.entetes.length };
  } catch {
    return { ok: false, erreur: "Le modèle n'a pas répondu à temps." };
  }
}
