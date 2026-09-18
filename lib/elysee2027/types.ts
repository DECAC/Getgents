/**
 * « Élysée 2027 » — jeu de rôle présidentiel SANS modèle de langage.
 *
 * Ce module est volontairement déterministe : aucune donnée de ce dossier ne
 * transite par OpenRouter ni par aucun LLM. L'état de la partie est reconstruit
 * à chaque tour en REJOUANT l'historique des messages — le serveur est sans
 * état, le fil de conversation fait office de sauvegarde.
 *
 * Sources des chiffres cités dans les situations (aucun chiffre inventé) :
 *  - Cour des comptes, Rapport public annuel 2026 « Cohésion territoriale et
 *    attractivité des territoires » — synthèses (mars 2026) ;
 *  - INSEE, Rapport annuel 2025 ;
 *  - Banque de France, Rapport annuel 2025.
 */

/** Les cinq jauges de la partie, toutes sur 0-100. */
export type JaugeId = "bonheur" | "confiance" | "pouvoirAchat" | "finances" | "cohesion";

export const JAUGES: { id: JaugeId; label: string }[] = [
  { id: "bonheur", label: "Bonheur" },
  { id: "confiance", label: "Confiance" },
  { id: "pouvoirAchat", label: "Pouvoir d'achat" },
  { id: "finances", label: "Finances" },
  { id: "cohesion", label: "Cohésion" },
];

/**
 * Effet d'une réponse sur les jauges, en points (−12 à +12 par jauge et par
 * tour — borne d'équilibrage du jeu). Les cinq clés sont TOUJOURS présentes :
 * chaque réponse affiche son influence complète, y compris quand elle est
 * nulle sur une jauge (0).
 */
export type Effets = Record<JaugeId, number>;

export interface OptionDecision {
  /** Libellé du bouton — court, c'est un choix cliquable. */
  label: string;
  /** Conséquence racontée au joueur (2 à 4 phrases, ton expert, non partisan). */
  consequence: string;
  effets: Effets;
  /** Identifiant d'une décision enchaînée si ce choix est fait (arbre). */
  suite?: string;

  /*
   * Mise en scène — FACULTATIVE, et elle doit le rester. Le jeu compte 50
   * décisions dont une poignée seulement est habillée : une décision nue doit
   * rester parfaitement jouable, sinon les 45 autres cassent la partie.
   */

  /**
   * La une du lendemain. Le quotidien cité est INVENTÉ : prêter un titre à un
   * journal réel serait lui faire dire ce qu'il n'a pas écrit.
   */
  une?: string;
  /**
   * La réaction d'un conseiller, désigné par sa FONCTION (« le secrétaire
   * général de l'Élysée ») et jamais par un nom : le jeu ne met pas de mots
   * dans la bouche de personnes réelles.
   */
  reaction?: string;
}

export interface Decision {
  id: string;
  theme: string;
  titre: string;
  /** Mise en contexte : 2 à 4 phrases avec au moins un chiffre sourcé. */
  situation: string;
  question: string;

  /* Mise en scène — FACULTATIVE (voir `OptionDecision`). */

  /** Où la scène se passe — « Salon vert, 7 h 40 ». */
  lieu?: string;
  /** Le délai qui pèse — « Conseil des ministres dans 20 minutes ». */
  urgence?: string;
  /**
   * Deux ou trois phrases de mise en situation, servies AVANT la situation
   * chiffrée. C'est du récit : elle ne porte AUCUN chiffre — ceux-ci restent
   * dans `situation`, où le test de source les surveille.
   */
  scenette?: string;
  /** Exactement 4 réponses — le choix « Autre » est exclu par le jeu. */
  options: [OptionDecision, OptionDecision, OptionDecision, OptionDecision];
}

export type Difficulte = "apaisee" | "realiste" | "tempete";

export const DIFFICULTES: Record<
  Difficulte,
  { label: string; jauges: Record<JaugeId, number> }
> = {
  apaisee: {
    label: "Apaisée",
    jauges: { bonheur: 55, confiance: 50, pouvoirAchat: 50, finances: 45, cohesion: 60 },
  },
  realiste: {
    label: "Réaliste",
    jauges: { bonheur: 45, confiance: 38, pouvoirAchat: 42, finances: 35, cohesion: 50 },
  },
  tempete: {
    label: "Tempête",
    jauges: { bonheur: 38, confiance: 30, pouvoirAchat: 36, finances: 25, cohesion: 42 },
  },
};

/** Seuils de fin de partie (règles du jeu, reprises de la V0). */
export const SEUILS = {
  revolution: { jauge: "bonheur" as JaugeId, max: 15 },
  guerreCivile: { jauge: "cohesion" as JaugeId, max: 10 },
  tutelle: { jauge: "finances" as JaugeId, max: 5 },
  victoire: { bonheur: 80, confiance: 70, toursConsecutifs: 2 },
  victoireFinDeMandat: { bonheur: 65 },
  alerteBasse: 25,
  alerteHaute: 75,
};

/** Borne d'équilibrage : jamais plus de ±12 points sur une jauge par tour. */
export const AMPLITUDE_MAX = 12;

/** Issues possibles d'une partie. */
export type FinJeu =
  | "revolution"
  | "guerre_civile"
  | "tutelle"
  | "victoire"
  | "victoire_mandat"
  | "bilan_mitige";

/** Un tour déjà joué, tel que le tableau de bord le rappelle. */
export interface TourJoue {
  tour: number;
  /** Titre de la décision tranchée. */
  titre: string;
  /** Libellé de l'option retenue. */
  choix: string;
  deltas: Effets;
}

/**
 * État de la partie DESTINÉ À L'AFFICHAGE, émis par le moteur à chaque tour
 * dans un bloc caché `<!--ETAT_JEU: …-->`.
 *
 * Il existe parce que le tableau de bord textuel (« Bonheur 45 → 41 (−4) »)
 * n'est pas exploitable par l'interface : pour dessiner des jauges, alerter
 * sur un seuil ou annoncer la fin, il faut des NOMBRES, pas une phrase à
 * relire. Le moteur étant déterministe, ces valeurs sont la vérité du jeu —
 * l'interface n'a rien à recalculer ni à deviner.
 */
export interface EtatJeuPublic {
  /** Identifiant du moteur (permet d'ignorer un bloc d'une autre version). */
  moteur: string;
  tour: number;
  duree: number;
  difficulte: Difficulte;
  titre: string;
  jauges: Effets;
  /** Variation du tour. Absente à l'ouverture et sur un recadrage. */
  deltas?: Effets;
  /** Tours consécutifs au-dessus des seuils de victoire. */
  serieVictoire: number;
  /** Présente seulement quand la partie est terminée. */
  fin?: FinJeu;
  finTitre?: string;
  /** Les trois derniers tours, du plus récent au plus ancien. */
  derniers: TourJoue[];
  /**
   * LE TOUR, en entier et structuré — la décision posée, ou la conséquence
   * qu'on encaisse. Jamais les deux : le tour se joue en deux temps.
   *
   * Le texte du fil reste lisible seul (un jeu doit survivre à une interface
   * qui ne le connaît pas), mais ce n'est pas lui qu'on affiche : l'interface
   * DESSINE la scène à partir d'ici. Sans cela, la mise en scène retombe dans
   * la typographie d'une bulle de conversation, et il ne reste qu'un texte.
   */
  decision?: DecisionAffichee;
  consequence?: ConsequenceAffichee;
}

/** La décision posée au joueur, telle que l'interface la dessine. */
export interface DecisionAffichee {
  theme: string;
  titre: string;
  /** Mise en scène — facultative, comme sur `Decision`. */
  lieu?: string;
  urgence?: string;
  scenette?: string;
  situation: string;
  question: string;
  /** Les quatre libellés cliquables, dans l'ordre. */
  options: string[];
}

/** Ce qu'a produit le choix, et la seule action qui reste : demander la suite. */
export interface ConsequenceAffichee {
  /** Le libellé retenu, rappelé au joueur. */
  choisi: string;
  texte: string;
  une?: string;
  reaction?: string;
  /**
   * La question du bloc de reprise et son unique libellé. L'interface compose
   * sa réponse EXACTEMENT comme les réponses rapides le font (« question →
   * libellé ») : deux formats concurrents finiraient par diverger, et le
   * moteur cesserait d'apparier.
   */
  question: string;
  action: string;
}
