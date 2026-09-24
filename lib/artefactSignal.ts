// Format demandé au modèle : terminer sa réponse par un bloc caché
// <!--ARTEFACT: {"title":"...","blocks":[...]}--> composé à partir du
// vocabulaire de blocs (lib/dashboardArtefact.ts). Les formes historiques
// ("kind":"report" / "checklist" / "chart" / "map" / "dashboard") restent
// lues. On l'extrait pour proposer à l'utilisateur de l'ajouter à son
// espace — jamais ajouté automatiquement.
const ARTEFACT_RE = /<!--ARTEFACT:\s*(\{[\s\S]*?\})\s*-->/;
const TRUNCATED_MARKER_RE = /<!--ARTEFACT:[\s\S]*$/;

/**
 * « Un artefact servirait ici, mais je n'en ai pas produit » : le gent le
 * signale au lieu de le produire d'office, et l'utilisateur choisit d'un
 * clic. C'est le choix « réponse ou artefact », sans question posée avant
 * chaque réponse — qui aurait coûté un appel au modèle de plus à chaque fois.
 */
export const ARTEFACT_POSSIBLE_MARQUEUR = "<!--ARTEFACT_POSSIBLE-->";


import { parseDashboard, VOCABULAIRE_BLOCS, type DashboardSpec } from "@/lib/dashboardArtefact";
import { lireOperations, type OperationBloc } from "@/lib/operationsBlocs";
import {
  parseProfileSummary,
  PROFILE_SUMMARY_PROMPT_INSTRUCTION,
  type ProfileSummary,
} from "@/lib/profileSummaryArtefact";

export type ArtefactKind =
  | "report"
  | "checklist"
  | "chart"
  | "visual"
  | "map"
  | "dashboard"
  | "profile-summary";

export interface ArtefactSignal {
  kind: ArtefactKind;
  title: string;
  body?: string;
  items?: string[];
  chartData?: { label: string; value: number }[];
  mapPoints?: { label: string; lat: number; lon: number }[];
  dashboard?: DashboardSpec;
  profileSummary?: ProfileSummary;
  /** Retouche : artefact visé (identifiant ou titre) et opérations à appliquer. */
  cible?: string;
  operations?: OperationBloc[];
}

const KIND_LIST: ArtefactKind[] = [
  "report",
  "checklist",
  "chart",
  "visual",
  "map",
  "dashboard",
  "profile-summary",
];

/**
 * Fréquence à laquelle le gent propose des artefacts, réglée par le créateur.
 *
 * Un seul réglage, à trois crans, plutôt qu'un interrupteur par type : le
 * réglage par type avait été retiré à raison — personne ne sait d'avance quel
 * FORMAT servira. En revanche, un gent vitrine (« parle-moi de Charles ») et
 * un gent de déclaration fiscale n'ont pas le même besoin de livrables.
 */
export type FrequenceArtefacts = "discret" | "equilibre" | "proactif";

export const FREQUENCES_ARTEFACTS: readonly FrequenceArtefacts[] = ["discret", "equilibre", "proactif"];

export function estFrequenceArtefacts(v: unknown): v is FrequenceArtefacts {
  return typeof v === "string" && (FREQUENCES_ARTEFACTS as readonly string[]).includes(v);
}

const SEUIL_PAR_FREQUENCE: Record<FrequenceArtefacts, string> = {
  discret:
    "5. Sinon, N'EN PROPOSE PAS : ce gent ne produit d'artefact que sur demande explicite.",
  equilibre:
    "5. Sinon, propose-en un SEULEMENT s'il apporte ce que le texte seul n'apporte pas : quelque chose à réutiliser, " +
    "cocher, comparer ou consulter plus tard (procédure, liste de pièces, budget chiffré, comparatif, itinéraire, " +
    "modèle de document, parcours). Jamais pour une réponse courte, une explication, un échange de conversation ou " +
    "une question de relance. Dans le doute, n'en propose pas : l'utilisateur peut toujours le demander.",
  proactif:
    "5. Sinon, propose-en un dès que ta réponse contient un contenu structuré réutilisable (étapes, liste, chiffres, " +
    "lieux, récapitulatif) — mais jamais pour une réponse courte ou un simple échange de conversation.",
};

/**
 * Consigne UNIQUE qui décide si un artefact est proposé, puis sous quelle
 * forme.
 *
 * Il en existait deux, contradictoires, dans le même prompt : celle-ci
 * exigeait un artefact « systématiquement », « dans la majorité des
 * réponses », quand un bloc figé à la diffusion demandait « uniquement quand
 * le contenu s'y prête ». Chaque modèle tranchait à sa façon.
 *
 * L'ordre des règles est l'ordre de priorité : la parole de l'utilisateur,
 * puis la mémoire des verdicts passés (voir `historiquePourModele`), puis
 * l'honnêteté, et seulement ensuite le niveau choisi par le créateur.
 */
export function consigneArtefacts(frequence: FrequenceArtefacts = "equilibre"): string {
  return (
    "ARTEFACTS — un artefact est un livrable que l'utilisateur peut garder dans son espace. " +
    "Décide s'il en faut un en appliquant ces règles DANS L'ORDRE, la première qui s'applique l'emporte :\n" +
    "1. L'utilisateur en DEMANDE un (tableau, liste, synthèse, graphique, frise, carte, document…) : produis-le toujours.\n" +
    "2. L'utilisateur a demandé de ne plus en proposer : n'en propose plus dans cette conversation, sauf demande explicite.\n" +
    "3. Tes propositions passées figurent dans l'historique sous la forme " +
    "[Artefact proposé : « titre » (forme) — gardé | jeté | sans réponse]. Ne repropose JAMAIS un artefact jeté, " +
    "ni un doublon d'un artefact gardé. Si les deux dernières propositions ont été jetées, n'en propose plus sauf " +
    "demande explicite. N'écris jamais toi-même ces annotations entre crochets.\n" +
    "3 bis. L'utilisateur veut MODIFIER un artefact gardé : n'en produis PAS un nouveau. Les artefacts gardés et leurs " +
    "blocs figurent au début de son message, entre [ESPACE] et [/ESPACE] (ce passage n'est pas écrit par lui). Émets " +
    "des opérations sur les seuls blocs concernés — tout le reste est conservé à l'identique : " +
    '<!--ARTEFACT: {"cible":"<identifiant de l\'artefact>","operations":[' +
    '{"op":"modifier","bloc":"b3","avec":{…le bloc complet, modifié…}},' +
    '{"op":"ajouter","apres":"b2","bloc":{…}},' +
    '{"op":"supprimer","bloc":"b4"},' +
    '{"op":"deplacer","bloc":"b4","apres":"b1"}]}--> ' +
    '("apres":"debut" pour placer en tête ; sans "apres", à la fin). Utilise EXACTEMENT les identifiants listés, n\'en invente jamais.\n' +
    "4. Tu viens de dire que tu n'as pas l'information : pas d'artefact sur ce sujet — un livrable à trous paraîtrait fiable.\n" +
    SEUIL_PAR_FREQUENCE[frequence] +
    "\n\nFORMAT — un artefact est une suite de BLOCS que tu composes librement. Quand tu en produis un, termine ta réponse " +
    "(après le texte visible et après un éventuel bloc QUESTIONS, sur sa propre ligne) par exactement un bloc : " +
    '<!--ARTEFACT: {"title":"Titre court","subtitle":"Sous-titre optionnel","blocks":[...]}--> ' +
    "Compose ce qui sert le contenu, sans te limiter à une forme : une checklist seule pour des tâches ; une frise et un " +
    "encadré pour un historique ; une carte suivie d'une checklist pour un itinéraire ; des indicateurs, deux graphiques " +
    "côte à côte et un tableau pour une analyse chiffrée ; des titres et du texte pour une synthèse ou un modèle de document. " +
    "Mets les chiffres clés en blocs stats ou chart plutôt que de les noyer dans un paragraphe.\n" +
    VOCABULAIRE_BLOCS +
    "\nLe titre nomme le CONTENU (« Parcours professionnel », « Budget du séjour »), jamais la forme (« Tableau de bord »). " +
    "Pour la FICHE de synthèse d'une personne (qui elle est, ce qu'elle sait faire), utilise le format résumé de profil " +
    "décrit ci-dessous ; pour la chronologie de son parcours, une frise (timeline). " +
    "L'utilisateur choisit de garder ou de jeter l'artefact — ne dis jamais qu'il est déjà ajouté à l'espace. " +
    "Jamais plus d'un artefact par réponse.\n" +
    "QUAND TU PRODUIS UN ARTEFACT, ton texte visible se limite à UNE phrase qui l'annonce (« Voici la frise de son " +
    "parcours. ») : tout le contenu va dans l'artefact, ne le rédige jamais deux fois. Même règle pour une retouche " +
    "(« C'est fait : j'ai ajouté l'étape. »).\n" +
    "QUAND TU N'EN PRODUIS PAS alors que ta réponse contient un contenu qu'un artefact servirait vraiment (liste, étapes, " +
    "chiffres, parcours, lieux, comparaison), réponds normalement et termine par " + ARTEFACT_POSSIBLE_MARQUEUR +
    " sur sa propre ligne : l'utilisateur verra un bouton pour en demander un. Jamais pour une réponse courte ou un simple échange.\n\n" +
    PROFILE_SUMMARY_PROMPT_INSTRUCTION
  );
}

/** Niveau par défaut — routines de veille et gents qui n'ont rien réglé. */
export const ARTEFACT_PROMPT_INSTRUCTION = consigneArtefacts("equilibre");

/**
 * Pourquoi un artefact annoncé n'a pas pu être lu.
 *
 *   - `tronque`   : le bloc a commencé mais la réponse s'est arrêtée avant sa
 *                   fin (plafond de longueur) ;
 *   - `illisible` : le bloc est complet mais son contenu est inexploitable
 *                   (JSON invalide, type inconnu, titre ou nom manquant) ;
 *   - `cible`     : une retouche vise un artefact qui n'est pas (ou plus) dans
 *                   l'espace, ou dont aucun bloc visé n'existe.
 *
 * Absent quand aucun artefact n'était annoncé — le cas normal. Les deux
 * premiers étaient autrefois confondus avec lui : l'artefact disparaissait
 * sans un mot, alors que le modèle venait de passer de longues secondes à
 * l'écrire.
 */
export type EchecArtefact = "tronque" | "illisible" | "cible";

export function extractArtefactSignal(raw: string): {
  text: string;
  artefact: ArtefactSignal | null;
  echec?: EchecArtefact;
} {
  const match = raw.match(ARTEFACT_RE);
  if (!match) {
    const truncated = raw.match(TRUNCATED_MARKER_RE);
    if (truncated) return { text: raw.slice(0, truncated.index).trim(), artefact: null, echec: "tronque" };
    return { text: raw, artefact: null };
  }

  let artefact: ArtefactSignal | null = null;
  try {
    const parsed = JSON.parse(match[1]);
    // Retouche d'un artefact gardé : { cible, operations }. L'artefact visé
    // n'est connu que de l'espace — la résolution se fait à l'arrivée.
    if (parsed && typeof parsed.cible === "string" && parsed.cible.trim() && Array.isArray(parsed.operations)) {
      const operations = lireOperations(parsed.operations);
      artefact = operations
        ? { kind: "dashboard", title: parsed.cible.trim(), cible: parsed.cible.trim(), operations }
        : null;
      const start = match.index ?? 0;
      const text = (raw.slice(0, start) + raw.slice(start + match[0].length)).trim();
      return artefact ? { text, artefact } : { text, artefact: null, echec: "illisible" };
    }
    // Format unique : { title, subtitle?, blocks }. Le résumé de profil garde
    // son format propre (rendu dédié, médias à générer).
    if (parsed && typeof parsed.title === "string" && Array.isArray(parsed.blocks) && parsed.kind !== "profile-summary") {
      const dashboard = parseDashboard({ subtitle: parsed.subtitle, blocks: parsed.blocks });
      artefact = dashboard ? { kind: "dashboard", title: parsed.title, dashboard } : null;
    } else if (parsed && typeof parsed.title === "string" && KIND_LIST.includes(parsed.kind)) {
      // Formes HISTORIQUES (report, checklist, chart, map, dashboard…) :
      // toujours lues — un modèle qui ignore la consigne, ou un artefact figé,
      // ne doit rien perdre.
      const profileSummary =
        parsed.kind === "profile-summary" ? parseProfileSummary(parsed.profileSummary) ?? undefined : undefined;
      // Un profile-summary sans nom valide est ignoré (évite une carte vide).
      if (parsed.kind === "profile-summary" && !profileSummary) {
        artefact = null;
      } else {
        artefact = {
          kind: parsed.kind,
          title: parsed.title,
          body: typeof parsed.body === "string" ? parsed.body : undefined,
          dashboard: parsed.kind === "dashboard" ? parseDashboard(parsed.dashboard) ?? undefined : undefined,
          profileSummary,
          items: Array.isArray(parsed.items)
            ? parsed.items.filter((s: unknown): s is string => typeof s === "string").slice(0, 30)
            : undefined,
          chartData: Array.isArray(parsed.chartData)
            ? parsed.chartData
                .filter((d: unknown): d is { label: string; value: number } =>
                  !!d &&
                  typeof (d as { label?: unknown }).label === "string" &&
                  typeof (d as { value?: unknown }).value === "number"
                )
                .slice(0, 12)
            : undefined,
          mapPoints: Array.isArray(parsed.points)
            ? parsed.points
                .filter((pt: unknown): pt is { label: string; lat: number; lon: number } => {
                  const o = pt as { label?: unknown; lat?: unknown; lon?: unknown };
                  return !!o && typeof o.label === "string" && typeof o.lat === "number" && typeof o.lon === "number";
                })
                .slice(0, 25)
            : undefined,
        };
      }
    }
  } catch {
    // ignore malformed block
  }

  const start = match.index ?? 0;
  const text = (raw.slice(0, start) + raw.slice(start + match[0].length)).trim();
  return artefact ? { text, artefact } : { text, artefact: null, echec: "illisible" };
}

/**
 * Message envoyé par « Réessayer » sous un artefact perdu. Envoyé comme un
 * message ordinaire, donc VISIBLE dans le fil : l'utilisateur voit ce qu'on
 * demande en son nom. Coupé → on demande plus court, sans quoi la même limite
 * produirait le même échec.
 */
export const MESSAGE_REESSAI_ARTEFACT: Record<EchecArtefact, string> = {
  tronque: "Redonne-moi l'artefact de ta réponse précédente, en version plus compacte, sans répéter le texte.",
  illisible: "Redonne-moi l'artefact de ta réponse précédente, sans répéter le texte.",
  cible: "Refais cette modification sur l'artefact concerné, en utilisant les identifiants de ses blocs.",
};

export function extractArtefactPossible(raw: string): { text: string; possible: boolean } {
  if (!raw.includes(ARTEFACT_POSSIBLE_MARQUEUR)) return { text: raw, possible: false };
  return { text: raw.split(ARTEFACT_POSSIBLE_MARQUEUR).join("").trim(), possible: true };
}

/**
 * Messages envoyés par les boutons, VISIBLES dans le fil comme tout message :
 * l'utilisateur voit ce qu'on demande en son nom, et la préférence qui en
 * découle se lit dans l'historique (voir `preferenceArtefact`).
 */
export const MESSAGE_EN_ARTEFACT = "Fais-en un artefact, sans répéter le texte.";
export const MESSAGE_REPONSE_TEXTE = "Réponds-moi directement dans la conversation, sans artefact.";

/** Le flux est-il en train d'écrire un bloc d'artefact ? */
export function artefactEnCoursDEcriture(fluxPartiel: string): boolean {
  return fluxPartiel.includes("<!--ARTEFACT");
}
