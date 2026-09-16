import type { Decision } from "./types";

/**
 * Décisions 1 à 25 — santé, éducation, logement, numérique, mobilités,
 * industrie, emploi. Chaque situation cite sa source ; aucun chiffre inventé.
 * Effets : points par jauge, bornés à ±12 (voir types.ts).
 */
export const DECISIONS_A: Decision[] = [
  {
    id: "sante-maillage",
    theme: "Santé",
    titre: "Le maillage hospitalier",
    situation:
      "La France compte 2 380 sites hospitaliers (2023) et 75 % des patients sont hospitalisés à moins de 43 km de leur domicile, mais la spécialisation de la médecine — 44 spécialités contre 8 en 1947 — tend à concentrer l'offre, dans un contexte de déficit des hôpitaux publics de 2,4 Md€ (Cour des comptes, RPA 2026). Plusieurs services de proximité sont menacés dans les territoires.",
    question: "Quelle doctrine fixez-vous pour l'organisation de l'offre de soins ?",
    options: [
      {
        label: "Concentrer les plateaux techniques, reconvertir les petits sites",
        consequence:
          "Vous assumez la gradation complète : la qualité et la sécurité des soins y gagnent, mais plusieurs maternités et services de proximité ferment. Les territoires concernés se sentent relégués ; les finances hospitalières respirent.",
        effets: { bonheur: -6, confiance: 2, pouvoirAchat: -1, finances: 5, cohesion: -5 },
        suite: "sante-ght",
      },
      {
        label: "Maintenir tous les sites et les refinancer",
        consequence:
          "Aucun site ne ferme : soulagement dans les territoires. Mais l'effort budgétaire est lourd, et la qualité restera fragile là où l'activité est insuffisante pour la sécurité des patients.",
        effets: { bonheur: 5, confiance: 2, pouvoirAchat: 1, finances: -8, cohesion: 4 },
      },
      {
        label: "Financer la gradation des soins et les hôpitaux de proximité",
        consequence:
          "Vous suivez la voie de la Cour des comptes : les hôpitaux de proximité sont reconnus et financés comme tels, les filières coordonnées se structurent. Ni fermetures brutales, ni statu quo coûteux.",
        effets: { bonheur: 3, confiance: 4, pouvoirAchat: 0, finances: -4, cohesion: 3 },
      },
      {
        label: "Miser sur la télémédecine et les équipes mobiles",
        consequence:
          "Consultations à distance et équipes « aller-vers » se déploient. Les patients isolés gagnent un accès, mais la fracture numérique en exclut une partie des aînés, et le soin physique reste irremplaçable.",
        effets: { bonheur: 1, confiance: 2, pouvoirAchat: 1, finances: -2, cohesion: -1 },
      },
    ],
  },
  {
    id: "sante-ght",
    theme: "Santé",
    titre: "Les groupements hospitaliers de territoire",
    situation:
      "Les 135 groupements hospitaliers de territoire devaient coordonner les hôpitaux publics ; seuls 26 ont mis en place une direction commune (Cour des comptes, RPA 2026). Les coopérations restent fragiles et le temps médical se partage mal entre établissements.",
    question: "Faut-il fusionner les établissements de chaque groupement ?",
    options: [
      {
        label: "Fusionner chaque GHT en une personne morale unique",
        consequence:
          "Vous reprenez la recommandation de la Cour : une seule gouvernance par territoire, des médecins partagés, des achats mutualisés. Les équipes craignent la réorganisation ; l'efficience progresse.",
        effets: { bonheur: -2, confiance: 3, pouvoirAchat: 0, finances: 4, cohesion: -1 },
      },
      {
        label: "Inciter aux directions communes, sans fusion",
        consequence:
          "Vous encouragez sans contraindre. Les groupements volontaires avancent, les autres temporisent : le maillage s'améliore lentement, sans heurts ni gains décisifs.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 0, finances: 1, cohesion: 1 },
      },
      {
        label: "Statu quo avec moyens supplémentaires",
        consequence:
          "Vous abondez les budgets sans toucher à l'organisation. Les tensions du moment s'apaisent, mais les doublons et les fragilités structurelles demeurent.",
        effets: { bonheur: 2, confiance: -1, pouvoirAchat: 0, finances: -5, cohesion: 1 },
      },
      {
        label: "Associer les collectivités à la gouvernance",
        consequence:
          "Élus locaux et agences régionales de santé codécident des évolutions de l'offre. Les projets — reconversions comprises — sont mieux acceptés localement, au prix d'une gouvernance plus lourde.",
        effets: { bonheur: 2, confiance: 1, pouvoirAchat: 0, finances: -2, cohesion: 3 },
      },
    ],
  },
  {
    id: "sante-om",
    theme: "Santé",
    titre: "L'accès aux soins ultramarin",
    situation:
      "En outre-mer, l'attente médiane pour un cardiologue atteint 42 jours contre 26 en métropole (2024), la densité de généralistes varie de 8 à 90 pour 100 000 habitants contre 84 en moyenne nationale, et 34,6 % de la population vit sous le seuil de pauvreté contre 15,4 % en métropole (Cour des comptes, RPA 2026).",
    question: "Quel levier prioritaire pour la santé outre-mer ?",
    options: [
      {
        label: "Plan massif d'investissement hospitalier ultramarin",
        consequence:
          "Vous annoncez un plan pluriannuel : capacités, filières manquantes, équipements. L'effort est considérable et les délais longs, mais le signal est fort dans des territoires qui se sentent abandonnés.",
        effets: { bonheur: 4, confiance: 3, pouvoirAchat: 1, finances: -7, cohesion: 5 },
      },
      {
        label: "Postes partagés et missions médicales avec la métropole",
        consequence:
          "Des médecins métropolitains effectuent des missions régulières, des postes sont partagés entre établissements. Dispositif souple et rapide, recommandé par la Cour — mais il ne crée pas d'offre durable.",
        effets: { bonheur: 2, confiance: 2, pouvoirAchat: 0, finances: -3, cohesion: 3 },
      },
      {
        label: "Télémédecine et téléexpertise en priorité",
        consequence:
          "La téléexpertise désenclave les archipels et la brousse. Mais l'illectronisme et la fracture numérique ultramarine en limitent la portée réelle, faute d'accompagnement.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 0, finances: -2, cohesion: 1 },
      },
      {
        label: "Créer des filières locales de formation en santé",
        consequence:
          "Vous investissez dans des formations sur place pour fidéliser les soignants ultramarins. L'effet sera plein dans plusieurs années ; à court terme, les délais d'attente ne bougent pas.",
        effets: { bonheur: 2, confiance: 2, pouvoirAchat: 1, finances: -4, cohesion: 3 },
      },
    ],
  },
  {
    id: "sante-chroniques",
    theme: "Santé",
    titre: "Le défi des maladies chroniques",
    situation:
      "25 millions de patients vivent avec une maladie chronique en 2023, soit 7 % de plus qu'en 2015, pour une dépense d'environ 126 Md€ (Cour des comptes, RPA 2026). Le système, conçu pour l'aigu, s'organise mal pour le long cours.",
    question: "Quelle stratégie face aux maladies chroniques ?",
    options: [
      {
        label: "Grand plan national de prévention",
        consequence:
          "Alimentation, sport, dépistage : vous lancez un plan décennal. Les effets santé seront longs à venir, mais chaque euro de prévention en économise plusieurs en soins.",
        effets: { bonheur: 3, confiance: 3, pouvoirAchat: 1, finances: -5, cohesion: 1 },
      },
      {
        label: "Renforcer la médecine de ville et les forfaits longue durée",
        consequence:
          "Le médecin traitant devient le pivot du suivi, avec des forfaits adaptés. Les patients chroniques gagnent en continuité ; les déserts médicaux restent le maillon faible.",
        effets: { bonheur: 3, confiance: 2, pouvoirAchat: 1, finances: -4, cohesion: 1 },
      },
      {
        label: "Transférer une partie du risque vers les complémentaires",
        consequence:
          "Le reste à charge des ménages augmente mécaniquement. Les finances publiques sont soulagées, mais les plus modestes renoncent à des soins — un renoncement qui se paiera plus tard.",
        effets: { bonheur: -3, confiance: -2, pouvoirAchat: -4, finances: 4, cohesion: -4 },
      },
      {
        label: "Investir la recherche et le dossier médical partagé",
        consequence:
          "Vous misez sur la donnée et la recherche pour personnaliser les parcours. Effet différé, peu visible pour les patients d'aujourd'hui, mais structurant pour le système.",
        effets: { bonheur: 1, confiance: 2, pouvoirAchat: 0, finances: -3, cohesion: 0 },
      },
    ],
  },
  {
    id: "sante-deficit",
    theme: "Santé",
    titre: "Le déficit des hôpitaux publics",
    situation:
      "Le déficit des hôpitaux publics a atteint 2,4 Md€ en 2023 (Cour des comptes, RPA 2026). Les fermetures de services faute de personnels se multiplient, et chaque plan de redressement alimente la défiance des soignants.",
    question: "Comment traitez-vous le déficit hospitalier ?",
    options: [
      {
        label: "Combler le déficit par une dotation de l'État",
        consequence:
          "Vous épongez le déficit : les hôpitaux respirent, les services menacés sont sauvés provisoirement. Le contribuable paie, et rien n'oblige à changer le modèle.",
        effets: { bonheur: 3, confiance: 2, pouvoirAchat: 0, finances: -8, cohesion: 2 },
      },
      {
        label: "Imposer un plan d'efficience aux établissements",
        consequence:
          "Restructurations, mutualisations, revue des effectifs administratifs : les comptes s'améliorent, mais les soignants crient à la logique gestionnaire et la tension monte dans les services.",
        effets: { bonheur: -4, confiance: -1, pouvoirAchat: 0, finances: 5, cohesion: -3 },
      },
      {
        label: "Reprise partielle et redressement progressif négocié",
        consequence:
          "Vous combinez reprise d'une partie du déficit et plan de retour à l'équilibre négocié. Ni miracle ni casse : une trajectoire crédible, à condition de tenir dans la durée.",
        effets: { bonheur: 0, confiance: 2, pouvoirAchat: 0, finances: -3, cohesion: 0 },
      },
      {
        label: "Réformer le financement : moins de tarification à l'activité",
        consequence:
          "Vous déplacez le financement vers des forfaits de population. Les hôpitaux sortent de la course au volume ; la transition est technique et ses effets mettront des années à se mesurer.",
        effets: { bonheur: 1, confiance: 2, pouvoirAchat: 0, finances: 3, cohesion: 0 },
      },
    ],
  },
  {
    id: "edu-carte",
    theme: "Éducation",
    titre: "La carte des collèges",
    situation:
      "À l'horizon 2036, le nombre de collégiens diminuera de 12 % en moyenne en métropole, et 20 départements pourraient perdre plus de 20 % d'élèves entre 2024 et 2036 (Cour des comptes, RPA 2026). Le maillage des 6 700 collèges n'est plus adapté.",
    question: "Quelle réforme de la carte scolaire ?",
    options: [
      {
        label: "Regroupements concertés écoles-collèges-lycées",
        consequence:
          "Vous lancez la révision du maillage recommandée par la Cour, en concertation. Des fermetures seront nécessaires : les territoires s'inquiètent, mais l'offre pédagogique survivra là où elle se serait éteinte seule.",
        effets: { bonheur: -3, confiance: 3, pouvoirAchat: 0, finances: 4, cohesion: -2 },
        suite: "edu-rural",
      },
      {
        label: "Geler toute fermeture de collège",
        consequence:
          "Aucun collège ne ferme sous votre mandat : satisfaction immédiate des territoires. Mais les très petites classes coûtent cher et l'offre d'options s'y réduit d'elle-même.",
        effets: { bonheur: 3, confiance: -1, pouvoirAchat: 0, finances: -5, cohesion: 2 },
      },
      {
        label: "Nouveau maillage à cinq ans avec fonds d'accompagnement",
        consequence:
          "Vous prenez le temps de la concertation et financez la transition : transport, internats, regroupements doux. Réforme lente mais acceptée, au coût budgétaire contenu.",
        effets: { bonheur: 0, confiance: 2, pouvoirAchat: 0, finances: -2, cohesion: 1 },
      },
      {
        label: "Laisser chaque département décider seul",
        consequence:
          "Vous renvoyez l'arbitrage aux collectivités, gestionnaires des collèges. Les situations se traitent au cas par cas, sans stratégie nationale — et les inégalités entre départements se creusent.",
        effets: { bonheur: -1, confiance: -1, pouvoirAchat: 0, finances: 2, cohesion: -1 },
      },
    ],
  },
  {
    id: "edu-mixite",
    theme: "Éducation",
    titre: "La mixité sociale à l'école",
    situation:
      "1 550 collèges sur 6 700 sont très peu mixtes socialement : 800 à public défavorisé (75 % en éducation prioritaire) et 750 à public favorisé (75 % dans le privé sous contrat). Dans ces derniers, un collégien a une chance sur 12 de croiser un élève défavorisé, contre un sur trois au niveau national (Cour des comptes, RPA 2026).",
    question: "Comment rétablir la mixité sociale ?",
    options: [
      {
        label: "Généraliser les secteurs multi-collèges",
        consequence:
          "Vous redessinez les affectations pour mélanger les publics, comme l'ont fait la Haute-Garonne et la Loire-Atlantique. Les familles favorisées craignent une fuite vers le privé ; la cohésion scolaire progresse.",
        effets: { bonheur: -2, confiance: 2, pouvoirAchat: 0, finances: -2, cohesion: 5 },
      },
      {
        label: "Associer le privé sous contrat aux objectifs de mixité",
        consequence:
          "Vous conditionnez progressivement les contrats d'association à des objectifs de mixité, comme le suggère la Cour. Le secteur privé proteste ; la ségrégation recule là où elle se fabrique.",
        effets: { bonheur: -1, confiance: 2, pouvoirAchat: 0, finances: -1, cohesion: 4 },
      },
      {
        label: "Internats d'excellence et navettes pour les quartiers",
        consequence:
          "Vous misez sur la mobilité des élèves plutôt que sur la carte scolaire : internats, navettes, bourses. Dispositif coûteux mais consensuel, qui ne touche qu'une partie des élèves.",
        effets: { bonheur: 2, confiance: 1, pouvoirAchat: -1, finances: -5, cohesion: 3 },
      },
      {
        label: "Renforcer l'éducation prioritaire sans toucher à la carte",
        consequence:
          "Vous abondez les collèges défavorisés sans modifier l'affectation. Les conditions d'apprentissage s'améliorent sur place ; la ségrégation résidentielle et scolaire, elle, demeure.",
        effets: { bonheur: 2, confiance: 1, pouvoirAchat: 0, finances: -4, cohesion: 2 },
      },
    ],
  },
  {
    id: "edu-rural",
    theme: "Éducation",
    titre: "Les collèges ruraux",
    situation:
      "22 % des collégiens sont scolarisés en milieu rural, où les établissements sont plus petits, l'offre pédagogique plus restreinte, les trajets plus longs et l'attractivité pour les enseignants plus faible (Cour des comptes, RPA 2026). Les résultats y sont pourtant légèrement supérieurs, grâce à des classes plus petites.",
    question: "Comment soutenir le collège rural ?",
    options: [
      {
        label: "Prime de ruralité et internats modernisés",
        consequence:
          "Vous attirez les enseignants par des primes et rénovez les internats. Les territoires saluent le geste ; la dépense est récurrente et l'effet sur les vocations incertain.",
        effets: { bonheur: 3, confiance: 2, pouvoirAchat: 0, finances: -4, cohesion: 3 },
      },
      {
        label: "Regrouper en cités scolaires avec transport renforcé",
        consequence:
          "Vous rationalisez : moins de sites, plus de services sur place. Les trajets s'allongent pour certains élèves et la polémique sur la « mort des villages » ressurgit.",
        effets: { bonheur: -2, confiance: 1, pouvoirAchat: -1, finances: 2, cohesion: -1 },
      },
      {
        label: "Assouplir le cadre : enseignants multi-niveaux, locaux partagés",
        consequence:
          "Vous reprenez la piste de la Cour : rapprochement école-collège, bâtiments ouverts à d'autres activités, gestion assouplie. Peu coûteux, localement efficace, mais exigeant pour les personnels.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 0, finances: 1, cohesion: 1 },
      },
      {
        label: "Mutualiser par le numérique : classes virtuelles",
        consequence:
          "Langues rares et options partagées entre collèges par visioconférence : l'offre pédagogique s'élargit sans fermer aucun site. Le lien humain de la classe en pâtirait si l'usage s'étendait.",
        effets: { bonheur: 0, confiance: 1, pouvoirAchat: 0, finances: -2, cohesion: 0 },
      },
    ],
  },
  {
    id: "edu-cyber",
    theme: "Éducation",
    titre: "La cyberviolence scolaire",
    situation:
      "28 % des collégiens et 23 % des lycéens ont déjà été victimes de violence en ligne ; 3,2 % des adultes sont concernés (INSEE, Rapport annuel 2025). Le harcèlement numérique détruit des parcours, et parfois des vies.",
    question: "Quelle réponse à la cyberviolence ?",
    options: [
      {
        label: "Programme national de prévention et cellules d'écoute",
        consequence:
          "Chaque académie dispose d'une cellule, chaque établissement d'un référent formé. Les victimes ont enfin un interlocuteur ; la dépense est modeste au regard de l'enjeu.",
        effets: { bonheur: 4, confiance: 2, pouvoirAchat: 0, finances: -3, cohesion: 3 },
      },
      {
        label: "Obliger les plateformes au retrait rapide sous sanction",
        consequence:
          "Vous durcissez les obligations des réseaux sociaux : retrait sous 24 heures, amendes dissuasives. Les plateformes rechignent et invoquent le droit européen ; les familles applaudissent.",
        effets: { bonheur: 3, confiance: 2, pouvoirAchat: 0, finances: 0, cohesion: 2 },
      },
      {
        label: "Éducation au numérique dans les programmes",
        consequence:
          "Empathie, esprit critique, hygiène numérique : vous inscrivez la prévention dans les programmes. Effet lent mais durable — une génération à armer plutôt qu'un flux à modérer.",
        effets: { bonheur: 2, confiance: 2, pouvoirAchat: 0, finances: -2, cohesion: 2 },
      },
      {
        label: "Contrôle parental activé par défaut à la vente",
        consequence:
          "Vous imposez l'activation par défaut du contrôle parental sur les équipements. Mesure visible et peu coûteuse, mais contournable et perçue comme intrusive par une partie des familles.",
        effets: { bonheur: -1, confiance: 0, pouvoirAchat: 0, finances: 0, cohesion: 1 },
      },
    ],
  },
  {
    id: "logement-attribution",
    theme: "Logement",
    titre: "L'attribution des logements sociaux",
    situation:
      "2,8 millions de demandes de logement social étaient enregistrées fin 2024, alors que 72 % des ménages y sont théoriquement éligibles et que le parc ne couvre que 16 % des résidences principales (Cour des comptes, RPA 2026). La cotation des demandes, pourtant obligatoire, est rarement appliquée.",
    question: "Comment rendre l'attribution plus juste ?",
    options: [
      {
        label: "Cotation nationale obligatoire et publiée",
        consequence:
          "Chaque demande reçoit une note objective, consultable par le demandeur — la recommandation de la Cour. L'opacité recule, la confiance progresse ; les bailleurs perdent une part d'arbitraire.",
        effets: { bonheur: 2, confiance: 4, pouvoirAchat: 0, finances: -1, cohesion: 2 },
      },
      {
        label: "Hiérarchiser les priorités par la loi, DALO d'abord",
        consequence:
          "Vous tranchez l'empilement des critères prioritaires, auxquels 70 % des demandeurs répondent. Les plus urgents passent devant ; les autres attendront plus longtemps, et le diront.",
        effets: { bonheur: 1, confiance: 2, pouvoirAchat: 0, finances: 0, cohesion: 1 },
      },
      {
        label: "Faire valider le logement par le demandeur avant attribution",
        consequence:
          "Vous reprenez une recommandation de la Cour : on vérifie l'intérêt du demandeur avant d'attribuer. Les refus après proposition chutent, la rotation s'accélère, les files avancent.",
        effets: { bonheur: 3, confiance: 2, pouvoirAchat: 0, finances: -1, cohesion: 1 },
      },
      {
        label: "Rendre publics les comptes rendus des commissions",
        consequence:
          "Chaque commission d'attribution documente l'application de la cotation. Transparence totale, coût quasi nul ; les contestations se professionnalisent aussi.",
        effets: { bonheur: 1, confiance: 3, pouvoirAchat: 0, finances: 0, cohesion: 1 },
        suite: "logement-construction",
      },
    ],
  },
  {
    id: "logement-construction",
    theme: "Logement",
    titre: "Faut-il relancer la construction sociale ?",
    situation:
      "La rotation du parc social ne permet plus de proposer que moins de 400 000 logements par an — 383 857 attributions en 2024 — face à 2,8 millions de demandes (Cour des comptes, RPA 2026). Une relance massive de la construction se heurte à l'état des finances publiques.",
    question: "Quelle politique d'offre de logement social ?",
    options: [
      {
        label: "Relance massive de la construction",
        consequence:
          "Vous lancez un programme pluriannuel de construction. Le bâtiment repart, les files fondront lentement ; la dépense est lourde et les logements ne sortiront pas de terre avant deux ans.",
        effets: { bonheur: 4, confiance: 3, pouvoirAchat: 2, finances: -9, cohesion: 3 },
      },
      {
        label: "Incitations fiscales ciblées sur les zones tendues",
        consequence:
          "Vous stimulez l'initiative privée et les bailleurs là où la tension est maximale. Moins coûteux qu'un grand plan, mais dépendant de l'appétit des investisseurs.",
        effets: { bonheur: 2, confiance: 1, pouvoirAchat: 1, finances: -4, cohesion: 1 },
      },
      {
        label: "Mobiliser le parc existant : rotation et sous-occupation",
        consequence:
          "Avant de construire, vous optimisez : rotation accélérée, adaptation des logements à la taille des ménages. Peu coûteux, rapide, mais insuffisant face à l'ampleur de la demande.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 0, finances: -1, cohesion: 0 },
        suite: "logement-sousoccupation",
      },
      {
        label: "Conventionner des logements privés",
        consequence:
          "Des logements privés entrent dans le parc conventionné contre avantages fiscaux et garanties. Rapide et souple ; le parc reste privé, avec des loyers un peu plus chers.",
        effets: { bonheur: 2, confiance: 1, pouvoirAchat: 1, finances: -3, cohesion: 1 },
      },
    ],
  },
  {
    id: "logement-sousoccupation",
    theme: "Logement",
    titre: "Les logements sous-occupés",
    situation:
      "15 % des résidences principales sont sous-occupées en France (INSEE, Rapport annuel 2025) — souvent des seniors dans de grandes maisons, pendant que des familles cherchent en vain un logement adapté.",
    question: "Comment mobiliser les logements sous-occupés ?",
    options: [
      {
        label: "Aider les seniors à déménager vers du logement adapté",
        consequence:
          "Aide au déménagement, diagnostic, offre adaptée : vous facilitez la mobilité des seniors volontaires. Des logements familiaux se libèrent, sans contrainte pour personne.",
        effets: { bonheur: 3, confiance: 1, pouvoirAchat: 1, finances: -3, cohesion: 1 },
      },
      {
        label: "Taxer la sous-occupation",
        consequence:
          "Vous créez une incitation fiscale à libérer les grandes surfaces. Efficace sur le papier, explosive socialement : on ne demande pas aux aînés de quitter leur maison sans révolte.",
        effets: { bonheur: -5, confiance: -1, pouvoirAchat: -2, finances: 4, cohesion: -4 },
      },
      {
        label: "Faciliter colocation et division des grandes maisons",
        consequence:
          "Vous assouplissez les règles de division et de colocation. Des mètres carrés reviennent sur le marché, à la marge, sans heurter personne.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 1, finances: -1, cohesion: 1 },
      },
      {
        label: "Campagne d'information seule",
        consequence:
          "Vous informez sans inciter ni contraindre. Peu de mouvement réel ; l'opinion note que le sujet est au moins posé.",
        effets: { bonheur: 0, confiance: -1, pouvoirAchat: 0, finances: 0, cohesion: 0 },
      },
    ],
  },
  {
    id: "logement-renovation",
    theme: "Logement",
    titre: "La précarité énergétique",
    situation:
      "5 millions de ménages sont en situation de vulnérabilité énergétique, consacrant une part excessive de leurs revenus à se chauffer (INSEE, Rapport annuel 2025). Les passoires thermiques pèsent sur le pouvoir d'achat et la santé.",
    question: "Quelle stratégie de rénovation énergétique ?",
    options: [
      {
        label: "Majorer MaPrimRénov' pour les ménages modestes",
        consequence:
          "Vous concentrez l'aide sur les précaires : reste à charge quasi nul. Les dossiers affluent, les artisans saturent ; la dépense grimpe, mais l'effet sur le pouvoir d'achat est direct.",
        effets: { bonheur: 4, confiance: 2, pouvoirAchat: 3, finances: -6, cohesion: 2 },
      },
      {
        label: "Rénovations globales par quartiers entiers",
        consequence:
          "Vous industrialisez : quartiers entiers rénovés en une fois, coûts mutualisés. Efficace et visible, mais lourd à organiser et long à démarrer.",
        effets: { bonheur: 3, confiance: 2, pouvoirAchat: 2, finances: -7, cohesion: 2 },
      },
      {
        label: "Cibler les passoires locatives : incitation puis interdiction",
        consequence:
          "Les bailleurs de passoires thermiques sont incités puis contraints de rénover. Le parc locatif s'assainit ; certains propriétaires retirent leur bien, tendant un peu plus le marché.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 2, finances: -2, cohesion: 0 },
      },
      {
        label: "Tarification progressive de l'énergie",
        consequence:
          "Les premiers kilowattheures deviennent bon marché, les gros consommateurs paient plus. Pouvoir d'achat préservé pour les modestes ; mise en œuvre technique complexe et contestable.",
        effets: { bonheur: -2, confiance: 0, pouvoirAchat: 2, finances: 2, cohesion: -1 },
      },
    ],
  },
  {
    id: "num-illectronisme",
    theme: "Numérique",
    titre: "La fracture numérique",
    situation:
      "44 % des Français éprouvent des difficultés dans leurs démarches en ligne, 32 % y ont déjà renoncé au moins une fois et 8 % définitivement (Insee Focus, cité par la Cour des comptes, RPA 2026). La dématérialisation exclut ceux qu'elle devait servir.",
    question: "Comment garantir l'accès de tous aux services publics ?",
    options: [
      {
        label: "Renforcer France services : détection et orientation",
        consequence:
          "Vous reprenez la recommandation de la Cour : les conseillers France services repèrent les difficultés et orientent vers les lieux d'inclusion. Le maillage existe déjà — vous le consolidez.",
        effets: { bonheur: 3, confiance: 3, pouvoirAchat: 0, finances: -3, cohesion: 3 },
      },
      {
        label: "Garantir par la loi un accueil physique et téléphonique",
        consequence:
          "Chaque administration devra offrir une alternative humaine effective. Mesure très populaire chez les exclus du numérique ; coûteuse en personnels et en organisation.",
        effets: { bonheur: 4, confiance: 3, pouvoirAchat: 0, finances: -4, cohesion: 3 },
      },
      {
        label: "Former un million de Français par an au numérique",
        consequence:
          "Vous lancez un grand plan de formation. L'autonomie progresse lentement ; les plus fragiles, premiers concernés, sont les plus difficiles à atteindre.",
        effets: { bonheur: 2, confiance: 2, pouvoirAchat: 0, finances: -4, cohesion: 2 },
      },
      {
        label: "Simplifier d'abord les démarches et le langage administratif",
        consequence:
          "Vous attaquez la racine : formulaires en français clair, parcours repensés. Peu coûteux, profitable à tous — mais insuffisant pour les non-utilisateurs.",
        effets: { bonheur: 2, confiance: 2, pouvoirAchat: 0, finances: -1, cohesion: 1 },
      },
    ],
  },
  {
    id: "num-fibre",
    theme: "Numérique",
    titre: "Achever la couverture des réseaux",
    situation:
      "93,5 % des locaux sont raccordables à la fibre (septembre 2025) après 22 Md€ investis depuis 2010, mais jusqu'à 215 800 personnes restent en zone blanche et seuls 18 départements ont un schéma de résilience numérique (Cour des comptes, RPA 2026).",
    question: "Quelle priorité pour les réseaux ?",
    options: [
      {
        label: "Financer l'achèvement : plus aucune zone blanche",
        consequence:
          "Vous financez le dernier kilomètre. Les territoires isolés sortent de l'exclusion numérique ; le coût par habitant raccordé est élevé, mais le symbole compte.",
        effets: { bonheur: 2, confiance: 2, pouvoirAchat: 0, finances: -4, cohesion: 3 },
      },
      {
        label: "Imposer des obligations de résilience aux opérateurs",
        consequence:
          "Alimentation de secours, redondances : vous durcissez les obligations, comme le suggère la Cour. Les coupures en crise se raréfieront ; les opérateurs répercuteront une partie du coût.",
        effets: { bonheur: 1, confiance: 2, pouvoirAchat: 0, finances: -1, cohesion: 2 },
      },
      {
        label: "Généraliser les schémas de résilience départementaux",
        consequence:
          "Vous accompagnez chaque département dans sa cartographie des vulnérabilités. Démarche prudente et peu coûteuse, qui prépare les crises sans les empêcher.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 0, finances: -2, cohesion: 2 },
      },
      {
        label: "Satellite souverain pour l'outre-mer et les zones isolées",
        consequence:
          "Vous investissez dans une capacité satellitaire souveraine. Stratégique pour l'outre-mer, coûteux et long ; la fibre reste irremplaçable ailleurs.",
        effets: { bonheur: 1, confiance: 2, pouvoirAchat: 0, finances: -5, cohesion: 2 },
      },
    ],
  },
  {
    id: "num-cuivre",
    theme: "Numérique",
    titre: "La fin du réseau cuivre",
    situation:
      "L'extinction du réseau cuivre d'ici 2030 et celle des technologies 2G et 3G restent mal anticipées, alors qu'ascenseurs, télésurveillance et alarmes en dépendent encore (Cour des comptes, RPA 2026).",
    question: "Comment gérer l'extinction du cuivre et de la 2G/3G ?",
    options: [
      {
        label: "Plan national d'accompagnement et information massive",
        consequence:
          "Vous anticipez : recensement des équipements, accompagnement des copropriétés et des personnes âgées. Une transition ordonnée plutôt qu'une panne annoncée.",
        effets: { bonheur: 2, confiance: 2, pouvoirAchat: -1, finances: -3, cohesion: 1 },
      },
      {
        label: "Reporter l'extinction au-delà de 2030",
        consequence:
          "Vous gagnez du temps et apaisez les inquiétudes. Mais le double réseau coûte cher aux opérateurs, et le problème n'est que repoussé.",
        effets: { bonheur: 1, confiance: -2, pouvoirAchat: 0, finances: 1, cohesion: 0 },
      },
      {
        label: "Laisser les opérateurs gérer, l'État surveille",
        consequence:
          "Vous vous en remettez au marché. Les équipements obsolètes lâcheront au cas par cas ; les usagers le découvriront en panne, et s'en souviendront.",
        effets: { bonheur: -1, confiance: -1, pouvoirAchat: -1, finances: 1, cohesion: -1 },
      },
      {
        label: "Fonds d'aide au remplacement des équipements",
        consequence:
          "Ascenseurs, alarmes, télésurveillance : vous subventionnez le remplacement. Lisible et juste, mais coûteux et difficile à calibrer sans effet d'aubaine.",
        effets: { bonheur: 2, confiance: 1, pouvoirAchat: 1, finances: -3, cohesion: 1 },
      },
    ],
  },
  {
    id: "mobilite-rurale",
    theme: "Mobilités",
    titre: "Se déplacer en zone rurale",
    situation:
      "Plus de 70 % des habitants des zones rurales et périurbaines n'ont pas le choix de leur mode de transport, et 30 % des jeunes ruraux ont déjà renoncé à se rendre sur leur lieu d'étude (Cour des comptes, RPA 2026). La voiture y reste une obligation, pas un choix.",
    question: "Quelle offre de mobilité pour les territoires peu denses ?",
    options: [
      {
        label: "Transport à la demande et covoiturage subventionnés",
        consequence:
          "Vous généralisez les solutions souples — le covoiturage intermédié a déjà été multiplié par huit entre 2021 et 2024, à 12,8 millions de trajets. Rapide à déployer, adapté au rural, coût modéré.",
        effets: { bonheur: 4, confiance: 2, pouvoirAchat: 2, finances: -4, cohesion: 3 },
      },
      {
        label: "Reconstruire des lignes TER rurales",
        consequence:
          "Vous rouvrez des lignes et renforcez les cars régionaux. Offre structurante mais très capitalistique : les travaux dureront au-delà de votre mandat.",
        effets: { bonheur: 4, confiance: 3, pouvoirAchat: 1, finances: -8, cohesion: 3 },
        suite: "mobilite-financement",
      },
      {
        label: "Forfait mobilité pour les jeunes : permis, vélo, car",
        consequence:
          "Vous ciblez les 18-25 ans : aide au permis, vélo, abonnements. L'accès aux études et aux stages s'améliore vite ; le reste de la population attendra.",
        effets: { bonheur: 3, confiance: 2, pouvoirAchat: 2, finances: -3, cohesion: 2 },
      },
      {
        label: "Libérer le covoiturage domicile-travail local",
        consequence:
          "Vous simplifiez et promouvez les plateformes locales de covoiturage. Peu coûteux, croissance réelle mais limitée aux trajets réguliers.",
        effets: { bonheur: 2, confiance: 1, pouvoirAchat: 1, finances: -1, cohesion: 1 },
      },
    ],
  },
  {
    id: "mobilite-financement",
    theme: "Mobilités",
    titre: "Financer les transports du quotidien",
    situation:
      "Les collectivités portent les deux tiers du financement des transports — 35,6 Md€ de dépenses courantes et 21 Md€ d'investissement en 2023 — alors que les besoins augmenteront de 3,7 à 6,7 Md€ par an (Cour des comptes, RPA 2026).",
    question: "Comment financer les mobilités du quotidien ?",
    options: [
      {
        label: "Loi-cadre : priorité au quotidien et à la régénération",
        consequence:
          "Vous reprenez la recommandation de la Cour : doctrine d'emploi des dépenses, priorité aux trajets du quotidien et à l'existant. Moins de rubans inaugurés, plus de trains qui arrivent à l'heure.",
        effets: { bonheur: 2, confiance: 3, pouvoirAchat: 0, finances: -2, cohesion: 2 },
      },
      {
        label: "Étendre le versement mobilité aux zones rurales",
        consequence:
          "Les entreprises des zones concernées contribuent au financement. Recette nouvelle et ciblée, mais acceptabilité fragile chez les employeurs ruraux.",
        effets: { bonheur: -1, confiance: 1, pouvoirAchat: 0, finances: 3, cohesion: 0 },
      },
      {
        label: "Grand emprunt national mobilités",
        consequence:
          "Vous empruntez pour accélérer partout à la fois. Les chantiers se multiplient ; la dette aussi, et les marchés surveillent déjà la signature française.",
        effets: { bonheur: 3, confiance: 1, pouvoirAchat: 1, finances: -7, cohesion: 2 },
      },
      {
        label: "Recentrer sur l'existant, aucun projet neuf",
        consequence:
          "Vous gelez les projets neufs pour régénérer les réseaux. Gestion saine mais sans récit : les territoires enclavés n'y voient aucune perspective.",
        effets: { bonheur: 0, confiance: 1, pouvoirAchat: 0, finances: 3, cohesion: 0 },
      },
    ],
  },
  {
    id: "mobilite-bornes",
    theme: "Mobilités",
    titre: "Les bornes de recharge électrique",
    situation:
      "Le territoire comptait 184 141 bornes de recharge publiques pour véhicules électriques fin novembre 2025 (Cour des comptes, RPA 2026). Le maillage progresse, mais reste inégal entre métropoles et zones rurales.",
    question: "Quelle politique pour la recharge électrique ?",
    options: [
      {
        label: "Doubler le parc de bornes en trois ans",
        consequence:
          "Vous accélérez fortement : l'électrique devient praticable partout. Coût public significatif et rentabilité des bornes rurales incertaine.",
        effets: { bonheur: 2, confiance: 2, pouvoirAchat: 0, finances: -5, cohesion: 0 },
      },
      {
        label: "Cibler zones rurales et copropriétés",
        consequence:
          "Vous corrigez d'abord les angles morts : ruralités et logements collectifs. Moins spectaculaire, plus juste territorialement.",
        effets: { bonheur: 2, confiance: 1, pouvoirAchat: 1, finances: -3, cohesion: 1 },
      },
      {
        label: "Réguler les tarifs pour rentabiliser le réseau",
        consequence:
          "Vous encadrez les prix de recharge pour assurer la viabilité des opérateurs. Les usagers gagnent en lisibilité ; les marges des opérateurs se tassent.",
        effets: { bonheur: -1, confiance: 0, pouvoirAchat: -1, finances: 2, cohesion: 0 },
      },
      {
        label: "Laisser le marché déployer seul",
        consequence:
          "Vous ne subventionnez plus : le marché équipe les zones rentables. Les territoires peu denses resteront durablement en retard.",
        effets: { bonheur: -1, confiance: -1, pouvoirAchat: 0, finances: 1, cohesion: -1 },
      },
    ],
  },
  {
    id: "industrie-foncier",
    theme: "Industrie",
    titre: "Le foncier industriel",
    situation:
      "La réindustrialisation exige 22 000 hectares de foncier supplémentaires d'ici 2030, alors que l'industrie n'occupe que 4,5 % des surfaces artificialisées (Cour des comptes, RPA 2026). Les projets échouent souvent faute de terrains prêts.",
    question: "Comment libérer du foncier pour l'industrie ?",
    options: [
      {
        label: "Sites « clés en main » réservés aux terrains réellement prêts",
        consequence:
          "Vous reprenez la recommandation de la Cour : le label n'ira qu'aux terrains viabilisés et autorisés. Les projets s'installent enfin vite ; les collectivités doivent pré-financer.",
        effets: { bonheur: 1, confiance: 3, pouvoirAchat: 0, finances: -3, cohesion: 0 },
        suite: "industrie-delais",
      },
      {
        label: "Renforcer la préemption publique des terrains",
        consequence:
          "L'État et les collectivités pourront préempter plus largement. Efficace pour constituer des réserves foncières, mais les propriétaires crient à l'expropriation rampante.",
        effets: { bonheur: -2, confiance: 0, pouvoirAchat: 0, finances: -4, cohesion: -2 },
      },
      {
        label: "Recycler d'abord les friches industrielles",
        consequence:
          "Vous financez la dépollution et la remise en service des friches. Sobriété foncière et réindustrialisation avancent ensemble ; les coûts de dépollution sont aléatoires.",
        effets: { bonheur: 2, confiance: 2, pouvoirAchat: 0, finances: -4, cohesion: 2 },
      },
      {
        label: "Appliquer strictement la sobriété foncière",
        consequence:
          "Vous refusez toute artificialisation nouvelle : cohérent avec le zéro artificialisation nette, mais des projets industriels iront voir ailleurs en Europe.",
        effets: { bonheur: 0, confiance: 0, pouvoirAchat: 0, finances: 1, cohesion: 1 },
        suite: "environnement-foncier",
      },
    ],
  },
  {
    id: "industrie-delais",
    theme: "Industrie",
    titre: "Dix-sept mois d'autorisations",
    situation:
      "Un industriel attend en moyenne 17 mois pour obtenir l'ensemble des autorisations d'un projet complexe — au-delà des délais légaux (Cour des comptes, RPA 2026). Pendant ce temps, les projets se décident ailleurs.",
    question: "Comment accélérer l'implantation industrielle ?",
    options: [
      {
        label: "Guichet unique préfectoral et délais opposables",
        consequence:
          "Un interlocuteur unique coordonne l'instruction ; passé le délai, le projet est réputé accepté. Les délais se contractent ; les préfets deviennent les chefs d'orchestre de la réindustrialisation.",
        effets: { bonheur: 1, confiance: 3, pouvoirAchat: 0, finances: -1, cohesion: 0 },
      },
      {
        label: "Encadrer les recours contentieux",
        consequence:
          "Vous raccourcissez les fenêtres de recours et filtrez les recours abusifs. Les projets avancent plus vite ; les associations environnementales dénoncent une remise en cause du droit.",
        effets: { bonheur: -2, confiance: 0, pouvoirAchat: 0, finances: 1, cohesion: -2 },
      },
      {
        label: "Mutualiser l'ingénierie publique pour les territoires",
        consequence:
          "Vous reprenez la piste de la Cour : des opérateurs mutualisés aident les petites collectivités à monter leurs projets. Les territoires sans ingénierie redeviennent candidats.",
        effets: { bonheur: 1, confiance: 2, pouvoirAchat: 0, finances: -2, cohesion: 1 },
      },
      {
        label: "Priorité administrative aux projets France 2030",
        consequence:
          "Vous accélérez pour les projets stratégiques seulement. Effet réel mais limité ; les autres projets patientent plus longtemps encore.",
        effets: { bonheur: 0, confiance: 0, pouvoirAchat: 0, finances: 0, cohesion: 0 },
      },
    ],
  },
  {
    id: "industrie-aides",
    theme: "Industrie",
    titre: "Les aides publiques à l'industrie",
    situation:
      "Les soutiens publics à l'industrie ont atteint 26,8 Md€ par an en 2020-2022, dont 1 % seulement d'aides directes versées par les collectivités (Cour des comptes, RPA 2026). Leur coordination reste perfectible et leur efficacité mal mesurée.",
    question: "Quelle doctrine pour les aides à l'industrie ?",
    options: [
      {
        label: "Conditionner les aides à l'emploi local et à la formation",
        consequence:
          "Chaque euro public exigera des créations d'emplois et des embauches locales documentées. Les entreprises rechignent ; l'efficacité des aides devient enfin mesurable.",
        effets: { bonheur: 2, confiance: 3, pouvoirAchat: 1, finances: 1, cohesion: 2 },
      },
      {
        label: "Recentrer sur les PME et ETI plutôt que les grands groupes",
        consequence:
          "Vous réorientez une partie des aides vers le tissu des PME industrielles, plus nombreuses en zone rurale. Les grands groupes protestent ; les territoires approuvent.",
        effets: { bonheur: 2, confiance: 2, pouvoirAchat: 1, finances: 0, cohesion: 1 },
      },
      {
        label: "Maintenir l'effort tel quel",
        consequence:
          "Vous ne touchez à rien : la dépense continue sans doctrine nouvelle. Ni gain d'efficacité, ni économie.",
        effets: { bonheur: 0, confiance: -1, pouvoirAchat: 0, finances: -4, cohesion: 0 },
      },
      {
        label: "Réduire les aides de 20 % pour désendetter",
        consequence:
          "Vous taillez dans les soutiens pour redresser les comptes. Les projets industriels en préparation ralentissent ; les territoires qui attendaient une usine l'apprennent.",
        effets: { bonheur: -2, confiance: 0, pouvoirAchat: 0, finances: 5, cohesion: -1 },
      },
    ],
  },
  {
    id: "industrie-pme",
    theme: "Industrie",
    titre: "La fiscalité inégale des entreprises",
    situation:
      "Entre 2016 et 2022, le taux d'imposition implicite des profits est resté plus élevé pour les PME et a moins diminué que pour les grandes entreprises (INSEE, Rapport annuel 2025). Les petites usines paient proportionnellement plus que les grands groupes.",
    question: "Comment corriger cette asymétrie fiscale ?",
    options: [
      {
        label: "Baisser l'imposition effective des PME",
        consequence:
          "Vous alignez le taux des PME sur celui des grandes entreprises. Soulagement pour des centaines de milliers d'entreprises ; le manque à gagner est réel.",
        effets: { bonheur: 2, confiance: 2, pouvoirAchat: 1, finances: -5, cohesion: 1 },
      },
      {
        label: "Contribution minimale pour les grands groupes",
        consequence:
          "Vous imposez un plancher d'imposition effective aux grandes entreprises. Recette nouvelle et sentiment de justice fiscale ; les sièges sociaux regardent ailleurs en Europe.",
        effets: { bonheur: 3, confiance: 1, pouvoirAchat: 0, finances: 4, cohesion: 1 },
      },
      {
        label: "Étudier d'abord l'impact précis de chaque piste",
        consequence:
          "Vous commandez l'évaluation avant de légiférer. Prudence de bon aloi ; l'attente est mal comprise par les PME qui paient aujourd'hui.",
        effets: { bonheur: -1, confiance: 0, pouvoirAchat: 0, finances: 0, cohesion: 0 },
      },
      {
        label: "Simplifier d'abord les obligations administratives",
        consequence:
          "Vous attaquez le coût de conformité plutôt que le taux : déclarations unifiées, seuils revus. Les PME respirent sans coûter un euro d'impôt.",
        effets: { bonheur: 1, confiance: 2, pouvoirAchat: 0, finances: -1, cohesion: 0 },
      },
    ],
  },
  {
    id: "emploi-territoires",
    theme: "Emploi",
    titre: "Les disparités territoriales de chômage",
    situation:
      "Le taux de chômage national est de 7,5 % au deuxième trimestre 2025, mais six départements dépassent 11,9 % tandis que 25 sont sous 6,4 % ; le taux d'emploi des 15-64 ans (69 %) reste sous la moyenne européenne de 70,8 % (Cour des comptes, RPA 2026).",
    question: "Comment traiter les disparités territoriales d'emploi ?",
    options: [
      {
        label: "Territorialiser les moyens de France Travail",
        consequence:
          "Vous modulez les moyens selon les bassins d'emploi, comme y invite la Cour. Les territoires sinistrés reçoivent enfin plus que les autres ; l'égalité de traitement en prend un coup.",
        effets: { bonheur: 2, confiance: 3, pouvoirAchat: 1, finances: -2, cohesion: 2 },
        suite: "emploi-comites",
      },
      {
        label: "Étendre « Territoire zéro chômeur de longue durée »",
        consequence:
          "Vous généralisez l'expérimentation : les chômeurs de longue durée sont employés sur des besoins locaux non satisfaits. Transformant là où il s'applique, coûteux à grande échelle.",
        effets: { bonheur: 3, confiance: 2, pouvoirAchat: 1, finances: -4, cohesion: 3 },
      },
      {
        label: "Garder l'égalité nationale de traitement",
        consequence:
          "Vous conservez une politique uniforme. Lisible et égalitaire en apparence ; les écarts territoriaux, eux, ne se résorbent pas.",
        effets: { bonheur: -1, confiance: -1, pouvoirAchat: 0, finances: 1, cohesion: -1 },
      },
      {
        label: "Incitations fiscales à l'embauche dans les bassins sinistrés",
        consequence:
          "Vous allégez les charges des entreprises qui embauchent dans les zones ciblées. Effet rapide sur les embauches ; risque d'effet d'aubaine documenté.",
        effets: { bonheur: 1, confiance: 1, pouvoirAchat: 1, finances: -4, cohesion: 1 },
      },
    ],
  },
  {
    id: "emploi-comites",
    theme: "Emploi",
    titre: "Les comités pour l'emploi",
    situation:
      "La loi pour le plein emploi a créé 360 comités locaux pour l'emploi, dont les premières feuilles de route identifient les freins locaux : mobilité, logement, garde d'enfants, adéquation des compétences (Cour des comptes, RPA 2026).",
    question: "Quel rôle donner aux comités pour l'emploi ?",
    options: [
      {
        label: "Financer la levée des freins : garde d'enfants, mobilité",
        consequence:
          "Vous donnez aux comités les moyens de traiter les freins concrets : crèches aux horaires atypiques, solutions de transport. L'accès à l'emploi s'améliore là où il se bloque.",
        effets: { bonheur: 4, confiance: 2, pouvoirAchat: 2, finances: -5, cohesion: 2 },
      },
      {
        label: "Budget et indicateurs de résultats pour chaque comité",
        consequence:
          "Vous institutionnalisez : crédits dédiés, cibles mesurables, évaluation. Efficace si le pilotage suit ; sinon, une couche de gouvernance de plus.",
        effets: { bonheur: 1, confiance: 2, pouvoirAchat: 0, finances: -2, cohesion: 1 },
      },
      {
        label: "Évaluer avant de financer davantage",
        consequence:
          "Vous attendez les premiers résultats mesurés. Prudence gestionnaire ; les territoires qui avaient cru à la promesse s'impatientent.",
        effets: { bonheur: -1, confiance: 0, pouvoirAchat: 0, finances: 1, cohesion: 0 },
      },
      {
        label: "Fusionner comités et missions locales",
        consequence:
          "Vous simplifiez le paysage en fusionnant les structures. Économies d'échelle possibles ; la proximité des missions locales avec les jeunes se dilue.",
        effets: { bonheur: 0, confiance: 0, pouvoirAchat: 0, finances: 2, cohesion: -1 },
      },
    ],
  },
];
