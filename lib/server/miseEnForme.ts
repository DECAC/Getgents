import type { DashboardSpec } from "@/lib/dashboardArtefact";
import { CONSIGNE_MISE_EN_FORME } from "@/lib/miseEnForme";
import { extractPinnedDashboard } from "@/lib/server/pinnedArtefact";
import { extractLlmMessageText } from "@/lib/server/llmMessageText";
import { enTetesOpenRouter, type ContexteLlm } from "@/lib/server/openRouterKey";

const OPENROUTER_API = process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";
/** Une note se met en forme en quelques secondes ; au-delà, on abandonne proprement. */
const DELAI_MS = 90_000;

export type ResultatMiseEnForme = { ok: true; dashboard: DashboardSpec } | { ok: false; erreur: string };

/**
 * Un appel, sans outils ni recherche : le modèle ne travaille QUE sur le texte
 * de la note. La sortie repasse par le vocabulaire fermé des blocs
 * (`extractPinnedDashboard` → `parseDashboard`) : jamais de HTML libre.
 */
export async function mettreEnFormeNote(
  titre: string,
  contenu: string,
  modele: string,
  ctx: ContexteLlm
): Promise<ResultatMiseEnForme> {
  if (!ctx.cle) return { ok: false, erreur: "Aucune clé de modèle disponible." };
  const debut = Date.now();
  let texte = "";
  let statut: number | null = null;
  try {
    const res = await fetch(OPENROUTER_API, {
      method: "POST",
      headers: enTetesOpenRouter(ctx.cle),
      body: JSON.stringify({
        model: modele,
        messages: [
          { role: "system", content: CONSIGNE_MISE_EN_FORME },
          { role: "user", content: `Note « ${titre} » :\n\n${contenu}` },
        ],
        max_tokens: 8_000,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(DELAI_MS),
    });
    statut = res.status;
    if (!res.ok) {
      const corps = await res.text().catch(() => "");
      return { ok: false, erreur: `Le modèle a refusé la demande (${res.status}${corps ? ` : ${corps.slice(0, 120)}` : ""}).` };
    }
    texte = extractLlmMessageText(await res.json());
  } catch (e) {
    const expire = (e as Error).name === "TimeoutError";
    return {
      ok: false,
      erreur: expire ? "Le modèle n'a pas répondu à temps. Réessayez." : "Le modèle est injoignable. Réessayez.",
    };
  } finally {
    console.log(
      JSON.stringify({
        tag: "getgents:artefact",
        event: "mise_en_forme",
        model: modele,
        httpStatus: statut,
        dureeMs: Date.now() - debut,
        reponseChars: texte.length,
      })
    );
  }
  const dashboard = texte ? extractPinnedDashboard(texte) : null;
  if (!dashboard?.blocks.length) {
    return { ok: false, erreur: "La mise en forme n'a pas produit de note lisible. La note est inchangée ; réessayez." };
  }
  return { ok: true, dashboard };
}
