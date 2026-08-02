import type { Espace } from "@/lib/types";

/**
 * Espace minimal pour les appels serveur (preview artefact, run routine) :
 * sans historique de chat ni corps d'artefacts — évite des requêtes JSON
 * trop lourdes qui provoquent « Failed to fetch ».
 */
export function espaceForPinnedRefresh(espace: Espace, inputs?: Record<string, string>): Espace {
  let pinned = espace.pinnedArtefact;
  if (pinned) {
    // L'historique des générations n'a aucune utilité pour produire le
    // dashboard : on l'exclut du payload (il est archivé côté client).
    const { runs: _runs, ...rest } = pinned;
    pinned = inputs
      ? { ...rest, inputs: rest.inputs.map((i) => (i.id in inputs ? { ...i, value: inputs[i.id] } : i)) }
      : rest;
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
    // Mémoire et documents font partie du contexte de session : l'artefact figé
    // doit voir exactement ce que voit la conversation. Seules les métadonnées
    // d'affichage sont écartées des fichiers, pas leur contenu.
    memory: espace.memory,
    conversations: [],
    activeConversationId: espace.activeConversationId || "local",
    files: (espace.files ?? []).filter((f) => (f.text ?? "").trim() !== ""),
    artefacts: [],
    systemPrompt: espace.systemPrompt,
    chatModelId: espace.chatModelId,
    webSearch: espace.webSearch,
    profile: espace.profile,
    pinnedArtefact: pinned,
  };
}

/**
 * Projection envoyée au navigateur d'un DESTINATAIRE de lien de partage.
 *
 * Liste blanche stricte : tout ce qui n'est pas nommé ici ne quitte pas le
 * serveur. `espaceForPinnedRefresh` ne convient pas — elle conserve
 * `systemPrompt` et `profile`.
 *
 * Sont notamment retirés :
 * - `systemPrompt` : c'est le travail du créateur, jamais exposé au visiteur
 *   (le chat passe par /api/links/[token]/chat, qui l'injecte côté serveur) ;
 * - `profile`, `memory`, `conversations`, `files`, `artefacts` : historique et
 *   données personnelles du créateur ;
 * - `restApis`, `mcpServers`, `datasets` : URL internes et surtout secrets
 *   d'authentification des connecteurs ;
 * - `routine`, `channel` : configuration de diffusion (dont le numéro/e-mail).
 *
 * Les VALEURS des entrées de l'artefact figé sont vidées : elles contiennent le
 * texte des documents fournis par le créateur (un CV, par exemple). Seuls les
 * libellés sont transmis, pour que le destinataire sache quoi renseigner.
 */
export function espaceForPublicLink(espace: Espace): Espace {
  const pinned = espace.pinnedArtefact;
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
    activeConversationId: "shared",
    files: [],
    artefacts: [],
    jumpForm: espace.jumpForm,
    pinnedArtefact: pinned
      ? {
          enabled: pinned.enabled,
          title: pinned.title,
          mission: "", // le « prompt figé » reste côté serveur
          inputs: pinned.inputs.map((i) => ({ id: i.id, label: i.label, kind: i.kind })),
          dashboard: pinned.dashboard,
          generatedAt: pinned.generatedAt,
        }
      : undefined,
  };
}

/**
 * Neutralise la mémoire et les documents avant une génération déclenchée par
 * quelqu'un d'autre que l'utilisateur auquel ils appartiennent.
 *
 * Rappel de sémantique : la mémoire est un résumé de l'usage du gent PAR SON
 * UTILISATEUR ; les fichiers sont ceux que CET UTILISATEUR a fournis. Ni l'un
 * ni l'autre n'appartiennent jamais au créateur (builder). Pour le visiteur
 * d'un lien de partage — qui n'a ni session ni fichiers propres au sens du
 * gent — la mémoire et les fichiers persistés sur l'espace sont ceux de
 * quelqu'un d'autre : ils ne doivent jamais nourrir sa génération. Seules les
 * valeurs qu'il renseigne lui-même (pinnedArtefact.inputs) le doivent.
 */
export function withoutSessionContext(espace: Espace): Espace {
  return { ...espace, memory: "", files: [] };
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
