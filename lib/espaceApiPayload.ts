import type { Espace } from "@/lib/types";
import { formatConversationStartedAt } from "@/lib/conversationUtils";
import { downloadableDocumentsForReader } from "@/lib/fileDownload";

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
 *
 * Le DASHBOARD DÉJÀ GÉNÉRÉ n'est jamais transmis non plus : c'est le résultat
 * personnel du créateur (produit à partir de son propre CV/sa propre
 * situation lors de ses tests), pas un aperçu neutre du gent. Le visiteur doit
 * démarrer d'un artefact vierge et générer SA propre version à partir de SES
 * propres entrées.
 */
export function espaceForPublicLink(espace: Espace): Espace {
  const pinned = espace.pinnedArtefact;
  // Type « visionneuse » : le document fixé par le créateur est un
  // livrable public du gent (comme starters/jumpForm), pas une donnée
  // personnelle du créateur — le destinataire doit pouvoir l'ouvrir.
  const visionneuseDoc = espace.visionneuse?.enabled
    ? espace.artefacts.find((a) => a.id === "visionneuse-doc")
    : undefined;
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
    // Fil vierge, mais bien PRÉSENT : les conversations du créateur ne
    // regardent pas le destinataire, en revanche un espace qui annonce un
    // `activeConversationId` sans le fil correspondant rend la conversation
    // muette (rien à quoi rattacher les messages).
    conversations: [{ id: "shared", startedAt: formatConversationStartedAt(), messages: [] }],
    activeConversationId: "shared",
    files: [],
    artefacts: visionneuseDoc ? [visionneuseDoc] : [],
    visionneuse: espace.visionneuse?.enabled ? { enabled: true } : undefined,
    jumpForm: espace.jumpForm,
    // Les déclencheurs décrivent les usages du gent, pas l'activité de son
    // créateur : ils sont donc transmis tels quels au destinataire, à qui ils
    // servent encore plus qu'à lui (il découvre le gent).
    starters: espace.starters,
    fileDownloadEnabled: espace.fileDownloadEnabled,
    fileDownloadFormEnabled: espace.fileDownloadFormEnabled,
    downloadableDocuments: espace.fileDownloadEnabled
      ? downloadableDocumentsForReader(espace)
      : undefined,
    // Application à blocs du studio : données simulées choisies par le
    // créateur, pas l'historique personnel — le destinataire voit la même app.
    appPreview: espace.appPreview,
    pinnedArtefact: pinned
      ? {
          enabled: pinned.enabled,
          title: pinned.title,
          mission: "", // le « prompt figé » reste côté serveur
          inputs: pinned.inputs.map((i) => ({ id: i.id, label: i.label, kind: i.kind })),
          // dashboard / generatedAt volontairement absents : voir ci-dessus.
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

/**
 * Charge utile pour générer les déclencheurs : uniquement ce qui décrit les
 * CAPACITÉS du gent. Ni conversations, ni artefacts, ni mémoire — la question
 * posée au modèle est « que sait faire ce gent ? », pas « qu'a fait cet
 * utilisateur ? », et l'espace complet ferait une requête inutilement lourde.
 */
export function espaceForStarters(espace: Espace): Espace {
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
    activeConversationId: espace.activeConversationId,
    // Seuls les NOMS des documents comptent ici : ils situent les thèmes
    // couverts, sans transmettre leur contenu intégral.
    files: (espace.files ?? []).map((f) => ({ ...f, text: undefined })),
    artefacts: [],
    systemPrompt: espace.systemPrompt,
    chatModelId: espace.chatModelId,
    webSearch: espace.webSearch,
    datasets: espace.datasets,
    mcpServers: espace.mcpServers,
    restApis: espace.restApis,
    prim: espace.prim,
    powens: espace.powens,
    routine: espace.routine,
    pinnedArtefact: espace.pinnedArtefact,
    // Onglets et titres seulement : assez pour coller les amorces à l'aperçu,
    // sans envoyer les données simulées de chaque bloc.
    appPreview: espace.appPreview?.modules.length
      ? {
          appName: espace.appPreview.appName,
          themes: espace.appPreview.themes,
          modules: espace.appPreview.modules.map((m) => ({
            id: m.id,
            title: m.title,
            theme: m.theme,
            size: m.size,
            source: m.source,
            blocks: [{ kind: "heading" as const, text: m.title }],
          })),
        }
      : undefined,
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
      "Connexion interrompue pendant la génération (souvent un délai serveur trop court avec " +
      "recherche web). Réessayez une fois ; si ça revient, désactivez temporairement la recherche " +
      "web sur le gent ou vérifiez que le déploiement Vercel est à jour (plan Pro recommandé pour " +
      "les opérations longues)."
    );
  }
  return `Erreur réseau : ${msg}`;
}
