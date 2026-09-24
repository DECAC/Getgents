import type { Artefact } from "@/lib/types";

/**
 * Un artefact ouvert dans un AUTRE ONGLET, pour y travailler au large.
 *
 * Le nouvel onglet n'a ni espace ni conversation : il reçoit une copie de
 * l'artefact par le localStorage (même origine), et y renvoie ses
 * modifications. L'onglet d'origine les applique en écoutant l'événement
 * `storage`, que le navigateur ne déclenche QUE dans les autres onglets :
 * pas de boucle possible.
 *
 * Module PUR : les lectures et écritures restent aux composants.
 */

export const PREFIXE_ONGLET = "getgents:onglet-artefact:";
const VERSION = 1;

/** Au-delà, une copie oubliée n'a plus de raison d'encombrer le navigateur. */
export const DUREE_VIE_ONGLET_MS = 7 * 24 * 3600 * 1000;

export interface MessageOnglet {
  v: typeof VERSION;
  /** L'espace qui détient l'artefact : un autre gent ouvert ne l'applique pas. */
  espaceId: string;
  artefact: Artefact;
  /** Qui a écrit en dernier : l'onglet d'origine n'applique que ce qui vient de l'onglet. */
  source: "espace" | "onglet";
  /** Présent : une édition, qui crée une version. Absent : une case cochée. */
  resume?: string;
  maj: number;
  cree: number;
  /** Faux : l'onglet n'offre pas les outils (réglage du créateur). */
  modifiable?: boolean;
}

export function cleOnglet(id: string): string {
  return `${PREFIXE_ONGLET}${id}`;
}

/** Identifiant d'ouverture : imprévisible, pour qu'une adresse ne se devine pas. */
export function nouvelIdOnglet(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export const ID_ONGLET = /^[a-z0-9-]{8,64}$/i;

export function lireMessageOnglet(brut: string | null): MessageOnglet | null {
  if (!brut) return null;
  let v: unknown;
  try {
    v = JSON.parse(brut);
  } catch {
    return null;
  }
  const m = v as Partial<MessageOnglet> | null;
  if (
    !m ||
    m.v !== VERSION ||
    typeof m.espaceId !== "string" ||
    !m.artefact ||
    typeof m.artefact.id !== "string" ||
    (m.source !== "espace" && m.source !== "onglet") ||
    typeof m.maj !== "number" ||
    typeof m.cree !== "number"
  ) {
    return null;
  }
  return m as MessageOnglet;
}

/** Clés de copies périmées, à retirer. */
export function clesPerimees(entrees: readonly [string, string | null][], maintenant: number): string[] {
  return entrees
    .filter(([cle]) => cle.startsWith(PREFIXE_ONGLET))
    .filter(([, brut]) => {
      const m = lireMessageOnglet(brut);
      return !m || maintenant - m.cree > DUREE_VIE_ONGLET_MS;
    })
    .map(([cle]) => cle);
}
