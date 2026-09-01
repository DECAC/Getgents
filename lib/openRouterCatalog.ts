import type { OpenRouterModel, ModelCapability } from "@/lib/types/builder";

/**
 * Traduction de la réponse `GET /api/v1/models` d'OpenRouter vers le type
 * qu'affiche le studio.
 *
 * Un builder qui branche sa clé voit le catalogue de SON compte, pas la
 * sélection que la plateforme accepte de payer. Le format d'OpenRouter n'est
 * pas sous notre contrôle : cette fonction ne lève JAMAIS et ignore en
 * silence tout ce qu'elle ne comprend pas. Un champ manquant coûte une entrée
 * du catalogue ; une exception coûterait l'écran entier.
 *
 * Module PUR.
 */

function texte(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Le prix d'OpenRouter est en dollars par token, exprimé en chaîne. */
function prixParMillion(v: unknown): number {
  const n = typeof v === "number" ? v : Number.parseFloat(texte(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 1_000_000 * 1000) / 1000;
}

/**
 * Capacité déduite des modalités déclarées. OpenRouter décrit
 * `architecture.modality` (« text->text », « text+image->text ») et parfois
 * `output_modalities`. On reste grossier volontairement : le studio ne range
 * les modèles que dans cinq casiers.
 */
function capaciteDe(brut: Record<string, unknown>): ModelCapability {
  const archi = (brut.architecture ?? {}) as Record<string, unknown>;
  const sorties = Array.isArray(archi.output_modalities)
    ? (archi.output_modalities as unknown[]).map((m) => texte(m))
    : [];
  const modalite = texte(archi.modality) || texte(brut.modality);

  if (sorties.includes("image") || /->\s*image/.test(modalite)) return "image";
  if (sorties.includes("audio") || /->\s*audio/.test(modalite)) return "tts";
  if (/audio\s*(\+|->)/.test(modalite) || sorties.includes("transcription")) return "stt";
  return "chat";
}

/** « anthropic/claude-sonnet-5 » → « Anthropic ». */
function fournisseurDe(id: string, brut: Record<string, unknown>): string {
  const declare = texte((brut.top_provider as Record<string, unknown> | undefined)?.name);
  if (declare) return declare;
  const prefixe = id.split("/")[0] ?? "";
  if (!prefixe) return "OpenRouter";
  return prefixe.charAt(0).toUpperCase() + prefixe.slice(1);
}

function entierPositif(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : Number.parseInt(texte(v), 10);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : undefined;
}

export function normaliserCatalogue(brut: unknown): OpenRouterModel[] {
  const racine = brut as Record<string, unknown> | null | undefined;
  const liste = Array.isArray(racine?.data)
    ? (racine!.data as unknown[])
    : Array.isArray(brut)
      ? (brut as unknown[])
      : [];

  const vus = new Set<string>();
  const modeles: OpenRouterModel[] = [];

  for (const item of liste) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const id = texte(m.id);
    // Un identifiant vide ou en double rendrait le sélecteur inutilisable :
    // deux entrées identiques, dont une seule serait réellement choisie.
    if (!id || vus.has(id)) continue;
    vus.add(id);

    const tarif = (m.pricing ?? {}) as Record<string, unknown>;
    modeles.push({
      id,
      label: texte(m.name) || id,
      provider: fournisseurDe(id, m),
      capability: capaciteDe(m),
      contextWindow: entierPositif(m.context_length),
      pricing: { input: prixParMillion(tarif.prompt), output: prixParMillion(tarif.completion) },
      tagline: texte(m.description).slice(0, 160),
    });
  }

  modeles.sort((a, b) => a.label.localeCompare(b.label, "fr"));
  return modeles;
}

/**
 * Le modèle configuré sur un gent doit rester visible même s'il a disparu du
 * catalogue. Un catalogue temporairement vide (401, panne réseau) effacerait
 * sinon la configuration de tous les gents du compte — la panne se
 * transformerait en perte de données.
 */
export function avecModeleConfigure(
  catalogue: OpenRouterModel[],
  modeleId: string | null | undefined
): OpenRouterModel[] {
  const id = texte(modeleId);
  if (!id || catalogue.some((m) => m.id === id)) return catalogue;
  return [
    {
      id,
      label: id,
      provider: fournisseurDe(id, {}),
      capability: "chat",
      pricing: { input: 0, output: 0 },
      tagline: "Plus disponible sur votre compte OpenRouter — choisissez un remplaçant.",
    },
    ...catalogue,
  ];
}
