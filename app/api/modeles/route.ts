import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { contexteForUser } from "@/lib/server/openRouterKey";
import { normaliserCatalogue } from "@/lib/openRouterCatalog";
import { MODEL_CATALOG } from "@/lib/mock-data/builder";

export const dynamic = "force-dynamic";

/**
 * Catalogue de modèles proposé dans le studio.
 *
 * Avec la clé de la plateforme, c'est la sélection qu'elle accepte de payer
 * (`MODEL_CATALOG`, dont dérive `PLATFORM_MODEL_IDS`). Avec une clé
 * personnelle, c'est le catalogue du compte OpenRouter : le builder paie, il
 * n'y a plus de raison de le brider.
 *
 * En cas d'échec, on renvoie le catalogue plateforme plutôt qu'une erreur :
 * un sélecteur vide serait pris pour une perte de configuration, alors qu'il
 * ne s'agit que d'une requête sortante ratée.
 */

const OPENROUTER_MODELS = "https://openrouter.ai/api/v1/models";
const DUREE_CACHE_MS = 10 * 60 * 1000;

/**
 * Cache par processus et par compte. Volontairement pas partagé : le
 * catalogue dépend de la clé, et servir celui d'un compte à un autre
 * afficherait des modèles que sa clé refuserait ensuite.
 */
const cache = new Map<string, { a: number; modeles: unknown[] }>();

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const ctx = await contexteForUser(auth.user.id);
  if (ctx.source !== "personnelle" || !ctx.cle) {
    return NextResponse.json({ source: "plateforme", modeles: MODEL_CATALOG });
  }

  const enCache = cache.get(auth.user.id);
  if (enCache && Date.now() - enCache.a < DUREE_CACHE_MS) {
    return NextResponse.json({ source: "personnelle", modeles: enCache.modeles });
  }

  try {
    const res = await fetch(OPENROUTER_MODELS, {
      headers: { Authorization: `Bearer ${ctx.cle}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ source: "plateforme", modeles: MODEL_CATALOG });
    }
    const modeles = normaliserCatalogue(await res.json());
    // Un catalogue vide n'est pas une réponse utilisable : mieux vaut la
    // sélection plateforme qu'un écran sans aucun choix.
    if (!modeles.length) {
      return NextResponse.json({ source: "plateforme", modeles: MODEL_CATALOG });
    }
    cache.set(auth.user.id, { a: Date.now(), modeles });
    return NextResponse.json({ source: "personnelle", modeles });
  } catch {
    return NextResponse.json({ source: "plateforme", modeles: MODEL_CATALOG });
  }
}
