import { MODEL_CATALOG } from "@/lib/mock-data/builder";

/**
 * Modèle de conversation d'un gent qui n'en a pas choisi.
 *
 * Il y en avait DEUX : le sélecteur du studio affichait le premier du
 * catalogue (Kimi K3) quand rien n'était choisi, pendant que l'espace, la
 * routine et la réponse WhatsApp appelaient Claude Sonnet 5. Le créateur
 * lisait un modèle et en testait un autre. Une seule valeur, ici.
 *
 * Module PUR.
 */
export const MODELE_CHAT_PAR_DEFAUT = "anthropic/claude-sonnet-5.5";

/**
 * Modèles RETIRÉS du catalogue, et leur successeur.
 *
 * Retirer un modèle ne suffit pas : sur la clé plateforme, un identifiant
 * inconnu retombe sur `DEFAULT_CHAT_MODEL_ID` — Kimi K3, le modèle de
 * l'assistant du builder (lib/allowedModels.ts). Un gent réglé sur Sonnet 5
 * aurait basculé EN SILENCE sur Kimi. On nomme donc le successeur, et chaque
 * lecture d'un modèle passe par `modeleActuel`. Le studio réécrit le réglage
 * du gent à la lecture (lib/builderDraftStorage.ts) : la migration se fait
 * au fil de l'usage, sans script.
 */
export const MODELES_REMPLACES: Readonly<Record<string, string>> = {
  "anthropic/claude-sonnet-5": "anthropic/claude-sonnet-5.5",
};

export function modeleActuel(id: string): string;
export function modeleActuel(id: string | null | undefined): string | undefined;
export function modeleActuel(id: string | null | undefined): string | undefined {
  if (!id) return id ?? undefined;
  return MODELES_REMPLACES[id.trim()] ?? id;
}

export interface ModeleEffectif {
  id: string;
  libelle: string;
  /** Vrai quand le gent n'a rien choisi : c'est le défaut qui répond. */
  parDefaut: boolean;
}

export function libelleModele(id: string): string {
  const actuel = modeleActuel(id);
  return MODEL_CATALOG.find((m) => m.id === actuel)?.label ?? id;
}

/** Le modèle qui répondra VRAIMENT, et s'il a été choisi ou non. */
export function modeleConversationEffectif(choisi: string | null | undefined): ModeleEffectif {
  const id = modeleActuel(choisi?.trim() || MODELE_CHAT_PAR_DEFAUT);
  return { id, libelle: libelleModele(id), parDefaut: !choisi?.trim() };
}
