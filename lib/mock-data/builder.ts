import type {
  OpenRouterModel,
  ConnectorCatalogEntry,
  GentDraftsMap,
  ArtefactTemplateConfig,
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

export const CONNECTOR_CATALOG: ConnectorCatalogEntry[] = [
  {
    id: "mcp-cartes",
    name: "MCP Cartes",
    kind: "mcp",
    icon: "🗺️",
    category: "lecture",
    desc: "Calcule trajets et itinéraires via un serveur MCP tiers. Lecture seule.",
    endpointHint: "mcp://cartes.getgents.tools",
  },
  {
    id: "mcp-recherche-web",
    name: "MCP Recherche web",
    kind: "mcp",
    icon: "🔎",
    category: "lecture",
    desc: "Recherche d'informations publiques à jour. Lecture seule.",
    endpointHint: "mcp://search.getgents.tools",
  },
  {
    id: "mcp-fichiers",
    name: "MCP Fichiers",
    kind: "mcp",
    icon: "📁",
    category: "lecture",
    desc: "Lit les fichiers déposés par l'utilisateur dans l'espace (PDF, images).",
    endpointHint: "mcp://files.getgents.tools",
  },
  {
    id: "webhook-ecriture",
    name: "Webhook générique (écriture)",
    kind: "mcp",
    icon: "✏️",
    category: "ecriture",
    desc: "Envoie une action vers un système tiers après confirmation explicite de l'utilisateur.",
    endpointHint: "mcp://webhook.getgents.tools",
  },
  {
    id: "a2a-notaire",
    name: "Agent partenaire — Notaire (A2A)",
    kind: "a2a",
    icon: "⚖️",
    category: "ecriture",
    desc: "Délègue une tâche à un agent tiers spécialisé via le protocole Agent-to-Agent.",
    endpointHint: "a2a://notaire-partner.example",
  },
  {
    id: "compte-booking",
    name: "Booking.com",
    kind: "a2a",
    icon: "🏨",
    category: "compte_tiers",
    desc: "Compte personnel connecté par l'utilisateur final — jamais par le builder.",
    endpointHint: "a2a://booking.com/agent",
  },
];

const DEFAULT_ARTEFACT_TEMPLATES: ArtefactTemplateConfig[] = [
  {
    id: "tpl-report",
    label: "Rapport de synthèse",
    kind: "report",
    description: "Document texte structuré (titres, listes) généré à la demande.",
    enabled: true,
  },
  {
    id: "tpl-checklist",
    label: "Checklist",
    kind: "checklist",
    description: "Liste de tâches à cocher, utile pour un suivi de préparatifs.",
    enabled: true,
  },
  {
    id: "tpl-visual",
    label: "Aperçu visuel",
    kind: "visual",
    description: "Illustration stylisée générée par un modèle image (ex. Nanobanana).",
    enabled: false,
  },
  {
    id: "tpl-timeline",
    label: "Frise chronologique",
    kind: "timeline",
    description: "Étapes datées avec statut — adapté aux plannings et parcours.",
    enabled: false,
  },
  {
    id: "tpl-budget",
    label: "Suivi budgétaire",
    kind: "budget",
    description: "Enveloppe, répartition par poste et historique de dépenses.",
    enabled: false,
  },
  {
    id: "tpl-map",
    label: "Carte schématique",
    kind: "map",
    description: "Représentation schématique d'un parcours ou de lieux clés.",
    enabled: false,
  },
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
    connectors: CONNECTOR_CATALOG.filter((c) =>
      ["mcp-cartes", "mcp-fichiers", "webhook-ecriture", "compte-booking"].includes(c.id)
    ).map((c) => ({ ...c, connected: c.id !== "compte-booking" })),
    artefactTemplates: DEFAULT_ARTEFACT_TEMPLATES.map((t) =>
      ["tpl-report", "tpl-checklist", "tpl-visual", "tpl-timeline", "tpl-budget", "tpl-map"].includes(t.id)
        ? { ...t, enabled: true }
        : t
    ),
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
    connectors: CONNECTOR_CATALOG.filter((c) => c.id === "mcp-fichiers").map((c) => ({
      ...c,
      connected: true,
    })),
    artefactTemplates: DEFAULT_ARTEFACT_TEMPLATES.map((t) =>
      t.id === "tpl-report" || t.id === "tpl-checklist" ? { ...t, enabled: true } : t
    ),
    builderConversation: [
      {
        role: "agent",
        text: "<p>Espace sensible détecté — pensez à activer le badge « Données sensibles » et à limiter les connecteurs au strict nécessaire.</p>",
        t: "lun.",
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
    connectors: [],
    artefactTemplates: DEFAULT_ARTEFACT_TEMPLATES.map((t) => ({ ...t, enabled: false })),
    builderConversation: [
      {
        role: "agent",
        text: "<p>Bienvenue ! Décrivez en une phrase l'objectif premier de ce gent — je vous aiderai ensuite à construire le prompt système, choisir les modèles et les connecteurs adaptés.</p>",
        t: "à l'instant",
      },
    ],
  },
};

export { DEFAULT_ARTEFACT_TEMPLATES };
