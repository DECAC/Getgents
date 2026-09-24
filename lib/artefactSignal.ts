// Format demandé au modèle : terminer sa réponse par un bloc caché
// <!--ARTEFACT: {"kind":"report","title":"...","body":"...markdown..."}-->
// (ou "kind":"checklist" avec "items":["...","..."], ou "kind":"chart" avec
// "chartData":[{"label":"...","value":1}]) quand un artefact concret peut
// être produit à partir de l'échange. On l'extrait pour proposer à
// l'utilisateur de l'ajouter à son espace — jamais ajouté automatiquement.
const ARTEFACT_RE = /<!--ARTEFACT:\s*(\{[\s\S]*?\})\s*-->/;
const TRUNCATED_MARKER_RE = /<!--ARTEFACT:[\s\S]*$/;

import { parseDashboard, DASHBOARD_PROMPT_INSTRUCTION, type DashboardSpec } from "@/lib/dashboardArtefact";
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
    "demande explicite. Si l'utilisateur veut MODIFIER un artefact gardé, produis sa version complète mise à jour " +
    "sous EXACTEMENT le même titre : elle remplacera l'ancienne. N'écris jamais toi-même ces annotations entre crochets.\n" +
    "4. Tu viens de dire que tu n'as pas l'information : pas d'artefact sur ce sujet — un livrable à trous paraîtrait fiable.\n" +
    SEUIL_PAR_FREQUENCE[frequence] +
    "\n\nFORMAT — quand tu en produis un, termine ta réponse (après le texte visible et après un éventuel bloc QUESTIONS, " +
    "sur sa propre ligne) par exactement un bloc : " +
    '<!--ARTEFACT: {"kind":"report","title":"Titre court","body":"Contenu en markdown"}--> ' +
    "pour une synthèse, un modèle de document, une procédure détaillée ou un texte à réutiliser ; " +
    '<!--ARTEFACT: {"kind":"checklist","title":"Titre court","items":["Élément 1","Élément 2","Élément 3"]}--> ' +
    "pour des étapes à cocher, une liste de pièces ou de tâches (items courts, un par élément, sans numérotation) ; ou " +
    '<!--ARTEFACT: {"kind":"chart","title":"Titre court","chartData":[{"label":"Catégorie A","value":120},{"label":"Catégorie B","value":80}]}--> ' +
    "pour des montants, pourcentages ou comparaisons chiffrées ; ou " +
    '<!--ARTEFACT: {"kind":"map","title":"Titre court","points":[{"label":"Lyon","lat":45.7578,"lon":4.832},{"label":"Annecy","lat":45.8992,"lon":6.1294}]}--> ' +
    "pour des lieux, un itinéraire, des adresses ou des zones géographiques — fournis des coordonnées WGS84 (lat/lon) précises pour chaque point, la carte est rendue sur fond IGN (cartes.gouv.fr). " +
    "Le titre nomme le CONTENU (« Parcours professionnel », « Budget du séjour »), jamais la forme (« Tableau de bord »). " +
    "Choisis la forme la plus utile : checklist pour l'actionnable, report pour les textes longs — SAUF si le contenu comporte un scoring, des indicateurs clés (KPI) ou plusieurs angles chiffrés à comparer, auquel cas privilégie TOUJOURS dashboard (voir instruction dédiée ci-dessous) : un lecteur doit saisir les chiffres clés et leur comparaison en un coup d'œil, pas en lisant un paragraphe. " +
    "Pour le parcours d'une PERSONNE en particulier, privilégie profile-summary (voir instruction dédiée) plutôt qu'un report générique. " +
    "L'utilisateur choisit de garder ou de jeter l'artefact — ne dis jamais qu'il est déjà ajouté à l'espace. " +
    "Jamais plus d'un artefact par réponse.\n\n" +
    DASHBOARD_PROMPT_INSTRUCTION +
    "\n\n" +
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
 *                   (JSON invalide, type inconnu, titre ou nom manquant).
 *
 * Absent quand aucun artefact n'était annoncé — le cas normal. Les deux
 * premiers étaient autrefois confondus avec lui : l'artefact disparaissait
 * sans un mot, alors que le modèle venait de passer de longues secondes à
 * l'écrire.
 */
export type EchecArtefact = "tronque" | "illisible";

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
    if (parsed && typeof parsed.title === "string" && KIND_LIST.includes(parsed.kind)) {
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
};

/** Le flux est-il en train d'écrire un bloc d'artefact ? */
export function artefactEnCoursDEcriture(fluxPartiel: string): boolean {
  return fluxPartiel.includes("<!--ARTEFACT");
}
