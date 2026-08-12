/**
 * Emblèmes des gents : l'emoji affiché dans le bandeau de configuration, la
 * liste « Mes gents » et le rail du Gent' space.
 *
 * Tout gent naissait avec ✨, l'emoji du gabarit vierge : une liste de gents
 * était donc une colonne d'étoiles identiques, illisible d'un coup d'œil. On
 * déduit désormais un emblème de la description du rôle (et les exemples de
 * l'accueil du studio imposent le leur), tout en le laissant modifiable.
 */

/** Emblème du gabarit vierge — utilisé quand rien ne se dégage de la description. */
export const DEFAULT_GENT_ICON = "✨";

interface IconRule {
  icon: string;
  /** Termes déclencheurs, écrits sans accent (la comparaison les ignore). */
  keywords: string[];
}

// Ordre = priorité : la première règle qui matche gagne. Les intentions
// précises (rédiger un compte rendu) passent donc avant les thèmes larges
// (documents), sinon un gent de synthèse hériterait de l'emblème des bases
// documentaires.
const ICON_RULES: IconRule[] = [
  { icon: "📧", keywords: ["email", "e-mail", "mail", "gmail", "courriel", "boite de reception"] },
  { icon: "🎬", keywords: ["video", "film", "sequence", "tournage", "rushes"] },
  { icon: "🗞️", keywords: ["veille", "actualite", "actu", "presse", "news", "newsletter"] },
  { icon: "🚇", keywords: ["transport", "metro", "bus", "tram", "train", "trajet", "itineraire"] },
  { icon: "💳", keywords: ["budget", "depense", "banque", "bancaire", "facture", "paiement", "comptabilite", "finance"] },
  { icon: "📝", keywords: ["compte rendu", "comptes rendus", "synthese", "resume", "rediger", "redaction", "prise de note"] },
  { icon: "📊", keywords: ["tableau de bord", "dashboard", "statistique", "indicateur", "graphique", "jeu de donnees", "open data"] },
  { icon: "📖", keywords: ["visionneuse", "lecture", "lire un document", "livre", "manuel"] },
  { icon: "📚", keywords: ["procedure", "contrat", "documentation", "base documentaire", "connaissance", "archive"] },
  { icon: "🗓️", keywords: ["agenda", "calendrier", "rendez-vous", "reunion", "planning", "echeance", "relance"] },
  { icon: "🛒", keywords: ["commande", "stock", "catalogue", "produit", "vente", "devis", "client potentiel"] },
  { icon: "⚖️", keywords: ["juridique", "droit", "avocat", "notaire", "succession", "conformite", "rgpd"] },
  { icon: "🏠", keywords: ["immobilier", "logement", "location", "bail", "chantier"] },
  { icon: "✈️", keywords: ["voyage", "vol", "hotel", "sejour", "road trip", "vacances"] },
  { icon: "🎓", keywords: ["formation", "cours", "eleve", "etudiant", "apprentissage", "quiz", "examen"] },
  { icon: "🩺", keywords: ["sante", "patient", "medical", "medecin", "soin"] },
  { icon: "🧑‍💻", keywords: ["code", "developpeur", "bug", "support technique", "informatique"] },
  { icon: "🖼️", keywords: ["image", "photo", "illustration", "visuel", "affiche"] },
  { icon: "💬", keywords: ["whatsapp", "messagerie", "conversation", "sms"] },
  { icon: "🎯", keywords: ["accueil", "onboarding", "guider", "accompagner", "orienter"] },
  { icon: "🔌", keywords: ["api", "mcp", "connecteur", "integration", "webhook", "donnees metier"] },
];

/**
 * Palette proposée au créateur. Contient tous les emblèmes déductibles — un
 * emblème suggéré doit rester rattrapable dans le sélecteur.
 */
export const GENT_ICON_PALETTE: string[] = [
  DEFAULT_GENT_ICON,
  ...ICON_RULES.map((r) => r.icon),
  "🤖",
  "🧭",
  "🔍",
  "🌍",
  "🌱",
  "🍽️",
];

/**
 * Compare sans tenir compte des accents, de la casse ni de la ponctuation :
 * « compte-rendu » et « compte rendu » doivent déclencher la même règle.
 */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Déduit un emblème de la description du rôle. Renvoie l'emblème par défaut
 * quand rien ne se dégage — mieux vaut ✨ qu'un emoji hors sujet.
 */
export function suggestGentIcon(description: string): string {
  const haystack = fold(description);
  if (!haystack.trim()) return DEFAULT_GENT_ICON;
  for (const rule of ICON_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(fold(keyword)))) return rule.icon;
  }
  return DEFAULT_GENT_ICON;
}
