import type { EspacesMap } from "@/lib/types";

const ICON_REPORT =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3v5h5"/><path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7z"/><path d="M9 13h6M9 17h4"/></svg>';
const ICON_CHECK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="3"/></svg>';

export const ESPACES: EspacesMap = {
  voyage: {
    icon: "🧭",
    name: "Road trip en famille — été 2026",
    gent: "Compagnon de planification de voyage",
    version: 4,
    status: "live",
    statusLabel: "En cours",
    sensitive: false,
    metrics: [
      { value: "45", label: "jours avant départ" },
      { value: "737 €", suffix: "/ 2 800 €", label: "budget engagé" },
      { value: "4", label: "voyageurs" },
      { value: "4/5", label: "étapes confirmées" },
    ],
    integrations: [
      { label: "MCP Cartes", action: false },
      { label: "Webhook restaurants", action: false },
      { label: "Booking.com", action: true },
      { label: "Billetterie ferry", action: true },
    ],
    tools: [
      {
        id: "mcp-cartes",
        name: "MCP Cartes",
        category: "lecture",
        icon: "🗺️",
        desc: "Calcule des trajets et itinéraires. Lecture seule — aucune donnée écrite chez le fournisseur.",
        connectable: false,
      },
      {
        id: "webhook-resto",
        name: "Webhook restaurants",
        category: "lecture",
        icon: "🍽️",
        desc: "Recherche des établissements adaptés aux préférences déclarées. Lecture seule.",
        connectable: false,
      },
      {
        id: "booking",
        name: "Booking.com",
        category: "compte_tiers",
        icon: "🏨",
        desc: "Connectez votre compte personnel : l'assistant peut proposer des réservations, mais c'est vous qui validez et payez sur Booking.com — jamais Getgents.",
        connectable: true,
        connected: false,
      },
      {
        id: "ferry",
        name: "Billetterie ferry",
        category: "ecriture",
        icon: "⛴️",
        desc: "Webhook d'écriture vers le partenaire billetterie. Chaque envoi nécessite votre confirmation explicite. Aucun compte personnel associé pour ce connecteur.",
        connectable: false,
      },
    ],
    tabs: [
      {
        id: "itineraire",
        name: "Itinéraire",
        kind: "timeline",
        sub: "Construit au fil de vos échanges avec l'assistant",
        steps: [
          { day: 1, city: "Lyon", night: "Nuit à Lyon · départ", status: "done", tags: ["Confirmé"] },
          { day: 2, city: "Annecy", night: "Nuit à Annecy", status: "done", tags: ["Confirmé"] },
          { day: 3, city: "Turin", night: "Nuit à Turin", status: "done", tags: ["Confirmé", "Musée égyptien"] },
          { day: 4, city: "Cinque Terre", night: "2 nuits · base La Spezia", status: "done", tags: ["Ajouté à votre demande", "Accès en train, pas en voiture"] },
          { day: 5, city: "Nice", night: "Retour · nuit à Nice", status: "future", tags: ["À confirmer"] },
        ],
      },
      {
        id: "reservations",
        name: "Réservations",
        kind: "resv",
        sub: "Propositions de l'assistant et leur statut — rien n'est payé sur Getgents",
        items: [
          {
            id: "resa-booking",
            icon: "🏨",
            service: "Booking.com",
            category: "compte_tiers",
            what: "Casa Caterina — chambre familiale, Vernazza",
            rows: [
              ["Date", "Jour 4 du voyage · 1 nuit"],
              ["Voyageurs", "4 personnes"],
              ["Prix affiché", "138 € (sur Booking.com)"],
              ["Annulation", "Gratuite jusqu'à 48h avant — selon Booking.com"],
            ],
            price: null,
            status: "pending",
          },
          {
            id: "resa-ferry",
            icon: "⛴️",
            service: "Billetterie ferry",
            category: "ecriture",
            what: "5 billets ferry — La Spezia → Cinque Terre",
            rows: [
              ["Date", "Jour 4 du voyage · départ 9h15"],
              ["Passagers", "5 (2 adultes, 2 enfants, 1 accompagnant)"],
              ["Trajet", "Aller simple, retour en train régional"],
              ["Politique de remboursement", "Non remboursable à moins de 48h"],
            ],
            price: "96,50 €",
            status: "pending",
          },
        ],
      },
      {
        id: "budget",
        name: "Budget",
        kind: "chart",
        sub: "Suivi des dépenses engagées",
        envelope: 2800,
        categories: [
          { label: "Hébergement", color: "var(--sage)", spent: 640 },
          { label: "Réservations", color: "var(--gold)", spent: 96.5 },
          { label: "Restauration", color: "var(--plum)", spent: 0 },
          { label: "Transport local", color: "#5C8AA6", spent: 0 },
        ],
        history: [
          { day: "J-12", cum: 0 },
          { day: "J-9", cum: 110 },
          { day: "J-7", cum: 330 },
          { day: "J-4", cum: 550 },
          { day: "J-1", cum: 640 },
          { day: "Auj.", cum: 736.5 },
        ],
      },
    ],
    map: {
      title: "Le parcours",
      hint: "Représentation schématique — cliquez une étape.",
      stops: [
        { day: 1, city: "Lyon", night: "Nuit à Lyon · départ", x: 235, y: 139 },
        { day: 2, city: "Annecy", night: "Nuit à Annecy", x: 316, y: 128 },
        { day: 3, city: "Turin", night: "Nuit à Turin", x: 413, y: 194 },
        { day: 4, city: "Cinque Terre", night: "2 nuits · base La Spezia", x: 545, y: 272 },
        { day: 5, city: "Nice", night: "Retour · nuit à Nice", x: 387, y: 304 },
      ],
    },
    themeTabs: [
      {
        id: "theme-demo-hebergement",
        label: "Hébergement",
        moduleIds: ["map", "artef-vernazza-preview", "tab-reservations"],
      },
    ],
    memory: `Road trip familial à travers les Alpes et la Riviera, du 12 au 19 juillet 2026.\nFoyer : 2 adultes, 2 enfants (6 et 9 ans). Préférence sans gluten pour l'aîné — à prendre en compte à chaque étape restauration.\nBudget : 2 800 € hors carburant et péages. Alerte prévue à 80 %.\n\nItinéraire en validation : Lyon (J1) → Annecy (J2) → Turin (J3) → Cinque Terre / La Spezia (J4, 2 nuits) → Nice (J5).\nDécisions prises : étapes Lyon, Annecy, Turin confirmées ; Cinque Terre ajoutée à votre demande ; accès aux villages en train depuis La Spezia retenu pour ne pas conduire sur place.\nHébergement encore à confirmer sur l'ensemble du parcours.\n\nAucune réservation ni paiement n'est effectué en votre nom.`,
    conversations: [
      {
        id: "conv-voyage-1",
        startedAt: "24 juin",
        messages: [
      { role: "agent", text: "<p>Bon retour. On reprend votre road trip : <b>Lyon → Annecy → Turin → Nice</b>, du 12 au 19 juillet, 2 adultes + 2 enfants. Vous vouliez intercaler une étape entre Turin et Nice.</p>", t: "09:14" },
      { role: "user", text: "<p>Oui — les Cinque Terre. Mais je ne veux pas conduire une fois sur place.</p>", t: "09:15" },
      { role: "tool", kind: "MCP", what: "Cartes — Turin → La Spezia, puis accès Cinque Terre", ok: true },
      { role: "agent", text: "<p>Turin → La Spezia, ~2h30 de route. De là, les villages se rejoignent en train régional, pas en voiture : je vous évite les routes côtières étroites avec les enfants. Je l'ai placé en <b>étape 4 (J4)</b>, 2 nuits — votre itinéraire est à jour.</p>", t: "09:15" },
      { role: "artef-pointer", tab: "itineraire", icon: "🧭", status: "pending", title: "Itinéraire mis à jour — étape 4 ajoutée", link: "Voir l'itinéraire" },
      { role: "user", text: "<p>Parfait. Où manger là-bas, avec du sans gluten ?</p>", t: "09:17" },
      { role: "tool", kind: "Webhook", what: "Recommandation restaurants — Cinque Terre · familial · sans gluten", ok: true },
      { role: "agent", text: "<p>Trois adresses à Monterosso et Vernazza, menu enfant et options sans gluten confirmées (préférence notée dans la mémoire).</p>", t: "09:17" },
      { role: "user", text: "<p>Avant de valider Vernazza, montre-moi à quoi ça ressemble.</p>", t: "09:18" },
      { role: "artef-visual", ref: "vernazza-preview" },
      { role: "user", text: "<p>Trouve-moi un hébergement à Vernazza pour la nuit du J4.</p>", t: "10:03" },
      { role: "tool", kind: "MCP", what: "Recherche hébergements — Vernazza, J4, 4 personnes", ok: true },
      { role: "agent", text: "<p>J'ai trouvé Casa Caterina, une chambre familiale bien notée. Je ne réserve ni ne paie jamais à votre place — j'ai déposé la proposition dans Réservations, c'est là que vous l'envoyez vers Booking.com pour valider et payer.</p>", t: "10:03" },
      { role: "artef-pointer", tab: "reservations", icon: "🏨", status: "pending", title: "Proposition — Casa Caterina, Vernazza", link: "Voir dans Réservations" },
      { role: "user", text: "<p>Et il nous faut aussi les billets de ferry pour les 5 — La Spezia, le matin du J4.</p>", t: "10:06" },
      { role: "tool", kind: "Webhook", what: "Billetterie ferry — La Spezia, 5 places, J4 matin", ok: true },
      { role: "agent", text: "<p>Proposition de billetterie déposée également — confirmation requise de votre part avant tout envoi.</p>", t: "10:06" },
      { role: "artef-pointer", tab: "reservations", icon: "⛴️", status: "pending", title: "Proposition — 5 billets ferry", link: "Voir dans Réservations" },
        ],
      },
    ],
    activeConversationId: "conv-voyage-1",
    files: [
      { id: "f1", name: "Confirmation_vol_LYS-NCE.pdf", size: "212 Ko", date: "Ajouté le 24 juin" },
      { id: "f2", name: "Carte_grise_vehicule.jpg", size: "1,4 Mo", date: "Ajouté le 24 juin" },
    ],
    artefacts: [
      {
        id: "vernazza-preview",
        title: "Aperçu — Vernazza, Cinque Terre",
        type: "Aperçu visuel",
        icon: ICON_REPORT,
        date: "Généré à la demande",
        visual: true,
        body: `<h4>Vernazza</h4>
        <p>Village des Cinque Terre, accès piéton depuis la gare. Pas de circulation automobile dans le centre — adapté pour se déplacer avec des enfants.</p>
        <h4>Ce que vous verrez</h4>
        <ul><li>Port miniature entouré de maisons colorées en restanque</li><li>Sentier bleu (Sentiero Azzurro) reliant les villages, par endroits payant et accidenté</li><li>Plage de galets en contrebas du port</li></ul>
        <p style="font-size:12px;color:var(--muted)">Illustration stylisée générée par Getgents à partir de descriptions publiques du lieu — ce n'est pas une photographie du site.</p>`,
      },
      {
        id: "itineraire",
        title: "Itinéraire — road trip 8 jours",
        type: "Rapport",
        icon: ICON_REPORT,
        date: "Mis à jour il y a 2 min",
        body: `<h4>Aperçu du séjour</h4>
        <div class="row"><span>Parcours</span><b>Lyon → Nice (boucle)</b></div>
        <div class="row"><span>Période</span><b>12 → 19 juillet 2026</b></div>
        <div class="row"><span>Voyageurs</span><b>2 adultes, 2 enfants</b></div>
        <h4>Étapes</h4>
        <ul>
        <li><b>J1 — Lyon.</b> Départ, nuit sur place. Vieux Lyon en soirée.</li>
        <li><b>J2 — Annecy.</b> Lac et vieille ville, baignade possible.</li>
        <li><b>J3 — Turin.</b> Passage des Alpes, musée égyptien adapté aux enfants.</li>
        <li><b>J4 — Cinque Terre (base La Spezia, 2 nuits).</b> Villages en train régional, pas en voiture.</li>
        <li><b>J5 — Nice.</b> Retour par la côte, dernière nuit.</li>
        </ul>
        <h4>Restaurants retenus (Cinque Terre)</h4>
        <ul><li>Monterosso — menu enfant, terrasse.</li><li>Vernazza — options sans gluten confirmées.</li></ul>
        <p style="font-size:12px;color:var(--muted)">Aucune réservation effectuée par l'assistant. Disponibilités et prix à confirmer auprès des établissements.</p>`,
      },
      {
        id: "checklist",
        title: "Checklist de préparatifs",
        type: "Checklist",
        icon: ICON_CHECK,
        date: "Créée à l'ouverture",
        body: `<h4>Avant le départ</h4>
        <div class="check ok"><div class="box">✓</div><span>Cartes d'identité valides (4 personnes)</span></div>
        <div class="check ok"><div class="box">✓</div><span>Assurance voyage souscrite</span></div>
        <div class="check"><div class="box"></div><span>Vérifier assurance auto + assistance à l'étranger</span></div>
        <div class="check"><div class="box"></div><span>Badge de télépéage (France + Italie)</span></div>
        <div class="check"><div class="box"></div><span>Réserver les hébergements (voir mémoire)</span></div>
        <div class="check"><div class="box"></div><span>Billets de train régional Cinque Terre</span></div>
        <h4>À emporter</h4>
        <div class="check"><div class="box"></div><span>Snacks sans gluten pour la route</span></div>
        <div class="check"><div class="box"></div><span>Kit enfants : crème solaire, casquettes, jeux voiture</span></div>`,
      },
    ],
  },

  succession: {
    icon: "⚖️",
    name: "Ma succession",
    gent: "Accompagnement de succession",
    version: 2,
    status: "paused",
    statusLabel: "En pause",
    sensitive: true,
    metrics: [
      { value: "2/5", label: "échéances traitées" },
      { value: "6 mois", label: "délai déclaration" },
      { value: "1/3", label: "documents fournis" },
    ],
    integrations: [{ label: "Aucune intégration externe", action: false }],
    tools: [],
    tabs: [
      {
        id: "echeances",
        name: "Échéances",
        kind: "timeline",
        sub: "Repères généraux — chaque situation est différente, à valider avec votre notaire",
        steps: [
          {
            day: 1,
            city: "Constat et déclaration du décès",
            night: "Constaté par un médecin, puis déclaré en mairie — généralement pris en charge par les pompes funèbres.",
            status: "done",
            tags: ["Fait"],
          },
          {
            day: 2,
            city: "Signalement aux organismes",
            night: "Employeur, banques, caisses de retraite et sécurité sociale informés du décès.",
            status: "done",
            tags: ["Fait"],
          },
          {
            day: 3,
            city: "Option de l'héritier",
            night: "Choix d'accepter ou de renoncer à la succession — à décider avec le notaire.",
            status: "future",
            tags: ["À décider", "Délai de réflexion possible : 4 mois"],
          },
          {
            day: 4,
            city: "Déclaration de succession",
            night: "À déposer auprès de l'administration fiscale — délai de principe : 6 mois après le décès (12 mois si hors de France).",
            status: "future",
            tags: ["Échéance clé", "À confirmer avec le notaire"],
          },
          {
            day: 5,
            city: "Paiement des droits de succession",
            night: "Dû en principe au moment du dépôt de la déclaration, sauf délai accordé par l'administration.",
            status: "future",
            tags: ["À anticiper"],
          },
        ],
      },
    ],
    conversations: [
      {
        id: "conv-succession-1",
        startedAt: "lundi",
        messages: [
      { role: "agent", text: "<p>Cet espace traite des informations sensibles (financières et juridiques). Je vous accompagne sur les étapes et les délais — je ne donne pas de conseil juridique formel et ne remplace pas un notaire.</p>", t: "lun." },
      { role: "user", text: "<p>Quels sont les premiers délais à ne pas rater ?</p>", t: "lun." },
      { role: "agent", text: "<p>Trois échéances structurantes existent en droit français des successions. Je les ai consignées dans une chronologie, avec leur point de départ — chaque cas a ses particularités, à valider avec votre notaire.</p>", t: "lun." },
      { role: "artef-pointer", tab: "echeances", icon: "⚖️", status: "pending", title: "Chronologie des échéances — à valider avec votre notaire", link: "Voir les échéances" },
      { role: "user", text: "<p>Peux-tu aussi préparer une checklist des démarches ?</p>", t: "lun." },
      { role: "agent", text: "<p>Fait — je l'ai ajoutée à vos artefacts, avec ce qui est déjà réglé et ce qu'il reste à faire.</p>", t: "lun." },
        ],
      },
    ],
    activeConversationId: "conv-succession-1",
    memory: `Espace ouvert pour accompagner une succession. Informations sensibles (financier, judiciaire).\nLe gent aide sur les étapes et les délais ; il ne fournit pas de conseil juridique formel.\n\nChronologie générale consignée dans l'onglet Échéances : déclaration du décès, option de l'héritier, déclaration de succession (6 mois), paiement des droits.\n\nÀ renseigner : lien au défunt, présence d'un testament, notaire saisi, nombre d'héritiers.`,
    map: null,
    files: [
      { id: "f1", name: "Acte_deces.pdf", size: "380 Ko", date: "Ajouté lundi" },
    ],
    artefacts: [
      {
        id: "checklist-succession",
        title: "Checklist des démarches",
        type: "Checklist",
        icon: ICON_CHECK,
        date: "Créée aujourd'hui",
        body: `<h4>Déjà fait</h4>
        <div class="check ok"><div class="box">✓</div><span>Acte de décès obtenu</span></div>
        <div class="check ok"><div class="box">✓</div><span>Employeur et organismes sociaux informés</span></div>
        <h4>À faire</h4>
        <div class="check"><div class="box"></div><span>Saisir un notaire (si ce n'est pas déjà fait)</span></div>
        <div class="check"><div class="box"></div><span>Réunir les relevés bancaires et contrats d'assurance-vie</span></div>
        <div class="check"><div class="box"></div><span>Statuer sur l'option de l'héritier avec le notaire</span></div>
        <div class="check"><div class="box"></div><span>Préparer la déclaration de succession (délai : 6 mois)</span></div>
        <p style="font-size:12px;color:var(--muted)">Liste générale et non exhaustive — chaque succession a ses particularités.</p>`,
      },
      {
        id: "recap-dossier",
        title: "Récapitulatif du dossier",
        type: "Rapport",
        icon: ICON_REPORT,
        date: "Mis à jour aujourd'hui",
        body: `<h4>Synthèse</h4>
        <div class="row"><span>Notaire saisi</span><b>À renseigner</b></div>
        <div class="row"><span>Testament</span><b>À renseigner</b></div>
        <div class="row"><span>Nombre d'héritiers</span><b>À renseigner</b></div>
        <div class="row"><span>Statut</span><b>En pause</b></div>
        <p style="font-size:12px;color:var(--muted)">Document de suivi. Ne constitue pas un acte ni un avis juridique.</p>`,
      },
      {
        id: "glossaire-succession",
        title: "Glossaire des termes juridiques",
        type: "Rapport",
        icon: ICON_REPORT,
        date: "Généré à la demande",
        body: `<h4>Quelques termes courants</h4>
        <ul>
        <li><b>Option de l'héritier.</b> Décision d'accepter purement et simplement, d'accepter à concurrence de l'actif net, ou de renoncer à la succession.</li>
        <li><b>Réserve héréditaire.</b> Part du patrimoine qui revient obligatoirement à certains héritiers, quelle que soit la volonté du défunt.</li>
        <li><b>Quotité disponible.</b> Part du patrimoine dont le défunt pouvait librement disposer (donation, testament).</li>
        <li><b>Indivision.</b> Situation où plusieurs héritiers possèdent ensemble un même bien avant son partage.</li>
        </ul>
        <p style="font-size:12px;color:var(--muted)">Définitions simplifiées à but pédagogique — ne remplacent pas l'avis de votre notaire.</p>`,
      },
    ],
  },

  fiscal: {
    icon: "📄",
    name: "Déclaration fiscale 2025",
    gent: "Assistant déclaration de revenus",
    version: 1,
    status: "done",
    statusLabel: "Résolu",
    sensitive: true,
    metrics: [
      { value: "28 mai", label: "déposée le" },
      { value: "2", label: "parts fiscales" },
    ],
    integrations: [{ label: "Aucune intégration externe", action: false }],
    tools: [],
    tabs: [],
    conversations: [
      {
        id: "conv-fiscal-1",
        startedAt: "28 mai",
        messages: [
      { role: "agent", text: "<p>Espace clôturé : votre déclaration a été déposée le 28 mai. Le récapitulatif reste dans les artefacts. Vous pouvez rouvrir cet espace l'an prochain — la mémoire sera reprise.</p>", t: "28 mai" },
        ],
      },
    ],
    activeConversationId: "conv-fiscal-1",
    memory: `Déclaration des revenus 2025. Foyer fiscal : 2 parts.\nStatut : déposée le 28 mai 2026.\nEspace clôturé — réutilisable l'an prochain avec reprise de la mémoire.`,
    map: null,
    files: [],
    artefacts: [
      {
        id: "recap",
        title: "Récapitulatif de déclaration",
        type: "Rapport",
        icon: ICON_REPORT,
        date: "Finalisé le 28 mai",
        body: `<h4>Synthèse</h4><div class="row"><span>Année</span><b>Revenus 2025</b></div><div class="row"><span>Parts</span><b>2</b></div><div class="row"><span>Date de dépôt</span><b>28 mai 2026</b></div><p style="font-size:12px;color:var(--muted)">Document de synthèse. Ne constitue pas un avis fiscal officiel.</p>`,
      },
    ],
  },
};
