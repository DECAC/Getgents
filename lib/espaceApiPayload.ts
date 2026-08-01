import type { Espace } from "@/lib/types";

/**
 * Espace minimal pour les appels serveur (preview artefact, run routine) :
 * sans historique de chat ni corps d'artefacts — évite des requêtes JSON
 * trop lourdes qui provoquent « Failed to fetch ».
 */
export function espaceForPinnedRefresh(espace: Espace, inputs?: Record<string, string>): Espace {
  let pinned = espace.pinnedArtefact;
  if (pinned && inputs) {
    pinned = {
      ...pinned,
      inputs: pinned.inputs.map((i) => (i.id in inputs ? { ...i, value: inputs[i.id] } : i)),
    };
  }
  return {
    icon: espace.icon,
    name: espace.name,
    gent: espace.gent,
    version: espace.version,
    status: espace.status,
    statusLabel: espace.statusLabel,
    sensitive: espace.sensitive,
    metrics: [],
    integrations: [],
    tools: [],
    tabs: [],
    map: null,
    memory: "",
    conversations: [],
    activeConversationId: espace.activeConversationId || "local",
    files: [],
    artefacts: [],
    systemPrompt: espace.systemPrompt,
    chatModelId: espace.chatModelId,
    webSearch: espace.webSearch,
    profile: espace.profile,
    pinnedArtefact: pinned,
  };
}

/** Coquille légère pour exécuter une routine : le fil actif est vide, le serveur n'y ajoute que les nouveaux messages. */
export function espaceForRoutineRun(espace: Espace): Espace {
  return {
    ...espaceForPinnedRefresh(espace),
    routine: espace.routine,
    channel: espace.channel,
    conversations: espace.conversations.map((c) => ({
      id: c.id,
      startedAt: c.startedAt,
      messages: c.id === espace.activeConversationId ? [] : [],
    })),
    activeConversationId: espace.activeConversationId,
  };
}

/** Fusionne le résultat d'un run routine (coquille serveur) dans l'espace complet local. */
export function mergeRoutineRunResult(base: Espace, result: Espace): Espace {
  const threadId = base.activeConversationId;
  const resultThread = result.conversations.find((c) => c.id === threadId);
  const newMessages = resultThread?.messages ?? [];

  let artefacts = base.artefacts;
  if (result.artefacts.length > 0) {
    const newOnes = result.artefacts.filter((a) => !base.artefacts.some((b) => b.id === a.id));
    if (newOnes.length) artefacts = [...newOnes, ...base.artefacts];
  }

  return {
    ...base,
    routine: result.routine ?? base.routine,
    channel: result.channel ?? base.channel,
    artefacts,
    conversations: base.conversations.map((c) =>
      c.id === threadId ? { ...c, messages: [...c.messages, ...newMessages] } : c
    ),
  };
}

export function formatApiNetworkError(err: unknown): string {
  const msg = (err as Error).message ?? "erreur inconnue";
  if (msg === "Failed to fetch") {
    return (
      "Connexion interrompue. L'opération peut prendre 1 à 2 minutes (recherche web + génération). " +
      "Si l'erreur persiste : vérifiez que l'app tourne (npm run dev ou déploiement Vercel à jour), " +
      "puis réessayez."
    );
  }
  return `Erreur réseau : ${msg}`;
}
