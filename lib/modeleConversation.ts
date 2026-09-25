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
export const MODELE_CHAT_PAR_DEFAUT = "anthropic/claude-sonnet-5";

export interface ModeleEffectif {
  id: string;
  libelle: string;
  /** Vrai quand le gent n'a rien choisi : c'est le défaut qui répond. */
  parDefaut: boolean;
}

export function libelleModele(id: string): string {
  return MODEL_CATALOG.find((m) => m.id === id)?.label ?? id;
}

/** Le modèle qui répondra VRAIMENT, et s'il a été choisi ou non. */
export function modeleConversationEffectif(choisi: string | null | undefined): ModeleEffectif {
  const id = choisi?.trim() || MODELE_CHAT_PAR_DEFAUT;
  return { id, libelle: libelleModele(id), parDefaut: !choisi?.trim() };
}
