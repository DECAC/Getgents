import type { Artefact, ConversationThread, Espace, ThemeTab } from "@/lib/types";

/**
 * Ce que le VISITEUR d'un lien (page publique ou `/l/<jeton>`) a construit, et
 * qu'il retrouve en rechargeant la page.
 *
 * Sur un lien, ni cache local ni synchronisation Supabase : l'espace reçu du
 * serveur était la seule source. « Garder dans l'espace » ne gardait donc
 * rien au-delà de l'onglet ouvert — un rechargement effaçait la conversation
 * et chaque artefact gardé, sans prévenir.
 *
 * On conserve dans le navigateur du visiteur, et nulle part ailleurs :
 *   - ses conversations ;
 *   - les artefacts QU'IL a gardés — pas ceux que le créateur a diffusés, qui
 *     reviennent du serveur et doivent suivre une rediffusion au lieu d'être
 *     figés dans une copie ;
 *   - le rangement de SES artefacts en onglets.
 *
 * Module PUR : la lecture et l'écriture du localStorage restent à l'appelant.
 */

const VERSION = 1;
const PREFIXE = "getgents:visiteur:";

export interface MemoireVisiteur {
  v: typeof VERSION;
  conversations: ConversationThread[];
  activeConversationId: string;
  artefacts: Artefact[];
  themeTabs: ThemeTab[];
}

export function cleMemoireVisiteur(jeton: string): string {
  return `${PREFIXE}${jeton}`;
}

function moduleDe(artefact: Artefact): string {
  return `artef-${artefact.id}`;
}

/**
 * Extrait la part du visiteur. `diffuse` est l'espace tel que le serveur l'a
 * servi : tout artefact qui s'y trouve déjà appartient au créateur.
 *
 * Le raisonnement du modèle est retiré des messages : replié par défaut,
 * rarement relu, et c'est lui qui pèse le plus lourd face aux ~5 Mo du
 * localStorage.
 */
export function extraireMemoireVisiteur(espace: Espace, diffuse: Espace): MemoireVisiteur {
  const idsDiffuses = new Set(diffuse.artefacts.map((a) => a.id));
  const artefacts = espace.artefacts.filter((a) => !idsDiffuses.has(a.id));
  const modules = new Set(artefacts.map(moduleDe));
  const themeTabs = (espace.themeTabs ?? [])
    .map((t) => ({ ...t, moduleIds: t.moduleIds.filter((id) => modules.has(id)) }))
    .filter((t) => t.moduleIds.length > 0);

  return {
    v: VERSION,
    conversations: espace.conversations.map((t) => ({
      ...t,
      messages: t.messages.map(({ reasoning: _r, ...m }) => m),
    })),
    activeConversationId: espace.activeConversationId,
    artefacts,
    themeTabs,
  };
}

/** Relit une valeur stockée ; `null` pour tout ce qui n'a pas la forme attendue. */
export function lireMemoireVisiteur(brut: string | null): MemoireVisiteur | null {
  if (!brut) return null;
  let v: unknown;
  try {
    v = JSON.parse(brut);
  } catch {
    return null;
  }
  const m = v as Partial<MemoireVisiteur> | null;
  if (
    !m ||
    m.v !== VERSION ||
    !Array.isArray(m.conversations) ||
    typeof m.activeConversationId !== "string" ||
    !Array.isArray(m.artefacts) ||
    !Array.isArray(m.themeTabs)
  ) {
    return null;
  }
  return m as MemoireVisiteur;
}

/**
 * Réapplique la part du visiteur sur l'espace servi. Les artefacts du
 * visiteur passent devant (le plus récent en tête, comme au « Garder ») ; ses
 * onglets se fondent dans ceux du créateur quand ils portent le même nom.
 */
export function appliquerMemoireVisiteur(diffuse: Espace, memoire: MemoireVisiteur): Espace {
  const idsDiffuses = new Set(diffuse.artefacts.map((a) => a.id));
  const artefacts = memoire.artefacts.filter((a) => !idsDiffuses.has(a.id));
  const modules = new Set(artefacts.map(moduleDe));

  let themeTabs = diffuse.themeTabs ?? [];
  for (const onglet of memoire.themeTabs) {
    const ids = onglet.moduleIds.filter((id) => modules.has(id));
    if (!ids.length) continue;
    const existant = themeTabs.find((t) => t.label.toLowerCase() === onglet.label.toLowerCase());
    themeTabs = existant
      ? themeTabs.map((t) =>
          t === existant ? { ...t, moduleIds: [...t.moduleIds, ...ids.filter((id) => !t.moduleIds.includes(id))] } : t
        )
      : [...themeTabs, { ...onglet, moduleIds: ids }];
  }

  const conversations = memoire.conversations.length ? memoire.conversations : diffuse.conversations;
  const activeConversationId = conversations.some((t) => t.id === memoire.activeConversationId)
    ? memoire.activeConversationId
    : conversations[0]?.id ?? diffuse.activeConversationId;

  return {
    ...diffuse,
    conversations,
    activeConversationId,
    artefacts: [...artefacts, ...diffuse.artefacts],
    themeTabs,
  };
}
