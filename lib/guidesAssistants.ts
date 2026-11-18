/**
 * Guides « Connecter un assistant IA » de la rubrique Pages (18/11).
 *
 * Deux chemins pour faire d'un artefact une page Getgents :
 *   - COPIER-COLLER le code dans « + Nouvelle page » : marche avec tout
 *     assistant, offres gratuites comprises (essayé avec Claude et un canvas
 *     ChatGPT) ;
 *   - le CONNECTEUR (MCP) : « partage cette page à marie@… » depuis la
 *     conversation. Essayé avec Claude SEULEMENT. Pour les autres, le guide le
 *     DIT (`connecteurEssaye: false`) plutôt que de promettre un geste qui ne
 *     marche peut-être pas — et ne nomme pas de menus qu'on n'a pas vus.
 *
 * Module PUR.
 */

export type Assistant = "claude" | "chatgpt" | "mistral" | "perplexity";

export const ASSISTANTS: readonly Assistant[] = ["claude", "chatgpt", "mistral", "perplexity"];

export interface GuideAssistant {
  nom: string;
  /** Le connecteur a-t-il été essayé de bout en bout par Getgents ? */
  connecteurEssaye: boolean;
  /** Étapes du copier-coller, propres à l'assistant. */
  coller: string[];
  /** Ce qu'il faut savoir avant d'ajouter le connecteur (offre, mode). */
  connecteurCondition: string;
  /** Étapes du connecteur ; l'adresse du serveur est affichée à part. */
  connecteur: string[];
}

const DEMANDE =
  "Demandez une page AUTONOME : « en HTML, dans un seul fichier, avec toutes les données écrites dans la page, sans rien abréger ».";

export const GUIDES: Readonly<Record<Assistant, GuideAssistant>> = {
  claude: {
    nom: "Claude",
    connecteurEssaye: true,
    coller: [DEMANDE, "Sur l'artefact, cliquez « Copier ».", "Ici, « + Nouvelle page » : collez, vérifiez l'aperçu, créez la page."],
    connecteurCondition: "Disponible dans Claude (web et application), connecteurs personnalisés.",
    connecteur: [
      "Paramètres → Connecteurs → Ajouter un connecteur personnalisé, avec l'adresse ci-dessous.",
      "Claude ouvre une page Getgents : connectez-vous et cliquez « Autoriser ».",
      "Demandez « partage cette page à marie@… » : Claude rend le lien privé et le mail à envoyer.",
    ],
  },
  chatgpt: {
    nom: "ChatGPT",
    connecteurEssaye: false,
    coller: [
      DEMANDE.replace("Demandez une page", "Demandez, dans un canvas, une page"),
      "Dans le canvas, copiez le code (bouton « Copier » du canvas ou du bloc de code).",
      "Ici, « + Nouvelle page » : collez, vérifiez l'aperçu, créez la page.",
    ],
    connecteurCondition: "Exige un abonnement ChatGPT payant et le mode développeur ; sur un compte d'entreprise, l'administrateur doit l'autoriser.",
    connecteur: [
      "Paramètres → Applications et connecteurs → Paramètres avancés : activez le mode développeur.",
      "Créez un connecteur avec l'adresse ci-dessous, authentification OAuth.",
      "Connectez-vous à Getgents et cliquez « Autoriser », puis activez le connecteur dans la conversation et demandez le partage.",
    ],
  },
  mistral: {
    nom: "Mistral (Le Chat)",
    connecteurEssaye: false,
    coller: [
      DEMANDE.replace("Demandez une page", "Demandez, dans un canvas, une page"),
      "Copiez le code du canvas (ou du bloc de code).",
      "Ici, « + Nouvelle page » : collez, vérifiez l'aperçu, créez la page.",
    ],
    connecteurCondition: "Selon votre offre, Le Chat permet d'ajouter un connecteur MCP personnalisé.",
    connecteur: [
      "Dans les connecteurs de Le Chat, ajoutez un connecteur personnalisé avec l'adresse ci-dessous.",
      "Connectez-vous à Getgents et cliquez « Autoriser ».",
      "Demandez « partage cette page à marie@… ».",
    ],
  },
  perplexity: {
    nom: "Perplexity",
    connecteurEssaye: false,
    coller: [
      DEMANDE.replace("Demandez une page", "Demandez, dans un bloc de code, une page"),
      "Cliquez « Copier » sur le bloc de code.",
      "Ici, « + Nouvelle page » : collez, vérifiez l'aperçu, créez la page.",
    ],
    connecteurCondition: "Selon votre offre et votre application, Perplexity permet d'ajouter un connecteur MCP personnalisé.",
    connecteur: [
      "Dans les connecteurs de Perplexity, ajoutez un connecteur personnalisé avec l'adresse ci-dessous.",
      "Connectez-vous à Getgents et cliquez « Autoriser ».",
      "Demandez « partage cette page à marie@… ».",
    ],
  },
};

/** L'assistant d'un paramètre `?guide=` ; « 1 » (ancien lien) et toute valeur inconnue valent Claude. */
export function assistantDuGuide(valeur: string | null | undefined): Assistant {
  return (ASSISTANTS as readonly string[]).includes(valeur ?? "") ? (valeur as Assistant) : "claude";
}
