// Les deux MODES de Getgents, et où mène chacun.
//
// Les utilisateurs ne comprenaient pas le lien entre Getgents, GetSpace et
// GetStudio : trois marques pour deux gestes. Il n'y a qu'un objet, le gent,
// et deux façons de s'en occuper — s'en SERVIR, ou le CONSTRUIRE. Les marques
// restent, en second ; l'action passe devant.
//
// Changer de mode garde le gent ouvert : depuis le studio d'un gent,
// « Utiliser » ouvre CE gent ; depuis son espace, « Construire » ouvre SES
// réglages. Ailleurs, chaque mode mène à sa liste.
//
// Module PUR.
import { cheminEspace } from "@/lib/diffusionPrivee";

export type Mode = "utiliser" | "construire" | "pages";

export const MODES: Record<Mode, { libelle: string; marque: string; sous: string; liste: string }> = {
  utiliser: { libelle: "Utiliser", marque: "GetSpace", sous: "Vos gents au quotidien", liste: "/myspace" },
  construire: { libelle: "Construire", marque: "GetStudio", sous: "Créer et configurer vos gents", liste: "/builder/mesgents" },
  // Troisième objet, pas un geste sur le gent : les pages viennent de Claude,
  // ChatGPT ou Mistral, et se partagent. D'où un NOM et non un verbe.
  pages: { libelle: "Pages", marque: "GetSite", sous: "Vos pages partagées depuis Claude, ChatGPT…", liste: "/pages" },
};

export const ORDRE_MODES: readonly Mode[] = ["utiliser", "construire", "pages"];

/** Le gent ouvert, s'il y en a un : de quoi construire son adresse d'espace. */
export interface GentOuvert {
  id: string;
  diffusionPrivee?: boolean;
  adressePrivee?: string;
}

/** Où mène un mode, depuis la page courante. */
export function cibleDuMode(mode: Mode, gent?: GentOuvert | null): string {
  // Les pages ne dépendent d'aucun gent : la rubrique, toujours.
  if (mode === "pages" || !gent?.id) return MODES[mode].liste;
  return mode === "utiliser" ? cheminEspace(gent.id, gent) : `/builder/${encodeURIComponent(gent.id)}`;
}
