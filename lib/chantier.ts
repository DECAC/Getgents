/**
 * « Le chantier » : un gent assistant de maître d'œuvre pour une rénovation.
 *
 * L'utilisateur pilote lui-même ses travaux — financement, artisans, devis,
 * planning, réception. Le gent tient son DOSSIER : c'est l'essence du format,
 * pas un accessoire de la conversation. D'où deux règles que ce module porte :
 *
 *   1. le dossier EXISTE dès l'ouverture. Ses cinq parties sont posées par la
 *      configuration (`dossierChantier`), comme le document d'une visionneuse,
 *      avec des états vides qui disent quoi raconter au gent ;
 *   2. il n'est jamais écrasé. `mergeDossierChantier` ne pose le squelette que
 *      si AUCUNE partie n'est présente : un dossier rempli reste tel quel, et
 *      une partie supprimée volontairement ne revient pas.
 *
 * Le dossier vit dans les artefacts de l'espace, pas dans une conversation :
 * « Nouvel échange » n'y touche pas.
 *
 * La consigne ci-dessous ne parle que de FORME (quels artefacts, comment les
 * retoucher). La FRÉQUENCE des artefacts a une seule source,
 * `consigneArtefacts` (lib/artefactSignal.ts).
 *
 * Module PUR — testable sans navigateur.
 */
import type { Artefact } from "@/lib/types";
import type { DashboardSpec } from "@/lib/dashboardArtefact";

/** Préfixe des identifiants des parties du dossier. */
export const PREFIXE_DOSSIER = "chantier-";

export const IDS_DOSSIER = {
  ensemble: "chantier-ensemble",
  bien: "chantier-bien",
  artisans: "chantier-artisans",
  devis: "chantier-devis",
  planning: "chantier-planning",
} as const;

export const TYPE_DOSSIER = "Dossier de chantier";

/** Instructions de départ — le créateur les ajuste à son chantier. */
export const PROMPT_CHANTIER_DEFAUT =
  "Tu es mon assistant de maîtrise d'œuvre. Je pilote moi-même la rénovation de mon logement, du financement à la réception, " +
  "et tu m'épaules comme un conducteur de travaux expérimenté.\n\n" +
  "Ce que tu fais :\n" +
  "- Tu ANTICIPES : à chaque étape, tu me dis ce qui vient ensuite, ce qu'il faut préparer, et ce qui risque de bloquer.\n" +
  "- Tu VÉRIFIES la conformité : règles de l'art (DTU), installation électrique (NF C 15-100), assurance décennale, label RGE, " +
  "SIRET actif, urbanisme (déclaration préalable, plan local d'urbanisme), règlement de copropriété, diagnostics avant travaux.\n" +
  "- Tu M'ALERTES dès qu'un point menace le budget, le planning ou la qualité : devis incomplet, mention « ou équivalent », " +
  "attestation manquante, dépendance entre lots, retard sur le chemin critique.\n" +
  "- Tu tiens les FICHES ARTISANS : coordonnées, vérifications, devis poste par poste, questions ouvertes, passages sur le chantier.\n" +
  "- Tu PRÉPARES mes rendez-vous : les questions à poser, dans l'ordre, et ce qu'il faut obtenir par écrit.\n\n" +
  "Tes règles :\n" +
  "- Tu n'inventes jamais une règle locale, un chiffre, un délai ou une référence. Ce que tu n'as pas vérifié, tu le marques « à vérifier » " +
  "et tu donnes la source à consulter (Géoportail de l'urbanisme, Atlas des patrimoines, annuaire des entreprises, France Rénov'…).\n" +
  "- Les avis clients sont indicatifs, jamais une garantie.\n" +
  "- Tu PROPOSES de valider un devis, un poste ou un paiement ; c'est toujours moi qui valide.\n" +
  "- Tu me parles simplement, en phrases courtes, sans jargon non expliqué.";

/**
 * Consigne de forme jointe au prompt d'un gent chantier. Elle dit où vit le
 * dossier et comment le faire évoluer : en RETOUCHANT ses parties, bloc par
 * bloc, jamais en en créant une autre.
 */
export function consigneChantier(): string {
  return (
    "DOSSIER DE CHANTIER : le dossier existe déjà. Ce sont les artefacts gardés dont l'identifiant commence par " +
    `« ${PREFIXE_DOSSIER} » : ${IDS_DOSSIER.ensemble} (vue d'ensemble : avancement, budget, points à traiter), ` +
    `${IDS_DOSSIER.bien} (le bien, DPE, diagnostics, mairie, copropriété, règles locales), ` +
    `${IDS_DOSSIER.artisans} (une fiche par artisan : coordonnées, vérifications, questions ouvertes, passages), ` +
    `${IDS_DOSSIER.devis} (devis par lot, montants, état, points de vigilance) et ` +
    `${IDS_DOSSIER.planning} (lots, dates, dépendances, jalons). ` +
    "Quand l'utilisateur t'apprend quelque chose qui change le dossier, mets à jour la partie concernée par une RETOUCHE de ses blocs, " +
    "en la visant par son identifiant. Ne crée jamais un second dossier ni une nouvelle partie qui ferait doublon. " +
    "Remplace les lignes « à renseigner » par les vraies informations, et retire l'encadré « Pour commencer » d'une partie dès qu'elle est remplie. " +
    "Ta retouche est APPLIQUÉE tout de suite, sans validation : ne retouche que sur une information donnée par l'utilisateur ou vérifiée, " +
    "et une information non vérifiée entre dans le dossier marquée « à vérifier ». Dis en une phrase ce que tu as changé."
  );
}

const A_RENSEIGNER = "à renseigner";

function partie(id: string, titre: string, icone: string, spec: DashboardSpec): Artefact {
  return { id, title: titre, type: TYPE_DOSSIER, icon: icone, kind: "dashboard", date: "Dossier du chantier", dashboard: spec };
}

/**
 * Les cinq parties du dossier, vierges. Chaque bloc est NON VIDE : le
 * vocabulaire fermé refuse un bloc vide (`parseDashboard`), et un état vide
 * qui ne dit rien laisse l'utilisateur sans savoir par où commencer.
 */
export function dossierChantier(): Artefact[] {
  return [
    partie(IDS_DOSSIER.ensemble, "Vue d'ensemble", "🏗️", {
      subtitle: "Où en est le chantier",
      blocks: [
        {
          id: "commencer",
          type: "callout",
          tone: "info",
          title: "Pour commencer",
          body:
            "Racontez votre projet à l'assistant : le bien, les travaux envisagés, votre budget et la date souhaitée de fin. " +
            "Il remplit le dossier au fil de vos échanges.",
        },
        {
          id: "indicateurs",
          type: "stats",
          items: [
            { label: "Avancement", value: "—" },
            { label: "Budget prévu", value: "—" },
            { label: "Artisans retenus", value: "—" },
            { label: "Réception prévue", value: "—" },
          ],
        },
        {
          id: "a-traiter",
          type: "checklist",
          title: "À traiter",
          items: [{ label: "Décrire le projet à l'assistant", checked: false }],
        },
      ],
    }),
    partie(IDS_DOSSIER.bien, "Chantier", "🏠", {
      subtitle: "Le bien et ses contraintes",
      blocks: [
        {
          id: "commencer",
          type: "callout",
          tone: "info",
          title: "Pour commencer",
          body:
            "Donnez l'adresse, la surface, l'année de construction et dites si le logement est en copropriété. " +
            "Joignez le DPE si vous l'avez : l'assistant en tire la classe actuelle et ce que les travaux peuvent viser.",
        },
        {
          id: "le-bien",
          type: "kv",
          title: "Le bien",
          items: [
            { label: "Adresse", value: A_RENSEIGNER },
            { label: "Surface", value: A_RENSEIGNER },
            { label: "Année de construction", value: A_RENSEIGNER },
            { label: "Copropriété", value: A_RENSEIGNER },
          ],
        },
        {
          id: "dpe",
          type: "kv",
          title: "Performance énergétique",
          items: [
            { label: "Classe actuelle", value: A_RENSEIGNER },
            { label: "Classe visée après travaux", value: A_RENSEIGNER },
          ],
        },
        {
          id: "demarches",
          type: "table",
          title: "Diagnostics, mairie, copropriété",
          columns: ["Démarche", "Référence", "Déposée le", "État"],
          rows: [["—", "—", "—", A_RENSEIGNER]],
        },
      ],
    }),
    partie(IDS_DOSSIER.artisans, "Artisans", "👷", {
      subtitle: "Une fiche par artisan",
      blocks: [
        {
          id: "commencer",
          type: "callout",
          tone: "info",
          title: "Pour commencer",
          body:
            "Citez un artisan contacté : son nom, son métier, sa ville. L'assistant vérifie ce qui est public " +
            "(SIRET, assurance décennale, label RGE) et ouvre sa fiche.",
        },
        {
          id: "lots",
          type: "table",
          title: "Les lots",
          columns: ["Lot", "Artisan", "Vérifications", "État"],
          rows: [["—", A_RENSEIGNER, "—", "—"]],
        },
      ],
    }),
    partie(IDS_DOSSIER.devis, "Devis", "🧾", {
      subtitle: "Tous les lots, à périmètre égal",
      blocks: [
        {
          id: "commencer",
          type: "callout",
          tone: "info",
          title: "Pour commencer",
          body:
            "Joignez un devis ou recopiez ses postes : l'assistant le range par lot, le compare aux autres à périmètre égal " +
            "et relève ce qui manque ou ce qui doit être précisé.",
        },
        {
          id: "par-lot",
          type: "table",
          title: "Devis par lot",
          columns: ["Lot", "Artisan", "Montant TTC", "État", "Acompte"],
          rows: [["—", "—", "—", A_RENSEIGNER, "—"]],
        },
      ],
    }),
    partie(IDS_DOSSIER.planning, "Planning", "📅", {
      subtitle: "Lots, dates et dépendances",
      blocks: [
        {
          id: "commencer",
          type: "callout",
          tone: "info",
          title: "Pour commencer",
          body:
            "Dites quand le chantier doit commencer et finir. L'assistant ordonne les lots (ce qui doit être fini avant quoi) " +
            "et vous prévient quand un retard menace la réception.",
        },
        {
          id: "frise",
          type: "timeline",
          title: "Étapes",
          items: [
            { label: "Démarrage du chantier", state: "todo", body: "Date à renseigner" },
            { label: "Réception des travaux", state: "milestone", body: "Date à renseigner" },
          ],
        },
      ],
    }),
  ];
}

export function estPartieDuDossier(a: Pick<Artefact, "id">): boolean {
  return a.id.startsWith(PREFIXE_DOSSIER);
}

/**
 * Pose le dossier vierge dans des artefacts conservés, une seule fois.
 *
 * Seulement si AUCUNE partie n'est présente : un dossier commencé n'est jamais
 * complété ni écrasé par des parties vides, et une partie que l'utilisateur a
 * supprimée exprès ne revient pas. Le squelette vient EN TÊTE, dans l'ordre
 * des onglets du dossier.
 */
export function mergeDossierChantier(gardes: Artefact[], actif: boolean): Artefact[] {
  if (!actif || gardes.some(estPartieDuDossier)) return gardes;
  return [...dossierChantier(), ...gardes];
}

/* ------------------------------------------------------------------ */
/* Le dossier se met à jour seul                                       */
/* ------------------------------------------------------------------ */

/**
 * Une retouche du gent s'applique-t-elle SANS verdict ?
 *
 * Seulement sur un gent chantier, et seulement pour une RETOUCHE (des
 * opérations sur des blocs) qui vise une partie du dossier. C'est le choix de
 * l'utilisateur : son dossier vit seul, sans un clic par échange. Le filet,
 * ce sont les versions (8 conservées) et « Annuler » sous la réponse.
 * Une version complète, ou un artefact ordinaire, reste une proposition à
 * garder : ce n'est plus mettre à jour le dossier, c'est en écrire un autre.
 */
export function appliquerSansVerdict(
  espace: { chantier?: { enabled: boolean } },
  proposition: { modification?: { artefactId: string } } | null | undefined
): boolean {
  if (espace.chantier?.enabled !== true) return false;
  const id = proposition?.modification?.artefactId;
  return !!id && estPartieDuDossier({ id });
}

/**
 * Range la nouvelle version d'un artefact gardé. Une partie du dossier reste
 * À SA PLACE : la remettre en tête, comme un artefact ordinaire, mélangerait
 * l'ordre des onglets à chaque mise à jour.
 */
export function placerMiseAJour(artefacts: Artefact[], misAJour: Artefact): Artefact[] {
  if (estPartieDuDossier(misAJour) && artefacts.some((a) => a.id === misAJour.id)) {
    return artefacts.map((a) => (a.id === misAJour.id ? misAJour : a));
  }
  return [misAJour, ...artefacts.filter((a) => a.id !== misAJour.id)];
}

/**
 * Ce que l'assistant voit du dossier à chaque tour. Le dossier est sa SEULE
 * mémoire après « Nouvel échange » : il doit le lire en entier. Le budget
 * ordinaire (3 000 caractères par artefact) réduisait une partie remplie à
 * des titres de blocs. Coût assumé : jusqu'à ~8 000 jetons de plus par tour
 * sur un dossier plein.
 */
export const BUDGET_DOSSIER = { total: 32_000, parArtefact: 6_000, maxArtefacts: 8 } as const;

/** Le dossier d'abord, dans l'ordre de ses onglets ; le reste ensuite. */
export function dossierEnTete(artefacts: readonly Artefact[]): Artefact[] {
  return [...artefacts.filter(estPartieDuDossier), ...artefacts.filter((a) => !estPartieDuDossier(a))];
}
