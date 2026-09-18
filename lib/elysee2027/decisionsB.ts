import type { Decision } from "./types";

/**
 * Décisions 26 à 50 — emploi (suite), sécurité, cohésion des territoires,
 * finances publiques et économie, société, environnement, institutions.
 * Chaque situation cite sa source ; aucun chiffre inventé.
 */
export const DECISIONS_B: Decision[] = [
  {
    id: "emploi-independants",
    theme: "Emploi",
    titre: "Les indépendants",
    situation:
      "La France compte 4,4 millions de travailleurs indépendants, un statut dynamique depuis 2008 avec l'essor des micro-entrepreneurs, mais aux conditions d'emploi et de revenus très variables (INSEE, Rapport annuel 2025).",
    question: "Quelle protection pour les indépendants ?",
    options: [
      {
        label: "Renforcer leur protection sociale : retraite, chômage",
        consequence:
          "Vous alignez progressivement leurs droits sur ceux des salariés. Sécurité nouvelle pour des millions de personnes ; cotisations ou déficit en regard.",
        effets: { bonheur: 3, confiance: 2, pouvoirAchat: 1, finances: -4, cohesion: 1 },
      },
      {
        label: "Alléger les cotisations des micro-entrepreneurs",
        consequence:
          "Vous augmentez leur revenu disponible immédiat. Leur protection sociale, calculée sur ces cotisations, s'en trouvera d'autant réduite.",
        effets: { bonheur: 3, confiance: 1, pouvoirAchat: 2, finances: -4, cohesion: 0 },
      },
      {
        label: "Ne rien changer : le statut fonctionne",
        consequence:
          "Vous conservez l'équilibre actuel. Les indépendants satisfaits le restent ; les plus précaires — livreurs, auto-entrepreneurs — le restent aussi.",
        effets: { bonheur: 0, confiance: -1, pouvoirAchat: 0, finances: 1, cohesion: 0 },
      },
      {
        label: "Resserrer les critères contre le salariat déguisé",
        consequence:
          "Vous renforcez le contrôle des plateformes et des donneurs d'ordre. Les abus reculent ; une partie de la flexibilité du marché aussi.",
        effets: { bonheur: -2, confiance: 0, pouvoirAchat: -1, finances: 2, cohesion: -1 },
      },
    ],
  },
  {
    id: "emploi-rsa",
    theme: "Emploi",
    titre: "Le RSA et France Travail",
    situation:
      "La loi pour le plein emploi a acté l'inscription automatique à France Travail de tous les bénéficiaires du RSA, dont la situation sur le marché du travail a été documentée juste avant la réforme (INSEE, Rapport annuel 2025).",
    question: "Quelle mise en œuvre pour cette réforme ?",
    options: [
      {
        label: "Accompagnement intensif, sans sanction",
        consequence:
          "Vous misez tout sur l'accompagnement humain renforcé. Les sorties vers l'emploi progressent là où le suivi est réel ; le coût en conseillers est élevé.",
        effets: { bonheur: 3, confiance: 2, pouvoirAchat: 1, finances: -4, cohesion: 2 },
      },
      {
        label: "Contrat d'engagement avec sanctions",
        consequence:
          "Vous conditionnez le versement à des obligations effectives. Les comptes s'améliorent et une partie reprend un emploi ; les plus éloignés décrochent et basculent dans la grande pauvreté.",
        effets: { bonheur: -2, confiance: 0, pouvoirAchat: -1, finances: 3, cohesion: -2 },
      },
      {
        label: "Expérimenter par territoires, puis évaluer",
        consequence:
          "Vous testez plusieurs modalités sur des départements volontaires avant de généraliser. Décision prudente et fondée sur la preuve ; les effets se feront attendre.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 0, finances: -1, cohesion: 1 },
      },
      {
        label: "Fusionner les minima sociaux en un revenu universel d'activité",
        consequence:
          "Vous simplifiez radicalement : une prestation unique, lisible, sans non-recours. Chantier immense et coûteux au départ, mais le non-recours recule enfin.",
        effets: { bonheur: 3, confiance: 1, pouvoirAchat: 2, finances: -6, cohesion: 2 },
      },
    ],
  },
  {
    id: "securite-repartition",
    theme: "Sécurité",
    titre: "La carte des forces de sécurité",
    situation:
      "La France compte 252 300 policiers et gendarmes pour 24,4 Md€ de moyens de l'État (+33 % depuis 2016), mais leur répartition par département est décorrélée de la délinquance constatée, et le ratio par habitant a décru dans les zones en croissance (Cour des comptes, RPA 2026).",
    question: "Comment répartir les forces de sécurité ?",
    lieu: "Bureau du président, 6 h 50",
    urgence: "Point de sécurité quotidien dans 10 minutes",
    scenette:
      "La carte est punaisée au mur depuis la veille : les effectifs d'un côté, la délinquance de l'autre, et les deux qui ne se superposent pas. Le préfet coordonnateur attend debout. Il sait que déplacer un policier, c'est le retirer à quelqu'un.",
    options: [
      {
        label: "Rééquilibrer les effectifs selon les besoins d'ici 2030",
        consequence:
          "Vous reprenez la recommandation de la Cour : les effectifs suivent la délinquance et la démographie. Les zones sur-dotées perdent des postes — et le disent ; les zones tendues respirent.",
        une:
          "Le président redessine la carte de la sécurité — Le Courrier de la République",
        reaction:
          "Le préfet coordonnateur décroche la carte. « C'est ce qu'il fallait faire. Les départements qui perdent des postes ne compteront pas ceux que d'autres gagnent : ils compteront les leurs. »",
        effets: { bonheur: 2, confiance: 2, pouvoirAchat: 0, finances: -1, cohesion: 2 },
        suite: "securite-municipales",
      },
      {
        label: "Recruter 10 000 policiers et gendarmes supplémentaires",
        consequence:
          "Vous augmentez les effectifs partout sans rien retirer à personne. Consensus immédiat ; la masse salariale s'alourdit durablement.",
        une:
          "Dix mille policiers et gendarmes de plus — L'Écho du matin",
        reaction:
          "Le préfet coordonnateur ne discute pas. « Personne ne protestera, c'est vrai. Mais on recrute pour trente ans, et la carte restera fausse pendant tout ce temps. »",
        effets: { bonheur: 3, confiance: 2, pouvoirAchat: 0, finances: -5, cohesion: 2 },
      },
      {
        label: "Réviser les zones de compétence police-gendarmerie",
        consequence:
          "Vous clarifiez qui fait quoi, recommandation réitérée de la Cour. Efficacité en vue, sans heurts majeurs ; les corporatismes grondent.",
        une:
          "Police, gendarmerie : les frontières bougent — Le Courrier de la République",
        reaction:
          "Le préfet coordonnateur esquisse un sourire. « Une vieille recommandation, jamais appliquée. Les deux maisons vont gronder, puis s'y faire. »",
        effets: { bonheur: 1, confiance: 2, pouvoirAchat: 0, finances: 1, cohesion: 1 },
      },
      {
        label: "Ne rien changer, priorité au budget",
        consequence:
          "Vous reportez toute évolution. Les économies sont immédiates ; le sentiment d'insécurité, lui, ne se gère pas par le non-choix.",
        une:
          "Sécurité : le statu quo assumé — L'Écho du matin",
        reaction:
          "Le préfet coordonnateur remet son dossier sous le bras. « Entendu. Je vous le dis franchement : le sentiment d'insécurité ne s'administre pas par le report. »",
        effets: { bonheur: -2, confiance: -2, pouvoirAchat: 0, finances: 2, cohesion: -2 },
      },
    ],
  },
  {
    id: "securite-municipales",
    theme: "Sécurité",
    titre: "Les polices municipales",
    situation:
      "Les 28 000 policiers municipaux forment une « troisième force » présente dans 80 % des communes de plus de 3 500 habitants, mais leur développement dépend plus de la richesse des communes que de la délinquance (Cour des comptes, RPA 2026).",
    question: "Quel cadre pour les polices municipales ?",
    options: [
      {
        label: "Clarifier les missions et donner les moyens techniques",
        consequence:
          "Vous reprenez la doctrine de la Cour : missions de proximité formalisées, accès effectif aux fichiers en mobilité, amendes forfaitaires délictuelles. Cadre clair, contrôle renforcé.",
        effets: { bonheur: 2, confiance: 2, pouvoirAchat: 0, finances: -2, cohesion: 1 },
      },
      {
        label: "Leur donner le statut d'officier de police judiciaire",
        consequence:
          "Vous étendez leurs pouvoirs judiciaires. Les maires applaudissent ; la Cour note qu'il n'existe pas de consensus, et la formation judiciaire coûtera cher.",
        effets: { bonheur: 1, confiance: 0, pouvoirAchat: 0, finances: -1, cohesion: -1 },
      },
      {
        label: "Mutualiser les polices à l'échelle intercommunale",
        consequence:
          "Vous rendez la mutualisation obligatoire dans les intercommunalités. Rationalisation réelle ; les maires des communes riches perdent leur police à eux.",
        effets: { bonheur: 0, confiance: 1, pouvoirAchat: 0, finances: 2, cohesion: 0 },
      },
      {
        label: "Doter d'abord les communes pauvres à forte délinquance",
        consequence:
          "Vous corrigez l'inégalité de fait : l'État cofinance les polices municipales là où la délinquance est forte et les ressources faibles. Ciblé et juste ; les communes riches financent seules.",
        effets: { bonheur: 2, confiance: 2, pouvoirAchat: 0, finances: -3, cohesion: 3 },
      },
    ],
  },
  {
    id: "securite-prevention",
    theme: "Sécurité",
    titre: "Prévenir plutôt que réprimer ?",
    situation:
      "Les crimes et délits constatés ont progressé de 6,5 % entre 2016 et 2024, avec une hausse marquée des atteintes aux personnes — violences intrafamiliales, violences sexuelles, stupéfiants (Cour des comptes, RPA 2026).",
    question: "Quel curseur entre prévention et répression ?",
    options: [
      {
        label: "Replacer les conseils locaux de prévention au centre",
        consequence:
          "Vous reprenez la stratégie 2025-2030 : concertation locale, prévention situationnelle et sociale. Effet lent, documenté, peu spectaculaire — et peu coûteux.",
        effets: { bonheur: 2, confiance: 2, pouvoirAchat: 0, finances: -2, cohesion: 3 },
      },
      {
        label: "Accélérer la réponse pénale : justice de proximité",
        consequence:
          "Vous financez des audiences rapides pour les délits du quotidien. La réponse immédiate dissuade et rassure ; les tribunaux, déjà saturés, réclament des moyens.",
        effets: { bonheur: 2, confiance: 2, pouvoirAchat: 0, finances: -4, cohesion: 1 },
      },
      {
        label: "Généraliser la vidéoprotection",
        consequence:
          "Vous subventionnez massivement les caméras. L'effet mesuré est limité sur les atteintes aux personnes ; les défenseurs des libertés s'inquiètent.",
        effets: { bonheur: 0, confiance: 0, pouvoirAchat: 0, finances: -3, cohesion: -1 },
      },
      {
        label: "Prévention spécialisée jeunesse : éducateurs de rue",
        consequence:
          "Vous doublez les effectifs d'éducateurs dans les quartiers. Le lien avec les jeunes se reconstruit ; les effets se mesurent en années, pas en trimestres.",
        effets: { bonheur: 3, confiance: 1, pouvoirAchat: 0, finances: -3, cohesion: 3 },
      },
    ],
  },
  {
    id: "territoires-qpv",
    theme: "Cohésion",
    titre: "Les quartiers prioritaires",
    situation:
      "1 609 quartiers prioritaires concentrent 8,7 % de la population française, avec un taux de pauvreté trois fois supérieur et un chômage deux fois plus élevé que la moyenne, pour 524 M€ de crédits spécifiques en 2024 (Cour des comptes, RPA 2026).",
    question: "Quelle doctrine pour la politique de la ville ?",
    options: [
      {
        label: "Droit commun d'abord : recenser avant de créer",
        consequence:
          "Vous reprenez la recommandation de la Cour : identifier ce que font déjà les politiques générales dans les quartiers avant d'ajouter des dispositifs. Fin des empilements illisibles.",
        effets: { bonheur: 1, confiance: 2, pouvoirAchat: 0, finances: 1, cohesion: 1 },
      },
      {
        label: "Doubler les crédits de la politique de la ville",
        consequence:
          "Vous doublez l'effort spécifique. Les associations et les habitants saluent ; sans réforme de l'articulation, le risque de substitution au droit commun demeure.",
        effets: { bonheur: 3, confiance: 2, pouvoirAchat: 1, finances: -6, cohesion: 3 },
      },
      {
        label: "Refondre le zonage : sortir les quartiers qui vont mieux",
        consequence:
          "Vous concentrez les moyens sur les quartiers qui stagnent. Plus juste en théorie ; les quartiers sortants perdent leurs crédits et le disent.",
        effets: { bonheur: -2, confiance: 1, pouvoirAchat: 0, finances: 2, cohesion: -2 },
      },
      {
        label: "Pacte éducatif dans chaque quartier prioritaire",
        consequence:
          "Vous faites de l'école le pivot : cités éducatives, soutien scolaire, santé. Les effets sur la réussite se mesureront dans une génération.",
        effets: { bonheur: 3, confiance: 2, pouvoirAchat: 0, finances: -4, cohesion: 3 },
        suite: "territoires-cites",
      },
    ],
  },
  {
    id: "territoires-cites",
    theme: "Cohésion",
    titre: "Les cités éducatives",
    situation:
      "250 cités éducatives coordonnent l'action éducative dans les quartiers prioritaires en 2025, mais leurs effets sont difficiles à isoler de ceux de l'éducation prioritaire (Cour des comptes, RPA 2026).",
    question: "Quel avenir pour les cités éducatives ?",
    options: [
      {
        label: "Généraliser avec évaluation intégrée",
        consequence:
          "Vous étendez le dispositif en imposant une mesure d'impact dès la conception. Plus de quartiers couverts, une preuve enfin constituée.",
        effets: { bonheur: 3, confiance: 2, pouvoirAchat: 0, finances: -4, cohesion: 3 },
      },
      {
        label: "Stabiliser et mesurer avant d'étendre",
        consequence:
          "Vous consolidez l'existant et évaluez sérieusement. Gestion rigoureuse ; les quartiers non couverts attendront.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 0, finances: 0, cohesion: 1 },
      },
      {
        label: "Intégrer au budget de droit commun de l'Éducation nationale",
        consequence:
          "Vous pérennisez en basculant le financement dans le budget ordinaire. Fin du pilotage parallèle ; le risque de dilution dans la masse est réel.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 0, finances: 1, cohesion: 1 },
      },
      {
        label: "Remplacer par des chèques activités pour les jeunes",
        consequence:
          "Vous transformez le dispositif en aide directe aux familles pour les activités. Simple et visible ; le travail collectif de quartier disparaît.",
        effets: { bonheur: 1, confiance: -1, pouvoirAchat: 1, finances: 2, cohesion: -2 },
      },
    ],
  },
  {
    id: "territoires-perequation",
    theme: "Cohésion",
    titre: "La péréquation entre collectivités",
    situation:
      "La péréquation des ressources entre collectivités atteint 14,4 Md€ en 2024, mais les écarts de potentiel financier par habitant restent de 1,9 à 1,2 après péréquation, contre 2,3 à 1,3 avant (Cour des comptes, RPA 2026).",
    question: "Comment renforcer la solidarité financière entre territoires ?",
    options: [
      {
        label: "Basculer les dotations forfaitaires vers la péréquation",
        consequence:
          "Vous reprenez la recommandation de la Cour, à niveau constant de transferts. Les communes pauvres gagnent, les riches perdent un peu ; le débat municipal s'annonce vif.",
        effets: { bonheur: 1, confiance: 2, pouvoirAchat: 0, finances: 0, cohesion: 3 },
      },
      {
        label: "Accroître les fonds de péréquation horizontale",
        consequence:
          "Vous augmentez les prélèvements sur les collectivités riches au profit des pauvres. Solidarité renforcée ; les métropoles contestent le mécanisme.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 0, finances: -2, cohesion: 3 },
      },
      {
        label: "Généraliser les pactes financiers intercommunaux",
        consequence:
          "Vous imposez la solidarité interne à chaque intercommunalité, comme le suggère la Cour. Progrès réel à l'échelle locale, sans toucher aux dotations nationales.",
        effets: { bonheur: 0, confiance: 1, pouvoirAchat: 0, finances: 1, cohesion: 2 },
      },
      {
        label: "Geler toute réforme pendant le mandat municipal",
        consequence:
          "Vous attendez le cycle 2026-2032 pour ne déstabiliser personne. Statu quo confortable ; les écarts, eux, continuent de se creuser.",
        effets: { bonheur: 0, confiance: -1, pouvoirAchat: 0, finances: 1, cohesion: -1 },
      },
    ],
  },
  {
    id: "territoires-crte",
    theme: "Cohésion",
    titre: "La jungle des contrats de territoire",
    situation:
      "849 contrats de relance et de transition écologique ont été signés depuis 2021, 12 contrats de plan État-Région en juillet 2025, et les soutiens à l'investissement local ont atteint 19,5 Md€ en 2024 — sans stratégie mesurable (Cour des comptes, RPA 2026).",
    question: "Comment rationaliser la contractualisation État-collectivités ?",
    options: [
      {
        label: "Tout intégrer dans les CPER et les CRTE",
        consequence:
          "Vous reprenez la recommandation de la Cour : les dispositifs parallèles rejoignent les deux contrats-cadres. Lisibilité retrouvée ; les habitudes de guichets multiples résistent.",
        effets: { bonheur: 0, confiance: 2, pouvoirAchat: 0, finances: 2, cohesion: 1 },
      },
      {
        label: "Supprimer les appels à projets parallèles",
        consequence:
          "Vous coupez les micro-dispositifs qui doublonnent. Les dossiers des petites communes se simplifient ; quelques beaux projets orphelins protestent.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 0, finances: 2, cohesion: 0 },
      },
      {
        label: "Évaluation partenariale obligatoire des contrats",
        consequence:
          "Chaque contrat sera évalué avec ses signataires, résultats publiés. La culture du résultat progresse ; les effets ne seront visibles qu'au prochain cycle.",
        effets: { bonheur: 0, confiance: 2, pouvoirAchat: 0, finances: 0, cohesion: 1 },
      },
      {
        label: "Garder la pluralité des guichets",
        consequence:
          "Vous conservez la diversité des financements : chaque territoire trouve son guichet. La dépense reste illisible et les effets d'aubaine prospèrent.",
        effets: { bonheur: 1, confiance: -1, pouvoirAchat: 0, finances: -2, cohesion: 0 },
      },
    ],
  },
  {
    id: "finances-dette",
    theme: "Finances publiques",
    titre: "L'étouffement budgétaire",
    situation:
      "Sans redressement, la charge d'intérêts de la dette augmentera de 70 milliards d'euros par an au bout de dix ans (Banque de France, Rapport annuel 2025). Chaque euro d'intérêt est un euro qui ne va ni aux hôpitaux ni aux écoles.",
    question: "Quelle trajectoire pour les finances publiques ?",
    lieu: "Bureau du président, 22 h 10",
    urgence: "L'adjudication de demain ouvre à 10 h 50",
    scenette:
      "Le bureau sent le papier et le café froid. Le secrétaire général de l'Élysée a étalé trois scénarios de trajectoire, chacun avec sa courbe. Il n'en commente aucun : il attend que vous choisissiez lequel vous défendrez demain matin, et dans dix ans.",
    options: [
      {
        label: "Plan pluriannuel d'économies et revue des dépenses",
        consequence:
          "Vous engagez le redressement : chaque politique est passée au crible de l'efficacité. Les marchés et Bruxelles saluent ; les premiers budgets rabotés se paient en popularité.",
        une:
          "Rigueur : le président prend le pays de vitesse — Le Courrier de la République",
        reaction:
          "Le secrétaire général plie ses courbes. « Les créanciers dormiront mieux. Vos ministres, moins : chacun croit que la revue de dépenses parle du voisin. »",
        effets: { bonheur: -4, confiance: 3, pouvoirAchat: -1, finances: 8, cohesion: -2 },
        suite: "finances-collectivites",
      },
      {
        label: "Contribution accrue des hauts revenus et patrimoines",
        consequence:
          "Vous demandez l'effort aux plus aisés. Recettes nouvelles et sentiment de justice ; la vigilance s'impose sur les effets d'évitement et d'expatriation.",
        une:
          "Les grandes fortunes appelées à l'effort — L'Écho du matin",
        reaction:
          "Le secrétaire général reste prudent. « Le pays trouvera cela juste. Reste à savoir combien de ces patrimoines seront encore ici l'an prochain pour le payer. »",
        effets: { bonheur: 1, confiance: 0, pouvoirAchat: -1, finances: 5, cohesion: 1 },
      },
      {
        label: "La croissance d'abord : pas d'austérité",
        consequence:
          "Vous pariez sur l'activité pour résorber le déficit. Pari tenable quand la croissance est là — elle est de 0,9 % ; les taux d'emprunt, eux, montent.",
        une:
          "Pas d'austérité : le pari présidentiel — Le Courrier de la République",
        reaction:
          "Le secrétaire général pose enfin son stylo. « C'est un pari, et je vous le dis comme tel : il se gagne avec de la croissance. Elle n'est pas au rendez-vous. »",
        effets: { bonheur: 3, confiance: -2, pouvoirAchat: 1, finances: -5, cohesion: 1 },
      },
      {
        label: "Négocier un délai avec les partenaires européens",
        consequence:
          "Vous obtenez un étalement de la trajectoire. Répit diplomatique réel ; le stock de dette, lui, continue de produire des intérêts.",
        une:
          "Bruxelles accorde du temps à Paris — L'Écho du matin",
        reaction:
          "Le secrétaire général acquiesce sans chaleur. « Du temps, oui. Les intérêts, eux, ne prennent pas de délai — ils courent aussi la nuit. »",
        effets: { bonheur: 0, confiance: 1, pouvoirAchat: 0, finances: 2, cohesion: 0 },
      },
    ],
  },
  {
    id: "finances-croissance",
    theme: "Économie",
    titre: "La croissance potentielle divisée par deux",
    situation:
      "La croissance potentielle française est passée de 2 % en 2000 à 1,1 % aujourd'hui, contre 2,2 % aux États-Unis ; les rapports Draghi et Letta en détaillent les remèdes : marché unique, investissement, innovation (Banque de France, Rapport annuel 2025).",
    question: "Quel levier pour la croissance potentielle ?",
    options: [
      {
        label: "Choc de simplification administrative",
        consequence:
          "Vous appliquez la doctrine Draghi-Letta : alléger ce qui peut l'être sans déréguler à l'américaine. Les entreprises respirent ; chaque simplification a son lobby perdant.",
        effets: { bonheur: 1, confiance: 3, pouvoirAchat: 1, finances: 1, cohesion: 0 },
      },
      {
        label: "Orienter l'épargne vers les fonds propres des entreprises",
        consequence:
          "Vous reprenez la piste de la Banque de France : inciter l'épargne à financer l'investissement plutôt que les liquidités. Levier puissant et lent ; l'épargnant déteste qu'on touche à ses habitudes.",
        effets: { bonheur: 0, confiance: 2, pouvoirAchat: 0, finances: 1, cohesion: 0 },
        suite: "finances-epargne",
      },
      {
        label: "Plan d'investissement innovation renforcé",
        consequence:
          "Vous abondez France 2030 sur les technologies de rupture. Des champions peuvent naître ; l'État n'a pas toujours été bon dans la sélection des start-up.",
        effets: { bonheur: 2, confiance: 2, pouvoirAchat: 0, finances: -6, cohesion: 1 },
      },
      {
        label: "Alléger le coût du travail des bas salaires",
        consequence:
          "Vous réduisez les cotisations au niveau du Smic. L'emploi peu qualifié est stimulé ; le coût budgétaire est permanent et les effets de seuil se déplacent.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 1, finances: -5, cohesion: 0 },
      },
    ],
  },
  {
    id: "finances-inflation",
    theme: "Économie",
    titre: "L'inflation est revenue",
    situation:
      "L'inflation est revenue à 0,9 % en France en 2025 — 0,7 % fin décembre — contre 2,3 % en 2024, sans récession (Banque de France, Rapport annuel 2025). Une marge de manœuvre inédite existe pour le pouvoir d'achat.",
    question: "Comment utiliser cette marge de manœuvre ?",
    lieu: "Salon vert, 8 h 05",
    urgence: "Arbitrage attendu avant le conseil des ministres",
    scenette:
      "La conseillère économique est arrivée avec une nouvelle rare dans ce bureau : une bonne. Les prix ont cessé de courir. Elle prévient d'emblée que la fenêtre est étroite et qu'elle se refermera, sans dire quand.",
    options: [
      {
        label: "Revaloriser les minima sociaux",
        consequence:
          "Vous profitez de l'accalmie des prix pour revaloriser. Les plus modestes respirent immédiatement ; la dépense est pérenne, la marge était temporaire.",
        une:
          "Minima sociaux : le coup d'envoi du quinquennat — Le Courrier de la République",
        reaction:
          "La conseillère économique note la décision. « Les plus modestes le sentiront dès le mois prochain. Mais vous venez d'engager une dépense permanente sur une marge qui, elle, ne l'est pas. »",
        effets: { bonheur: 4, confiance: 1, pouvoirAchat: 4, finances: -5, cohesion: 2 },
      },
      {
        label: "Bouclier ciblé alimentation-énergie pour les modestes",
        consequence:
          "Vous ciblez les ménages dont le panier s'est le plus renchéri — les modestes ont subi une inflation plus forte que les aisés, comme l'a mesuré l'INSEE à La Réunion. Juste et lisible.",
        une:
          "Alimentation, énergie : l'aide va aux plus exposés — L'Écho du matin",
        reaction:
          "La conseillère économique approuve. « Ciblé, donc défendable. Préparez-vous aux dossiers de ceux qui sont juste au-dessus du seuil : ils sont toujours les plus durs. »",
        effets: { bonheur: 3, confiance: 1, pouvoirAchat: 3, finances: -4, cohesion: 2 },
      },
      {
        label: "Conserver la marge : prudence budgétaire",
        consequence:
          "Vous n'utilisez pas la marge. Les comptes vous remercient ; les ménages, qui ne voient pas les prix baisser mais seulement ralentir, moins.",
        une:
          "Le président ne dépensera pas l'accalmie — Le Courrier de la République",
        reaction:
          "La conseillère économique hoche la tête. « Techniquement, c'est le meilleur choix. Politiquement, personne ne remercie jamais pour une dépense qui n'a pas eu lieu. »",
        effets: { bonheur: -1, confiance: 1, pouvoirAchat: 0, finances: 2, cohesion: 0 },
      },
      {
        label: "Chèque pouvoir d'achat ponctuel",
        consequence:
          "Vous distribuez un chèque unique. Effet immédiat et très visible ; l'instrument est connu, et son effet sur la consommation s'érode à chaque usage.",
        une:
          "Un chèque pour tous avant l'été — L'Écho du matin",
        reaction:
          "La conseillère économique ne cache pas sa réserve. « L'effet sera immédiat et très visible. C'est le troisième chèque en peu d'années : chacun porte un peu moins loin que le précédent. »",
        effets: { bonheur: 4, confiance: -1, pouvoirAchat: 3, finances: -6, cohesion: 1 },
      },
    ],
  },
  {
    id: "finances-epargne",
    theme: "Économie",
    titre: "L'épargne qui dort",
    situation:
      "L'épargne des ménages reste exceptionnellement élevée : les revenus des retraités ont augmenté entre 2023 et 2024 sans que leur consommation suive, ce qui explique les deux tiers de la hausse du taux d'épargne (INSEE, Rapport annuel 2025).",
    question: "Comment remettre l'épargne au service de l'économie ?",
    options: [
      {
        label: "Soutenir la consommation des bas revenus",
        consequence:
          "Vous ciblez ceux qui consomment tout ce qu'ils gagnent. L'effet sur l'activité est immédiat ; il se paie en dépense publique.",
        effets: { bonheur: 3, confiance: 1, pouvoirAchat: 3, finances: -4, cohesion: 1 },
      },
      {
        label: "Canaliser l'épargne vers l'investissement productif",
        consequence:
          "Vous créez des incitations à investir en actions et fonds propres, piste défendue par la Banque de France. La croissance potentielle y gagnera ; l'épargnant prudent se sent bousculé.",
        effets: { bonheur: 0, confiance: 2, pouvoirAchat: 0, finances: 1, cohesion: 0 },
      },
      {
        label: "Fiscaliser une partie de l'épargne excédentaire",
        consequence:
          "Vous taxez les encours au-delà d'un seuil élevé. Recette réelle ; le signal envoyé à l'épargne populaire est détestable, et les placements s'expatrient facilement.",
        effets: { bonheur: -3, confiance: -1, pouvoirAchat: -1, finances: 4, cohesion: -2 },
      },
      {
        label: "Campagne de confiance, sans mesure contraignante",
        consequence:
          "Vous expliquez que dépenser, c'est faire vivre l'économie. Personne ne s'oppose à une campagne ; personne ne change d'habitude pour une affiche.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 0, finances: 0, cohesion: 0 },
      },
    ],
  },
  {
    id: "finances-collectivites",
    theme: "Finances publiques",
    titre: "Les 316 milliards des collectivités",
    situation:
      "Les collectivités territoriales ont consacré au moins 316 Md€ à la cohésion et au développement des territoires en 2024, mais l'absence de consolidation comptable prive les acteurs d'une vision claire de la dépense publique globale (Cour des comptes, RPA 2026).",
    question: "Comment clarifier la dépense des collectivités ?",
    options: [
      {
        label: "Imposer une consolidation comptable des finances locales",
        consequence:
          "Vous rendez la dépense totale enfin visible — préalable à toute maîtrise. Réforme technique, impopulaire chez les élus locaux, précieuse pour le pilotage.",
        effets: { bonheur: 0, confiance: 3, pouvoirAchat: 0, finances: 3, cohesion: 0 },
      },
      {
        label: "Contractualiser les objectifs de dépense",
        consequence:
          "Vous négociez des trajectoires de dépense avec les grandes collectivités. L'autonomie constitutionnelle grince ; la discipline collective progresse.",
        effets: { bonheur: 0, confiance: 1, pouvoirAchat: 0, finances: 3, cohesion: -1 },
      },
      {
        label: "Respecter l'autonomie : aucune contrainte nouvelle",
        consequence:
          "Vous ne touchez pas à la libre administration. Les élus locaux respirent ; la dérive relative des dépenses locales continue.",
        effets: { bonheur: 1, confiance: -1, pouvoirAchat: 0, finances: -2, cohesion: 0 },
      },
      {
        label: "Conditionner les fonds de transition à la transparence",
        consequence:
          "Vous liez les financements verts à la publication des comptes consolidés. Levier indirect et ciblé ; les territoires pressés contournent.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 0, finances: 0, cohesion: 1 },
      },
    ],
  },
  {
    id: "finances-mission",
    theme: "Finances publiques",
    titre: "La mission Cohésion des territoires",
    situation:
      "La mission Cohésion des territoires pèse 18,5 Md€ de crédits en 2024, auxquels s'ajoutent des opérateurs multiples — ANCT, ANRU, ANAH, ADEME, CEREMA — dont la coordination est perfectible (Cour des comptes, RPA 2026).",
    question: "Quelle organisation pour l'action territoriale de l'État ?",
    options: [
      {
        label: "Fusionner les opérateurs en une agence unique",
        consequence:
          "Vous simplifiez radicalement le paysage. Économies d'échelle et lisibilité ; la fusion d'agences aux cultures différentes consomme des années d'énergie managériale.",
        effets: { bonheur: 0, confiance: 2, pouvoirAchat: 0, finances: 3, cohesion: -1 },
      },
      {
        label: "Donner à l'ANCT le portage interministériel",
        consequence:
          "Vous reprenez le constat de la Cour : l'agence de cohésion devient chef de file avec autorité réelle. Coordination renforcée sans casse d'outil.",
        effets: { bonheur: 1, confiance: 2, pouvoirAchat: 0, finances: 1, cohesion: 1 },
      },
      {
        label: "Recentrer les crédits sur les territoires vulnérables",
        consequence:
          "Vous ciblez : les 57 % de communes en zone France ruralités revitalisation et les quartiers prioritaires d'abord. Plus juste ; les territoires intermédiaires perdent.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 0, finances: 1, cohesion: 2 },
      },
      {
        label: "Couper 10 % dans les dispositifs non évalués",
        consequence:
          "Vous taillez dans ce qui n'a pas prouvé son effet. Économies réelles ; l'absence d'évaluation ne signifie pas l'inefficacité, et des actions utiles tombent.",
        effets: { bonheur: -1, confiance: 0, pouvoirAchat: 0, finances: 3, cohesion: -1 },
      },
    ],
  },
  {
    id: "social-natalite",
    theme: "Société",
    titre: "Le recul des naissances",
    situation:
      "Les naissances ont reculé de plus de 20 % par rapport à 2010 (INSEE, Rapport annuel 2025). Le vieillissement qui s'annonce pèsera sur les retraites, la santé et la croissance.",
    question: "Quelle politique familiale ?",
    options: [
      {
        label: "Plan natalité : congé parental et crèches",
        consequence:
          "Vous investissez dans l'accueil de la petite enfance et un congé parental revalorisé. Les jeunes parents respirent ; l'effet natalité, s'il vient, prendra des années.",
        effets: { bonheur: 4, confiance: 2, pouvoirAchat: 1, finances: -6, cohesion: 1 },
        suite: "social-monoparentalite",
      },
      {
        label: "Soutenir le logement des familles",
        consequence:
          "Vous ciblez le premier frein cité : la place pour un enfant de plus. Les constructions familiales et les attributions prioritaires progressent.",
        effets: { bonheur: 3, confiance: 1, pouvoirAchat: 1, finances: -4, cohesion: 1 },
      },
      {
        label: "Étudier les causes avant toute mesure",
        consequence:
          "Vous commandez une grande étude sur les renoncements. Rigueur intellectuelle ; pendant l'étude, la courbe continue de descendre.",
        effets: { bonheur: 0, confiance: 0, pouvoirAchat: 0, finances: 0, cohesion: 0 },
      },
      {
        label: "Communication pro-famille, sans dépense nouvelle",
        consequence:
          "Vous valorisez la parentalité dans l'espace public. Gestuelle sans coût ; aucun frein concret n'est levé.",
        effets: { bonheur: 0, confiance: -1, pouvoirAchat: 0, finances: 0, cohesion: 0 },
      },
    ],
  },
  {
    id: "social-monoparentalite",
    theme: "Société",
    titre: "Les familles monoparentales",
    situation:
      "En 2023, trois enfants sur dix vivaient avec un seul parent — 23 % en famille monoparentale, 7 % en famille recomposée avec un beau-parent —, un phénomène particulièrement marqué outre-mer (INSEE, Rapport annuel 2025).",
    question: "Comment soutenir les familles monoparentales ?",
    options: [
      {
        label: "Garantie publique généralisée contre les pensions impayées",
        consequence:
          "L'État avance la pension alimentaire quand l'autre parent fait défaut, puis se retourne. Fin des impayés qui jettent des familles dans la pauvreté ; le recouvrement coûte.",
        effets: { bonheur: 4, confiance: 2, pouvoirAchat: 2, finances: -3, cohesion: 2 },
      },
      {
        label: "Crèches et accueil aux horaires atypiques",
        consequence:
          "Vous adaptez l'accueil aux parents seuls qui travaillent tôt, tard ou le week-end. L'accès à l'emploi des mères seules s'améliore directement.",
        effets: { bonheur: 3, confiance: 1, pouvoirAchat: 1, finances: -4, cohesion: 1 },
      },
      {
        label: "Priorité d'accès au logement social",
        consequence:
          "Vous inscrivez la monoparentalité parmi les priorités d'attribution. Des familles se logent ; les autres publics prioritaires s'estiment lésés.",
        effets: { bonheur: 2, confiance: 1, pouvoirAchat: 1, finances: -1, cohesion: 0 },
      },
      {
        label: "Soutien psychologique et juridique dédié",
        consequence:
          "Vous financez des lieux d'écoute et d'aide juridique pour les séparations. Le quotidien s'apaise ; la dimension économique reste entière.",
        effets: { bonheur: 2, confiance: 1, pouvoirAchat: 0, finances: -2, cohesion: 1 },
      },
    ],
  },
  {
    id: "social-pensions",
    theme: "Société",
    titre: "Les pensions des femmes",
    situation:
      "Les femmes perçoivent des pensions inférieures de 30 % à celles des hommes — carrières plus courtes, temps partiels plus fréquents, salaires moins élevés (INSEE, Rapport annuel 2025). Les séparations conjugales les font d'ailleurs basculer plus souvent dans la pauvreté.",
    question: "Comment corriger l'écart de pensions ?",
    options: [
      {
        label: "Majorer les droits des mères : rachat de trimestres facilité",
        consequence:
          "Vous permettez le rachat à coût réduit des trimestres manquants pour enfants. Les pensions des mères remontent ; la caisse de retraite absorbe le choc.",
        effets: { bonheur: 3, confiance: 1, pouvoirAchat: 1, finances: -4, cohesion: 2 },
      },
      {
        label: "Partage obligatoire des droits parentaux entre parents",
        consequence:
          "Vous répartissez par défaut les majorations entre les deux parents. Mesure d'équité structurelle, à effet lent ; les pères peu concernés rouspètent.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 0, finances: -1, cohesion: 1 },
      },
      {
        label: "Renforcer les sanctions contre les écarts salariaux",
        consequence:
          "Vous attaquez la source : les écarts de salaire à poste égal. Les entreprises négligentes paient ; l'effet sur les pensions se verra dans trente ans.",
        effets: { bonheur: 2, confiance: 1, pouvoirAchat: 1, finances: 0, cohesion: 1 },
      },
      {
        label: "Fonds de rattrapage pour les basses pensions de femmes",
        consequence:
          "Vous ciblez les retraitées modestes actuelles par une allocation. Effet immédiat sur la pauvreté des aînées ; la cause structurelle demeure.",
        effets: { bonheur: 3, confiance: 1, pouvoirAchat: 2, finances: -3, cohesion: 1 },
      },
    ],
  },
  {
    id: "social-pauvrete",
    theme: "Société",
    titre: "La pauvreté qui s'installe",
    situation:
      "Parmi les adultes ayant vécu au moins une année sous le seuil de pauvreté entre 2016 et 2019, un quart sont restés pauvres les quatre années (INSEE, Rapport annuel 2025). La pauvreté persistante creuse ses propres verrous.",
    question: "Comment casser la pauvreté persistante ?",
    options: [
      {
        label: "Revenu minimum pour les moins de 25 ans",
        consequence:
          "Vous ouvrez le RSA aux jeunes sans ressources. La précarité étudiante et jeune recule ; le coût est significatif et le débat sur l'assistance rouvert.",
        effets: { bonheur: 4, confiance: 2, pouvoirAchat: 2, finances: -6, cohesion: 2 },
      },
      {
        label: "Accompagnement intensif et long des sortants de pauvreté",
        consequence:
          "Vous financez un suivi renforcé sur plusieurs années : emploi, logement, santé. Coûteux par personne, efficace documenté — mais ne peut couvrir tout le monde.",
        effets: { bonheur: 2, confiance: 2, pouvoirAchat: 1, finances: -3, cohesion: 2 },
      },
      {
        label: "Emplois aidés d'insertion par l'activité",
        consequence:
          "Vous développez les structures d'insertion par l'activité économique. Des parcours se reconstruisent ; la sortie vers l'emploi ordinaire reste le maillon fragile.",
        effets: { bonheur: 2, confiance: 1, pouvoirAchat: 1, finances: -3, cohesion: 1 },
      },
      {
        label: "Revalorisation générale des minima sociaux",
        consequence:
          "Vous augmentez tous les minima. Effet immédiat sur le niveau de vie ; la trappe à inactivité s'approfondit si l'accompagnement ne suit pas.",
        effets: { bonheur: 4, confiance: 1, pouvoirAchat: 3, finances: -7, cohesion: 2 },
      },
    ],
  },
  {
    id: "social-sansdomicile",
    theme: "Société",
    titre: "Les personnes sans domicile",
    situation:
      "L'enquête Sans Domicile 2025 — la troisième après 2001 et 2012 — a interrogé 16 000 personnes fréquentant les services d'aide dans plus de 100 agglomérations ; premiers résultats attendus fin 2026 (INSEE, Rapport annuel 2025).",
    question: "Quelle politique pour les sans-abri ?",
    options: [
      {
        label: "Hébergement d'urgence inconditionnel : une place pour chacun",
        consequence:
          "Vous garantissez une place à toute personne qui en demande une. La rue se vide progressivement ; les places coûtent, et l'hébergement n'est pas un logement.",
        effets: { bonheur: 4, confiance: 2, pouvoirAchat: 0, finances: -5, cohesion: 3 },
      },
      {
        label: "Généraliser « Un chez-soi d'abord »",
        consequence:
          "Vous logez d'abord, vous accompagnez ensuite : le logement devient le point de départ, pas la récompense. Efficacité documentée ; exige du parc disponible.",
        effets: { bonheur: 4, confiance: 3, pouvoirAchat: 1, finances: -5, cohesion: 3 },
      },
      {
        label: "Attendre les résultats de l'enquête fin 2026",
        consequence:
          "Vous fondez la politique sur la mesure à venir. Rigueur statistique ; les personnes à la rue, elles, n'attendent pas une publication.",
        effets: { bonheur: -1, confiance: 0, pouvoirAchat: 0, finances: 1, cohesion: -1 },
      },
      {
        label: "Renforcer maraudes et soins sans hébergement nouveau",
        consequence:
          "Vous améliorez l'existant : plus de maraudes, de soins de rue. Humanité renforcée, sortie de rue inchangée.",
        effets: { bonheur: 1, confiance: 0, pouvoirAchat: 0, finances: -2, cohesion: 1 },
      },
    ],
  },
  {
    id: "environnement-carbone",
    theme: "Environnement",
    titre: "La trajectoire carbone",
    situation:
      "L'empreinte carbone de la France a baissé de 3,4 % en 2024, après −6,1 % en 2023 (INSEE, Rapport annuel 2025). La trajectoire tient, mais la dépendance aux importations carbonées demeure.",
    question: "Quel rythme pour la transition ?",
    lieu: "Salon vert, 14 h 30",
    urgence: "Le discours de trajectoire est attendu vendredi",
    scenette:
      "La conseillère écologie a apporté la courbe d'empreinte, celle qui descend enfin. Elle la pose à l'envers sur la table, comme si le graphique n'était pas le sujet. Le sujet, dit-elle, c'est le rythme — et qui le tiendra.",
    options: [
      {
        label: "Accélérer : normes et investissement vert massif",
        consequence:
          "Vous haussez l'ambition : rénovation, industrie verte, mobilités. La trajectoire s'infléchit ; la facture publique et les contraintes pour les ménages aussi.",
        une:
          "Climat : le président met le pied sur l'accélérateur — Le Courrier de la République",
        reaction:
          "La conseillère écologie ne masque pas sa satisfaction. « La trajectoire s'infléchira, vraiment. Le ministre du Budget demandera dès demain où l'on prend l'argent, et il faudra le lui dire. »",
        effets: { bonheur: 1, confiance: 2, pouvoirAchat: -1, finances: -6, cohesion: 0 },
      },
      {
        label: "Tenir la trajectoire actuelle",
        consequence:
          "Vous consolidez sans accélérer. La baisse continue au rythme observé ; les objectifs 2030 resteront juste hors d'atteinte.",
        une:
          "Climat : ni recul ni accélération — L'Écho du matin",
        reaction:
          "La conseillère écologie range sa courbe. « On continue. Vous savez comme moi que continuer, à ce rythme-là, laisse l'échéance juste hors de portée. »",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 0, finances: 0, cohesion: 0 },
      },
      {
        label: "Bonus-malus renforcé véhicules et logements",
        consequence:
          "Vous durcissez le malus et abondez le bonus. Le marché s'oriente ; les ménages contraints à la voiture se sentent punis.",
        une:
          "Voitures, logements : le malus se durcit — Le Courrier de la République",
        reaction:
          "La conseillère écologie prévient. « Le marché s'orientera vite. Ceux qui n'ont pas le choix de leur voiture le vivront comme une punition, et ils le diront fort. »",
        effets: { bonheur: -1, confiance: 1, pouvoirAchat: -2, finances: 2, cohesion: -1 },
      },
      {
        label: "Fonds pour les territoires dépendants des importations",
        consequence:
          "Vous ciblez les territoires insulaires et ruraux dont l'empreinte vient des importations, comme La Réunion l'a documenté. Justice territoriale ; effet national limité.",
        une:
          "Outre-mer et ruralité : un fonds pour les territoires exposés — L'Écho du matin",
        reaction:
          "La conseillère écologie approuve à demi. « C'est juste, et ce sera reçu comme tel. À l'échelle nationale, cela ne déplacera pas la courbe. »",
        effets: { bonheur: 2, confiance: 1, pouvoirAchat: 0, finances: -3, cohesion: 2 },
      },
    ],
  },
  {
    id: "environnement-foncier",
    theme: "Environnement",
    titre: "L'artificialisation des sols",
    situation:
      "L'industrie n'occupe que 4,5 % des surfaces artificialisées, mais la réindustrialisation réclame 22 000 hectares d'ici 2030, en tension avec l'objectif de zéro artificialisation nette (Cour des comptes, RPA 2026).",
    question: "Comment arbitrer entre industrie et sobriété foncière ?",
    options: [
      {
        label: "Zéro artificialisation nette strictement appliquée",
        consequence:
          "Vous ne dérogez pas : toute surface prise se compense. Les sols respirent ; certains projets industriels renoncent ou s'exportent.",
        effets: { bonheur: 0, confiance: 1, pouvoirAchat: 0, finances: -1, cohesion: 1 },
      },
      {
        label: "Recycler les friches : fonds national de dépollution",
        consequence:
          "Vous financez la remise en état des friches pour y installer l'industrie. Le cercle est vertueux ; la dépollution est lente et son prix aléatoire.",
        effets: { bonheur: 2, confiance: 2, pouvoirAchat: 0, finances: -4, cohesion: 2 },
      },
      {
        label: "Déroger pour les projets industriels stratégiques",
        consequence:
          "Vous ouvrez une dérogation encadrée pour les projets d'intérêt national. La réindustrialisation avance ; la règle zéro artificialisation perd de sa force d'exemple.",
        effets: { bonheur: -1, confiance: 0, pouvoirAchat: 1, finances: 1, cohesion: -2 },
      },
      {
        label: "Compensation écologique renforcée et contrôlée",
        consequence:
          "Vous exigez une compensation réelle, mesurée et durable pour chaque hectare. Équilibre de bon aloi ; la compensation parfaite n'existe pas en écologie.",
        effets: { bonheur: 0, confiance: 1, pouvoirAchat: 0, finances: -1, cohesion: 0 },
      },
    ],
  },
  {
    id: "environnement-climat-entreprises",
    theme: "Environnement",
    titre: "Les entreprises face au dérèglement",
    situation:
      "Canicules et inondations exposent déjà les entreprises à des risques opérationnels et financiers accrus ; la Banque de France a mis à disposition l'outil ODACC pour identifier précisément ces expositions (Banque de France, Rapport annuel 2025).",
    question: "Comment faire face aux risques climatiques des entreprises ?",
    options: [
      {
        label: "Plans d'adaptation obligatoires pour les grandes entreprises",
        consequence:
          "Vous imposez un plan d'adaptation documenté. Les chaînes de valeur se préparent ; les PME réclament le même effort proportionné.",
        effets: { bonheur: 0, confiance: 2, pouvoirAchat: 0, finances: 0, cohesion: 0 },
      },
      {
        label: "Élargir le régime d'assurance catastrophes naturelles",
        consequence:
          "Vous étendez la couverture et en mutualisez le financement. Les sinistrés seront indemnisés plus vite ; les primes de tous montent.",
        effets: { bonheur: 2, confiance: 1, pouvoirAchat: -1, finances: -3, cohesion: 1 },
      },
      {
        label: "Aides à l'adaptation pour les PME",
        consequence:
          "Vous financez diagnostics et travaux d'adaptation des petites entreprises. Le tissu économique local se protège ; la dépense est diffuse et peu visible.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 0, finances: -3, cohesion: 1 },
      },
      {
        label: "Publier les cartes de risque et informer",
        consequence:
          "Vous rendez les données ODACC accessibles à tous. Transparence utile aux assureurs et aux maires ; sans obligation, peu d'entreprises s'en saisissent.",
        effets: { bonheur: 0, confiance: 1, pouvoirAchat: 0, finances: 0, cohesion: 0 },
      },
    ],
  },
  {
    id: "institutions-euro",
    theme: "Institutions",
    titre: "L'euro numérique",
    situation:
      "La phase d'expérimentation de l'euro numérique a été lancée en octobre 2025, et la Banque de France a été sélectionnée pour développer l'essentiel de l'architecture technique (Banque de France, Rapport annuel 2025). Enjeu : la souveraineté monétaire européenne.",
    question: "Quelle position sur l'euro numérique ?",
    options: [
      {
        label: "Accélérer : la France pilote l'euro numérique",
        consequence:
          "Vous faites de la France la locomotive du projet. Souveraineté renforcée face aux acteurs américains ; l'inquiétude sur la vie privée demande des garanties.",
        effets: { bonheur: 0, confiance: 2, pouvoirAchat: 0, finances: -2, cohesion: 0 },
      },
      {
        label: "Garanties vie privée d'abord",
        consequence:
          "Vous conditionnez votre soutien à un anonymat de fait pour les petits paiements. Confiance renforcée ; le calendrier européen ralentit.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 0, finances: 0, cohesion: 0 },
      },
      {
        label: "Soutenir Wero, le partenariat public-privé européen",
        consequence:
          "Vous misez sur la solution de paiement européenne déjà déployée plutôt que sur la monnaie publique. Pragmatique et rapide ; la souveraineté publique recule d'un cran.",
        effets: { bonheur: 0, confiance: 1, pouvoirAchat: 1, finances: 0, cohesion: 0 },
      },
      {
        label: "Suivre le rythme de la BCE, sans initiative",
        consequence:
          "Vous ne prenez ni risque ni avance. La France reste dans le peloton ; d'autres écrivent les règles.",
        effets: { bonheur: 0, confiance: 0, pouvoirAchat: 0, finances: 1, cohesion: 0 },
      },
    ],
  },
  {
    id: "institutions-educfi",
    theme: "Institutions",
    titre: "La culture financière des Français",
    situation:
      "La culture financière des Français atteint 12,82 sur 20 à l'enquête OCDE (janvier 2026), et les dossiers de surendettement ont progressé de 25 % entre juin 2023 et novembre 2025 (Banque de France, Rapport annuel 2025).",
    question: "Comment armer les Français financièrement ?",
    options: [
      {
        label: "Éducation financière obligatoire au collège et au lycée",
        consequence:
          "Vous inscrivez le budget, le crédit et l'épargne dans les programmes. Effet de long terme documenté ; les programmes scolaires sont déjà denses.",
        effets: { bonheur: 2, confiance: 2, pouvoirAchat: 1, finances: -2, cohesion: 1 },
      },
      {
        label: "Renforcer le 34 14 et l'accompagnement des surendettés",
        consequence:
          "Vous étoffez le numéro unique et les 2,1 millions d'accompagnements annuels. Les dossiers se traitent plus tôt ; le stock de surendettement se résorbe lentement.",
        effets: { bonheur: 3, confiance: 1, pouvoirAchat: 1, finances: -2, cohesion: 1 },
      },
      {
        label: "Plafonner les frais bancaires d'incident",
        consequence:
          "Vous encadrez strictement les frais qui enfoncent les budgets fragiles. Effet immédiat sur le pouvoir d'achat des plus modestes ; les banques répercutent ailleurs.",
        effets: { bonheur: 3, confiance: 1, pouvoirAchat: 2, finances: 0, cohesion: 1 },
      },
      {
        label: "Détection précoce du surendettement via les données bancaires",
        consequence:
          "Vous autorisez un repérage statistique des situations à risque pour proposer l'aide avant la crise. Efficace et préventif ; la question des données personnelles se pose.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 1, finances: -1, cohesion: 0 },
      },
    ],
  },
];
