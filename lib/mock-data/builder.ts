import type {
  OpenRouterModel,
  ConnectorToolType,
  GentDraftsMap,
  ArtefactExample,
  KnowledgeSource,
} from "@/lib/types/builder";

// Catalogue de modèles accessible via une seule clé API OpenRouter.
// Le builder choisit un modèle par capacité — un seul est obligatoire (chat),
// les autres (image, voix) sont optionnels et activés selon les besoins du gent.
export const MODEL_CATALOG: OpenRouterModel[] = [
  {
    id: "openai/gpt-4.1",
    label: "GPT-4.1",
    provider: "OpenAI",
    capability: "chat",
    contextWindow: 1_000_000,
    pricing: { input: 2, output: 8 },
    tagline: "Généraliste, bon compromis coût / qualité pour la conversation.",
  },
  {
    id: "anthropic/claude-sonnet-5",
    label: "Claude Sonnet 5",
    provider: "Anthropic",
    capability: "chat",
    contextWindow: 200_000,
    pricing: { input: 3, output: 15 },
    tagline: "Excellent raisonnement et suivi d'instructions longues.",
  },
  {
    id: "mistralai/mistral-large",
    label: "Mistral Large",
    provider: "Mistral AI",
    capability: "chat",
    contextWindow: 128_000,
    pricing: { input: 2, output: 6 },
    tagline: "Modèle européen, bon équilibre performance / souveraineté des données.",
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "Google",
    capability: "chat",
    contextWindow: 1_000_000,
    pricing: { input: 0.3, output: 1.2 },
    tagline: "Rapide et économique — bon choix pour un premier brouillon.",
  },
  {
    id: "deepseek/deepseek-r1",
    label: "DeepSeek R1",
    provider: "DeepSeek",
    capability: "reasoning",
    contextWindow: 128_000,
    pricing: { input: 0.5, output: 2.1 },
    tagline: "Chaîne de raisonnement explicite pour les décisions complexes.",
  },
  {
    id: "openai/o4-mini",
    label: "o4-mini",
    provider: "OpenAI",
    capability: "reasoning",
    contextWindow: 200_000,
    pricing: { input: 1.1, output: 4.4 },
    tagline: "Raisonnement pas-à-pas, adapté aux calculs et à la planification.",
  },
  {
    id: "google/nanobanana",
    label: "Nanobanana",
    provider: "Google",
    capability: "image",
    pricing: { input: 0, output: 30 },
    tagline: "Génération d'images stylisées à partir de descriptions textuelles.",
  },
  {
    id: "black-forest-labs/flux-1.1-pro",
    label: "FLUX 1.1 Pro",
    provider: "Black Forest Labs",
    capability: "image",
    pricing: { input: 0, output: 40 },
    tagline: "Illustrations haute fidélité, rendu photo ou artistique.",
  },
  {
    id: "elevenlabs/tts-v3",
    label: "ElevenLabs TTS v3",
    provider: "ElevenLabs",
    capability: "tts",
    pricing: { input: 0, output: 18 },
    tagline: "Synthèse vocale naturelle multilingue (text-to-speech).",
  },
  {
    id: "openai/whisper-large-v3",
    label: "Whisper Large v3",
    provider: "OpenAI",
    capability: "stt",
    pricing: { input: 6, output: 0 },
    tagline: "Transcription vocale (speech-to-text), robuste au bruit ambiant.",
  },
];

// Types d'outils proposés au créateur d'un gent — pas des services déjà
// connectés, mais des modèles de configuration que le créateur personnalise.
export const CONNECTOR_TOOL_TYPES: ConnectorToolType[] = [
  {
    kind: "connecteur",
    name: "Connecteur",
    icon: "🔌",
    description:
      "Connectez-vous à des API et services propriétaires à l'aide des connecteurs Getgents pour extraire des données ou effectuer des actions.",
  },
  {
    kind: "connecteur-predefini",
    name: "Connecteur prédéfini",
    icon: "📦",
    description:
      "Choisissez parmi une sélection de connexions prédéfinies à des milliers d'API populaires, provenant de nombreux éditeurs, grands et petits.",
  },
  {
    kind: "connecteur-personnalise",
    name: "Connecteur personnalisé",
    icon: "🛠️",
    description:
      "Définissez une connexion à un service ou un système personnalisé pour activer des outils sur mesure. Le connecteur a besoin d'autorisations d'affichage et de partage pour l'organisation pour que l'assistant l'utilise.",
  },
  {
    kind: "flux-assistant",
    name: "Flux d'assistant",
    icon: "🔁",
    description: "Définissez un flux d'assistant, incluant une ou plusieurs actions à réaliser.",
  },
  {
    kind: "invite",
    name: "Invite",
    icon: "💬",
    description:
      "Invite basée sur un modèle à tour unique qui peut référencer les connaissances que vous fournissez et générer du code pour analyser les données.",
  },
  {
    kind: "api-rest",
    name: "API REST",
    icon: "🌐",
    description:
      "Connectez n'importe quelle API en la configurant entièrement à la main : URL, méthode, paramètres fixes, clé d'API et paramètres remplis par le gent (ex. SerpApi Google Flights). L'API est réellement appelée par le gent une fois publié.",
  },
  {
    kind: "mcp",
    name: "Protocole de contexte de modèle (MCP)",
    icon: "🔗",
    description: "Connectez-vous à un serveur MCP pour accéder aux outils et aux ressources.",
  },
  {
    kind: "dataset",
    name: "Dataset open data",
    icon: "🗺️",
    description:
      "Collez l'URL d'un jeu de données ouvert (opendata.paris.fr, data.gouv.fr…) : le gent pourra y chercher les enregistrements les plus proches d'une position.",
  },
  {
    kind: "prim",
    name: "IDFM PRIM (transports IDF)",
    icon: "🚌",
    description:
      "API officielle Île-de-France Mobilités : arrêts à proximité d'une position et prochains passages en temps réel (bus, métro, tram, RER). Authentifiée — la clé API (PRIM_API_KEY) est configurée côté serveur, jamais dans le navigateur.",
  },
  {
    kind: "powens",
    name: "Powens — agrégation bancaire (sandbox)",
    icon: "🏦",
    description:
      "Comptes et transactions bancaires via l'API Powens en MODE SANDBOX (données de test uniquement). Identifiants côté serveur (POWENS_DOMAIN, POWENS_CLIENT_ID, POWENS_CLIENT_SECRET) ; la banque sandbox se lie via la webview de consentement.",
  },
  {
    kind: "ordinateur",
    name: "Utilisation de l'ordinateur",
    icon: "🖥️",
    description:
      "Permet à votre assistant d'interagir avec n'importe quel système doté d'une interface utilisateur graphique, pour les sites web et les applications de bureau, en sélectionnant des boutons, en choisissant des menus et en saisissant du texte dans les champs à l'écran.",
  },
];

// Exemples illustratifs affichés dans l'onglet Artefacts du builder — tous
// les types sont éligibles pour tous les gents, sans configuration : le
// modèle décide seul, au fil de la conversation, quand en proposer un.
export const ARTEFACT_EXAMPLES: ArtefactExample[] = [
  {
    id: "tpl-report",
    label: "Rapport de synthèse",
    kind: "report",
    description: "Document texte structuré (titres, listes) généré à la demande.",
  },
  {
    id: "tpl-checklist",
    label: "Checklist",
    kind: "checklist",
    description: "Liste de tâches à cocher, utile pour un suivi de préparatifs.",
  },
  {
    id: "tpl-visual",
    label: "Aperçu visuel",
    kind: "visual",
    description: "Illustration stylisée générée par un modèle image (ex. Nanobanana).",
  },
  {
    id: "tpl-timeline",
    label: "Frise chronologique",
    kind: "timeline",
    description: "Étapes datées avec statut — adapté aux plannings et parcours.",
  },
  {
    id: "tpl-budget",
    label: "Suivi budgétaire",
    kind: "budget",
    description: "Enveloppe, répartition par poste et historique de dépenses.",
  },
  {
    id: "tpl-map",
    label: "Carte schématique",
    kind: "map",
    description: "Représentation schématique d'un parcours ou de lieux clés.",
  },
];

const KNOWLEDGE_VOYAGE: KnowledgeSource[] = [
  { id: "know-1", kind: "file", label: "Guide-gastronomie-sans-gluten.pdf", meta: "1,2 Mo · ajouté il y a 3 jours" },
  { id: "know-2", kind: "url", label: "https://www.guides-voyage.fr/alpes-familles", meta: "Page web de référence" },
  { id: "know-3", kind: "text", label: "Préférences de la famille Léaud", meta: "Note ajoutée manuellement" },
];

const KNOWLEDGE_SUCCESSION: KnowledgeSource[] = [
  { id: "know-1", kind: "file", label: "Bareme-droits-succession-2026.pdf", meta: "480 Ko · ajouté hier" },
];

export const GENT_DRAFTS: GentDraftsMap = {
  "voyage-v5": {
    id: "voyage-v5",
    name: "Compagnon de planification de voyage",
    icon: "🧭",
    objective:
      "Aider une famille à préparer un road trip de bout en bout : itinéraire, réservations, budget — sans jamais réserver ni payer à sa place.",
    systemPrompt: `Tu es le Compagnon de planification de voyage de Getgents.

Objectif : aider l'utilisateur à construire un itinéraire de voyage réaliste, dans son budget, en tenant compte de ses contraintes (famille, régime alimentaire, mobilité).

Règles impératives :
- Tu ne réserves et ne paies jamais à la place de l'utilisateur. Toute réservation proposée reste "en attente" jusqu'à validation explicite.
- Pour les comptes tiers (Booking.com...), tu ne peux déposer une proposition "envoyée" que si l'utilisateur a connecté son compte.
- Mets à jour la mémoire de l'espace à chaque décision structurante (étape ajoutée, budget révisé, préférence déclarée).
- Reste concis, propose des options plutôt que d'imposer un choix.`,
    status: "review",
    updatedAt: "il y a 2 heures",
    modelAssignments: [
      { capability: "chat", modelId: "anthropic/claude-sonnet-5" },
      { capability: "reasoning", modelId: null },
      { capability: "image", modelId: "google/nanobanana" },
      { capability: "tts", modelId: null },
      { capability: "stt", modelId: null },
    ],
    knowledgeSources: KNOWLEDGE_VOYAGE,
    connectors: [
      { id: "tool-1", toolKind: "mcp", name: "MCP Cartes" },
      { id: "tool-2", toolKind: "mcp", name: "MCP Fichiers" },
      { id: "tool-3", toolKind: "api-rest", name: "Webhook de réservation (écriture)" },
      { id: "tool-4", toolKind: "connecteur-predefini", name: "Booking.com" },
    ],
    builderConversation: [
      {
        role: "agent",
        text: "<p>Bonjour ! Je suis l'assistant du builder. Décrivez-moi l'objectif premier de ce gent et je vous aiderai à rédiger un prompt système solide.</p>",
        t: "09:02",
      },
      {
        role: "user",
        text: "<p>Il doit aider à planifier un road trip familial sans jamais réserver à la place de l'utilisateur.</p>",
        t: "09:03",
      },
      {
        role: "agent",
        text: "<p>Bien noté. J'ai structuré votre prompt en trois blocs : objectif, règles impératives (non-réservation, invariant compte tiers), et style de réponse. Vous pouvez l'ajuster librement dans l'onglet Prompt.</p>",
        t: "09:03",
      },
    ],
  },

  "succession-v1": {
    id: "succession-v1",
    name: "Accompagnement de succession",
    icon: "⚖️",
    objective:
      "Accompagner un particulier sur les étapes et délais d'une succession, sans se substituer à un notaire.",
    systemPrompt: `Tu es l'assistant Accompagnement de succession de Getgents.

Tu informes sur les étapes et délais légaux d'une succession en France. Tu ne fournis jamais de conseil juridique formel et rappelles systématiquement que le notaire reste l'interlocuteur de référence.

Cet espace traite des données sensibles : reste factuel, sobre, et évite toute conjecture sur des montants ou droits précis.`,
    status: "draft",
    updatedAt: "hier",
    modelAssignments: [
      { capability: "chat", modelId: "openai/gpt-4.1" },
      { capability: "reasoning", modelId: "deepseek/deepseek-r1" },
      { capability: "image", modelId: null },
      { capability: "tts", modelId: null },
      { capability: "stt", modelId: null },
    ],
    knowledgeSources: KNOWLEDGE_SUCCESSION,
    connectors: [{ id: "tool-1", toolKind: "mcp", name: "MCP Fichiers" }],
    builderConversation: [
      {
        role: "agent",
        text: "<p>Espace sensible détecté — pensez à activer le badge « Données sensibles » et à limiter les connecteurs au strict nécessaire.</p>",
        t: "lun.",
      },
    ],
  },

  // Cas d'usage « builder non technique » : prompt décrit en langage naturel
  // + un simple connecteur dataset (URL collée) — voir plan sanisettes.
  "sanisettes-paris": {
    id: "sanisettes-paris",
    name: "Toilettes publiques Paris",
    icon: "🚻",
    objective:
      "Guider l'utilisateur vers les toilettes publiques les plus proches à Paris, à partir des données ouvertes de la Ville.",
    systemPrompt: `Ton rôle est d'assister les users dans le guidage vers les toilettes publiques les plus proches. Voici les données de localisation : le jeu de données ouvert « sanisettesparis » de la Ville de Paris (connecté comme outil).

Le user doit pouvoir être guidé après avoir accepté de partager sa localisation. Tu peux afficher une carte, ou simplement lui donner l'adresse des toilettes les plus proches, avec les infos utiles (horaires, accès PMR, relais bébé).`,
    status: "draft",
    updatedAt: "à l'instant",
    modelAssignments: [
      { capability: "chat", modelId: "anthropic/claude-sonnet-5" },
      { capability: "reasoning", modelId: null },
      { capability: "image", modelId: null },
      { capability: "tts", modelId: null },
      { capability: "stt", modelId: null },
    ],
    knowledgeSources: [],
    connectors: [
      {
        id: "tool-1",
        toolKind: "dataset",
        name: "Toilettes publiques Paris (sanisettes)",
        detail: "https://opendata.paris.fr/explore/dataset/sanisettesparis/map/",
      },
    ],
    builderConversation: [
      {
        role: "agent",
        text: "<p>Votre dataset « sanisettesparis » est connecté : le gent pourra chercher les toilettes les plus proches d'une position partagée par l'utilisateur. Testez puis publiez quand vous êtes prêt.</p>",
        t: "à l'instant",
      },
    ],
  },

  "nouveau-gent": {
    id: "nouveau-gent",
    name: "Nouveau gent",
    icon: "✨",
    objective: "",
    systemPrompt: "",
    status: "draft",
    updatedAt: "à l'instant",
    modelAssignments: [
      { capability: "chat", modelId: null },
      { capability: "reasoning", modelId: null },
      { capability: "image", modelId: null },
      { capability: "tts", modelId: null },
      { capability: "stt", modelId: null },
    ],
    knowledgeSources: [],
    connectors: [],
    builderConversation: [
      {
        role: "agent",
        text: "<p>Bienvenue ! Décrivez en une phrase l'objectif premier de ce gent — je vous aiderai ensuite à construire le prompt système, choisir les modèles et les connecteurs adaptés.</p>",
        t: "à l'instant",
      },
    ],
  },
};
