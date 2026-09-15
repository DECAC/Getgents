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

/** Modèle OpenRouter utilisé par l'assistant du builder (panneau de droite). */
export const BUILDER_ASSISTANT_MODEL_ID = "moonshotai/kimi-k3";

/**
 * Modèle des tours légers de l'assistant du builder : poser une question de
 * cadrage, classer une intention. La tâche est courte et le format contraint
 * (une phrase + un bloc JSON), donc un modèle rapide et bon marché suffit — et
 * c'est ce qui garde l'atelier réactif. La GÉNÉRATION (prompt système, aperçu,
 * découverte de connecteurs) reste sur BUILDER_ASSISTANT_MODEL_ID.
 *
 * Même motif que SUPER_GENT_ROUTER_MODEL et DEFAULT_VISION_MODEL_ID.
 */
export const BUILDER_FAST_MODEL_ID = "google/gemini-2.5-flash";

export const MODEL_CATALOG: OpenRouterModel[] = [
  {
    id: "moonshotai/kimi-k3",
    label: "Kimi K3",
    provider: "Moonshot AI",
    capability: "chat",
    contextWindow: 1_048_576,
    pricing: { input: 3, output: 15 },
    tagline: "Modèle prioritaire pour l'assistant builder — code, outils, long contexte.",
  },
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
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "Google",
    capability: "chat",
    contextWindow: 1_048_576,
    pricing: { input: 1.25, output: 10 },
    tagline: "Le plus capable de la famille Gemini — raisonnement plus fin que Flash, plus cher.",
  },
  {
    // Route chaque requête vers le modèle le plus adapté selon OpenRouter.
    // Tarif RÉELLEMENT variable — facturé au prix du modèle choisi, pas un
    // prix fixe. Les deux montants ci-dessous sont un plancher indicatif, pas
    // le prix payé : OpenRouter peut river la requête vers un modèle
    // nettement plus cher sans avertissement préalable au créateur.
    id: "openrouter/auto",
    label: "Auto Router (OpenRouter)",
    provider: "OpenRouter",
    capability: "chat",
    contextWindow: 2_000_000,
    pricing: { input: 0, output: 0 },
    tagline: "Choisit automatiquement le modèle le plus adapté par requête — tarif variable, dépend du modèle réellement choisi.",
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
    // Surnom « Nanobanana » = Gemini 2.5 Flash Image sur OpenRouter.
    id: "google/gemini-2.5-flash-image",
    label: "Nanobanana",
    provider: "Google",
    capability: "image",
    pricing: { input: 0.3, output: 2.5 },
    tagline: "Génération d'images stylisées à bas coût — modèle recommandé par défaut.",
  },
  {
    id: "google/gemini-3.1-flash-image",
    label: "Nanobanana 2",
    provider: "Google",
    capability: "image",
    pricing: { input: 0.5, output: 3 },
    tagline: "Nano Banana 2 — meilleure qualité, un peu plus cher.",
  },
  {
    id: "black-forest-labs/flux-1.1-pro",
    label: "FLUX 1.1 Pro",
    provider: "Black Forest Labs",
    capability: "image",
    pricing: { input: 0, output: 40 },
    tagline: "Illustrations haute fidélité (plus coûteux que Nanobanana).",
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
    kind: "gmail",
    name: "Gmail — boîte mail",
    icon: "📧",
    description:
      "Lecture et envoi d'e-mails via le compte Google du créateur. Connexion OAuth par gent (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET côté serveur) ; les jetons sont stockés de façon sécurisée en base.",
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
    label: "Rapport",
    kind: "report",
    description: "Synthèse, modèle de document ou procédure en texte structuré.",
  },
  {
    id: "tpl-checklist",
    label: "Checklist",
    kind: "checklist",
    description: "Étapes, pièces ou tâches à cocher au fil de l'échange.",
  },
  {
    id: "tpl-chart",
    label: "Graphique",
    kind: "chart",
    description: "Comparaison chiffrée (montants, pourcentages, catégories).",
  },
  {
    id: "tpl-dashboard",
    label: "Tableau de bord",
    kind: "dashboard",
    description: "Indicateurs clés et scores à lire d'un coup d'œil.",
  },
  {
    id: "tpl-map",
    label: "Carte",
    kind: "map",
    description: "Lieux, itinéraire ou adresses sur fond cartographique.",
  },
  {
    id: "tpl-profile",
    label: "Résumé de profil",
    kind: "profile-summary",
    description: "Parcours d'une personne (expérience, compétences, médias).",
  },
  {
    id: "tpl-visual",
    label: "Aperçu visuel",
    kind: "visual",
    description: "Schéma ou visuel généré pour clarifier une idée.",
  },
  {
    id: "tpl-image",
    label: "Image",
    kind: "image",
    description: "Illustration ou photo proposée puis ajoutée à l'espace.",
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
      { capability: "image", modelId: "google/gemini-2.5-flash-image" },
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

  // Gent de référence : veille emploi via l'API Adzuna (connecteur API REST
  // correctement configuré — app_id/app_key en identifiants fixes, jamais
  // devinés) + formulaire jump pour lancer une recherche en un clic. Sert
  // d'exemple concret d'un gent branché sur une API tierce authentifiée.
  "radar-emploi": {
    id: "radar-emploi",
    name: "Radar Emploi",
    icon: "🧭",
    objective:
      "Veiller le marché de l'emploi selon des critères précis (poste, lieu, salaire, type de contrat) via l'API Adzuna.",
    systemPrompt: `Tu es un assistant de veille du marché de l'emploi. Ton rôle est d'aider l'utilisateur à surveiller les offres d'emploi correspondant à des critères précis : intitulé de poste, localisation, salaire minimum, type de contrat, secteur.

Comportement :
1. Si les critères ne sont pas clairs ou complets, demande-les explicitement avant toute recherche (intitulé, lieu, salaire mini si pertinent, type de contrat).
2. Utilise le connecteur Adzuna pour interroger la base d'offres avec les critères fournis. Renseigne chaque paramètre avec une valeur normalisée (une ville précise pour "where" — jamais une phrase ; "permanent" pour un CDI, "contract" pour un CDD ; salaire en euros annuels bruts). Une seule localisation par appel : pour plusieurs villes, fais plusieurs recherches.
3. Présente les résultats de façon structurée et lisible : titre du poste, entreprise, lieu, fourchette de salaire, type de contrat, date de publication, et lien vers l'offre (redirect_url).
4. Écarte les doublons et les offres clairement hors critères.
5. Si aucune offre ne correspond, indique-le clairement et propose d'élargir un critère (zone, salaire, intitulé).
6. Ne jamais inventer d'offres, d'entreprises ou de montants : appuie-toi uniquement sur les données renvoyées par l'API. Tu peux compléter par la recherche web pour contextualiser (tendances, actualité d'une entreprise), en citant la source.
7. Reste concis, professionnel et orienté action (propose des relances ou affinages).`,
    status: "draft",
    updatedAt: "il y a 2 jours",
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
        id: "tool-adzuna",
        toolKind: "api-rest",
        name: "Adzuna - Recherche d'offres d'emploi",
        detail: "GET https://api.adzuna.com/v1/api/jobs/fr/search/1",
        restConfig: {
          method: "GET",
          baseUrl: "https://api.adzuna.com/v1/api/jobs/fr/search/1",
          description:
            "Recherche des offres d'emploi en France via Adzuna selon mots-clés, lieu, salaire et type de contrat. À appeler dès que l'utilisateur a fourni ses critères de recherche.",
          // app_id et app_key sont des identifiants FIXES (Adzuna en exige deux),
          // lus depuis des variables d'environnement serveur — jamais devinés.
          queryParams: [{ name: "app_id", value: "env:ADZUNA_APP_ID" }],
          headers: [],
          auth: { mode: "api-key", placement: "query", fieldName: "app_key", value: "env:ADZUNA_APP_KEY" },
          modelParams: [
            { name: "what", description: "Mots-clés du poste recherché", required: true, example: "presales" },
            {
              name: "where",
              description: "Ville ou région précise en France (une seule localisation par appel)",
              required: false,
              example: "Paris",
            },
            {
              name: "salary_min",
              description: "Salaire annuel brut minimum en euros",
              required: false,
              example: "100000",
            },
            {
              name: "contract_type",
              description: "Type de contrat : permanent (CDI), contract (CDD)",
              required: false,
              example: "permanent",
            },
            {
              name: "category",
              description: "Catégorie/secteur Adzuna (ex. it-jobs, sales-jobs)",
              required: false,
              example: "sales-jobs",
            },
            {
              name: "results_per_page",
              description: "Nombre de résultats à retourner",
              required: false,
              example: "20",
            },
            {
              name: "sort_by",
              description: "Critère de tri : date, salary, relevance",
              required: false,
              example: "date",
            },
          ],
          responseHint:
            "Utilise le tableau results ; chaque offre contient title, company.display_name, location.display_name, salary_min/salary_max, contract_type, created, redirect_url.",
        },
      },
    ],
    webSearch: true,
    jumpForm: {
      id: "jump-radar-emploi",
      title: "Nouvelle recherche d'emploi",
      description: "Renseignez vos critères pour lancer une recherche d'offres.",
      submitLabel: "Rechercher",
      fields: [
        { id: "poste", label: "Intitulé de poste", kind: "text", placeholder: "ex. presales consultant", required: true },
        { id: "lieu", label: "Localisation", kind: "text", placeholder: "ex. Paris", required: false },
        {
          id: "salaire_min",
          label: "Salaire minimum souhaité (€/an)",
          kind: "text",
          placeholder: "ex. 100000",
          required: false,
        },
        {
          id: "contrat",
          label: "Type de contrat",
          kind: "select",
          required: false,
          options: ["CDI", "CDD", "Freelance", "Tous"],
        },
      ],
    },
    builderConversation: [
      {
        role: "agent",
        text: "<p>Ce gent interroge l'API Adzuna pour surveiller les offres d'emploi selon vos critères. Le connecteur est configuré : il ne reste qu'à fournir vos identifiants Adzuna (variables <code>ADZUNA_APP_ID</code> et <code>ADZUNA_APP_KEY</code>) puis à publier.</p>",
        t: "il y a 2 jours",
      },
    ],
  },

  // Gent de référence « jeu de rôle » — V0 « prompt seul » : tout repose sur
  // les briques existantes (réponses à choix restreint via le bloc QUESTIONS,
  // formulaire de départ, recherche web, base de connaissance). L'état de la
  // partie (jauges, tour) est tenu dans le TEXTE VISIBLE de chaque tour, car
  // l'historique renvoyé au modèle est débarrassé de toute balise : un bloc
  // caché ne serait pas relu au tour suivant. La V1 (signal STATE validé par
  // le code, saisie verrouillée, panneau de jauges, fin imposée) est décrite
  // dans le plan « gent-president-jeu-de-role ».
  "elysee-2027": {
    id: "elysee-2027",
    name: "Élysée 2027 — Dans la peau du président",
    icon: "🏛️",
    objective:
      "Jeu de rôle : incarner le prochain président de la République et prendre des décisions rapides dont chaque conséquence, chiffrée et sourcée, fait bouger le bonheur et la confiance des Français.",
    systemPrompt: `Tu es le maître du jeu d'« Élysée 2027 », un jeu de rôle de gestion politique. L'utilisateur vient d'être élu président de la République française. Tu le vouvoies et l'appelles « Monsieur le Président » ou « Madame la Présidente » selon ce qu'il indique (sinon « Président(e) »). C'est une FICTION : le joueur incarne « le » président élu, jamais une personnalité réelle ; tu ne nommes, ne cites ni ne favorises aucun candidat, parti ou personnalité politique réels, et tu ne donnes jamais de consigne de vote. Ton objectif de conception : faire comprendre, par le jeu, les arbitrages réels d'un mandat et leurs conséquences mesurables.

OBJECTIF DU JOUEUR
Rendre les Français plus heureux et leur redonner confiance en l'avenir, en tenant le pays.

ÉTAT DE LA PARTIE (5 jauges de 0 à 100)
- Bonheur (jauge principale), Confiance en l'avenir, Pouvoir d'achat, Finances publiques, Cohésion nationale (ordre public et paix sociale).
- Valeurs de départ selon la difficulté choisie au formulaire : Apaisée → 55 / 50 / 50 / 45 / 60 ; Réaliste → 45 / 38 / 42 / 35 / 50 ; Tempête → 38 / 30 / 36 / 25 / 42 (dans l'ordre Bonheur / Confiance / Pouvoir d'achat / Finances / Cohésion).
- Durée : « Partie courte » = 8 tours, « Mandat complet » = 15 tours. Un tour = une décision.
- Tu tiens l'état toi-même, avec rigueur : à CHAQUE tour tu affiches le tableau de bord (voir format), et tu repars EXACTEMENT des valeurs affichées au tour précédent. Ne recalcule jamais depuis le début, ne « corrige » jamais silencieusement une valeur.

PHYSIQUE DES CONSÉQUENCES (règles non négociables)
- Chaque décision fait varier une ou plusieurs jauges, de −12 à +12 points maximum par jauge et par tour. Jamais au-delà, même pour une décision spectaculaire.
- Couplages : une dépense nouvelle non financée baisse Finances publiques ; une hausse d'impôts ou une coupe baisse Bonheur et Pouvoir d'achat à court terme et peut relever Finances ; une mesure perçue comme injuste baisse Cohésion ; une réforme structurelle a des effets différés (annonce-le : « effet plein dans 2 tours »). Il n'existe pas de décision sans contrepartie : si un choix ne coûte rien, il rapporte peu.
- Chaque variation est justifiée par un mécanisme concret (qui gagne, qui perd, réaction sociale, réaction des marchés ou de Bruxelles quand c'est pertinent) et, chaque fois que possible, par un chiffre sourcé.

FIN DE PARTIE (tu la déclares dès qu'une condition est remplie, à l'affichage du tableau de bord)
- Défaite — Révolution : Bonheur ≤ 15. Guerre civile : Cohésion ≤ 10. Mise sous tutelle : Finances publiques ≤ 5.
- Victoire — Bonheur ≥ 80 ET Confiance ≥ 70 pendant deux tours consécutifs ; ou fin du mandat avec Bonheur ≥ 65.
- Fin de mandat sans victoire ni défaite : bilan mitigé.
- Une fin de partie se conclut par un BILAN : ce qui a marché, ce qui a coûté, les 3 décisions décisives, puis une seule question fermée : rejouer (Apaisée / Réaliste / Tempête) ou arrêter. C'est le seul moment où tu peux proposer un artefact « tableau de bord » (bilan du mandat) — jamais en cours de partie.

CHIFFRES ET ACTUALITÉ
- Ancre chaque situation dans l'actualité récente (recherche web) et dans les données publiques françaises. Sources à privilégier : INSEE, Cour des comptes, DREES, Banque de France, France Stratégie, Eurostat, OFCE, Haut Conseil des finances publiques.
- Si une fiche « chiffres clés » figure dans ta base de connaissance, c'est ta source primaire : utilise ses valeurs telles quelles, avec leur date.
- Tout chiffre est accompagné de sa source et de sa date, entre parenthèses (ex. « (INSEE, T2 2026) »). Si tu ne peux pas vérifier un chiffre, écris « ordre de grandeur, non vérifié » — n'invente JAMAIS un chiffre, un rapport ou une citation. Ne fabrique pas d'événements attribués à des personnes réelles.

DÉROULÉ D'UN TOUR (format strict, en français)
1. Situation — 2 à 4 phrases, concrètes, ancrées dans l'actualité, avec au moins un chiffre sourcé. Varie les thématiques : économie, pouvoir d'achat, retraites et social, santé, éducation, sécurité, énergie et climat, logement, agriculture, industrie, numérique, international et défense, institutions. Jamais deux fois la même thématique de suite ; au moins 8 thématiques différentes sur une partie complète.
2. Question — une seule question fermée, avec 2 à 4 options selon la situation (2 pour un dilemme franc, 3 ou 4 pour un arbitrage). Les options sont des décisions concrètes et distinctes, formulées en moins de 12 mots, sans option évidemment bonne ou absurde. Tu émets la question via le bloc QUESTIONS demandé par la plateforme, sans lister les options en puces dans le texte. L'interface ajoute d'elle-même un choix « Autre » à saisie libre : n'en émets pas, et si le joueur l'utilise, traite sa proposition comme une décision à part entière (mêmes règles de conséquences) ou, si elle est hors sujet, reformule en une phrase et repose la question.
3. Quand le joueur a répondu — d'abord la Conséquence immédiate (3 à 6 phrases : effets concrets, réactions, chiffre sourcé si possible, effets différés annoncés), puis le tableau de bord, puis la situation suivante et sa question — le tout dans la même réponse.

TABLEAU DE BORD (obligatoire à chaque tour, exactement ce format, après la conséquence)
Tour X/N · Bonheur 45 → 41 (−4) · Confiance 38 → 40 (+2) · Pouvoir d'achat 42 → 42 (=) · Finances 35 → 31 (−4) · Cohésion 50 → 47 (−3)
Au premier tour, affiche les valeurs de départ sans variation (« Tour 1/15 · Bonheur 45 · Confiance 38 · … »). Quand une jauge franchit un seuil d'alerte (≤ 25 ou ≥ 75), ajoute une ligne « ⚠ Alerte : … » ou « ✦ Signal positif : … ».

STYLE
- Sobre, vivant, jamais moralisateur ni partisan : tu exposes des arbitrages, pas des opinions. Les fins « révolution » et « guerre civile » sont racontées comme des issues politiques abstraites, sans violence décrite ni glorification.
- Réponse de 120 à 200 mots hors tableau de bord. Pas de balises HTML dans le texte visible (le bloc QUESTIONS demandé par la plateforme n'est pas concerné : il est obligatoire).
- Premier message d'une partie : accueil en deux phrases (le contexte du mandat), tableau de bord de départ, première situation, première question. Si le joueur écrit librement au lieu de choisir, réponds en une phrase puis repose la question avec ses options.`,
    status: "draft",
    updatedAt: "aujourd'hui",
    modelAssignments: [
      { capability: "chat", modelId: "anthropic/claude-sonnet-5" },
      { capability: "reasoning", modelId: null },
      { capability: "image", modelId: null },
      { capability: "tts", modelId: null },
      { capability: "stt", modelId: null },
    ],
    knowledgeSources: [],
    connectors: [],
    webSearch: true,
    jumpForm: {
      id: "jump-elysee-2027",
      title: "Nouvelle partie",
      description: "Vous venez d'être élu(e). Choisissez le contexte de votre mandat.",
      submitLabel: "Entrer à l'Élysée",
      fields: [
        {
          id: "difficulte",
          label: "Difficulté",
          kind: "select",
          required: true,
          options: ["Apaisée", "Réaliste", "Tempête"],
        },
        {
          id: "priorite",
          label: "Priorité affichée de votre mandat",
          kind: "select",
          required: true,
          options: [
            "Pouvoir d'achat",
            "Services publics (santé, école)",
            "Transition écologique",
            "Sécurité et cohésion",
            "Réindustrialisation et emploi",
            "Redressement des finances publiques",
          ],
        },
        {
          id: "duree",
          label: "Format",
          kind: "select",
          required: true,
          options: ["Partie courte (8 tours)", "Mandat complet (15 tours)"],
        },
        {
          id: "titre",
          label: "Comment souhaitez-vous être appelé(e) ?",
          kind: "select",
          required: false,
          options: ["Monsieur le Président", "Madame la Présidente"],
        },
      ],
      promptTemplate:
        "Démarre une nouvelle partie. Difficulté : {{difficulte}}. Priorité affichée de mon mandat : {{priorite}}. Format : {{duree}}. Appelle-moi {{titre}}.",
    },
    builderConversation: [
      {
        role: "agent",
        text: "<p>Gent de référence « jeu de rôle » : le joueur incarne le président et répond à des questions à choix restreint ; chaque décision fait bouger cinq jauges, affichées à chaque tour, jusqu'à la victoire ou la défaite.</p><p>Avant de publier : (1) ajoutez votre fiche « chiffres clés » (INSEE, Cour des comptes…) dans <b>Connaissances</b> ci-dessous — son contenu est lu par le gent et devient sa source primaire ; (2) gardez la recherche web activée pour l'actualité ; (3) testez une partie courte en Preview. Les réponses libres restent possibles dans cette V0 : le gent repose alors la question avec ses options.</p>",
        t: "aujourd'hui",
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
      // Nanobanana : modèle image bon marché, activé par défaut pour illustrer
      // les propos (la génération reste soumise à l'autorisation utilisateur).
      { capability: "image", modelId: "google/gemini-2.5-flash-image" },
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
