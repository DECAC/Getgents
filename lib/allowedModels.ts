import { MODEL_CATALOG, BUILDER_ASSISTANT_MODEL_ID } from "@/lib/mock-data/builder";

/**
 * Modèles que la CLÉ DE LA PLATEFORME accepte de payer.
 *
 * `POST /api/chat` relayait `body.model` tel quel à OpenRouter : le modèle
 * — donc le prix au token — était choisi par l'appelant. Sur une route sans
 * authentification, cela revient à laisser un inconnu commander sur notre
 * compte, et à choisir le plat le plus cher de la carte.
 *
 * La liste est dérivée du catalogue affiché dans le studio : ce que le
 * créateur peut sélectionner est exactement ce que le serveur accepte. Un
 * identifiant inconnu ne fait pas échouer la requête — il retombe sur le
 * modèle par défaut, parce qu'un gent existant configuré avec un modèle
 * retiré du catalogue doit continuer à répondre.
 *
 * Cette liste ne concerne QUE la clé de la plateforme. Un builder qui branche
 * sa propre clé OpenRouter paie ses propres appels : il n'y a alors aucune
 * raison de le brider, et le catalogue élargi viendra de son compte.
 * Ne pas « harmoniser » les deux : ce sont deux problèmes différents.
 *
 * Module PUR — testable.
 */

export const PLATFORM_MODEL_IDS: readonly string[] = MODEL_CATALOG.map((m) => m.id);

export const DEFAULT_CHAT_MODEL_ID = BUILDER_ASSISTANT_MODEL_ID;

export function isPlatformModel(id: unknown): id is string {
  return typeof id === "string" && PLATFORM_MODEL_IDS.includes(id);
}

/**
 * Identifiant réellement envoyé à OpenRouter sur la clé plateforme.
 * `fallback` permet à un appelant d'imposer son propre défaut (l'aperçu
 * d'artefact ou le routeur super-gent n'ont pas le même modèle de référence).
 */
export function resolveModelId(requested: unknown, fallback: string = DEFAULT_CHAT_MODEL_ID): string {
  if (isPlatformModel(requested)) return requested;
  return isPlatformModel(fallback) ? fallback : DEFAULT_CHAT_MODEL_ID;
}
