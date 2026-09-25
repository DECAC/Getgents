import type { Espace, PinnedArtefact } from "@/lib/types";
import { mergeVisionneuseArtefact } from "@/lib/publishedGents";

/**
 * L'espace personnel du créateur (GetSpace, `/espace/<id>`) tourne sur la
 * version DIFFUSÉE de son gent, avec SES données d'usage.
 *
 * Il tournait sur la version de TRAVAIL : chaque clic sur Preview y
 * propageait une modification en cours, et un essai raté cassait l'usage
 * quotidien. Désormais on modifie, on teste dans l'aperçu, et « Diffuser »
 * en fait la version du quotidien — comme pour n'importe quel visiteur.
 *
 * Les deux ne vivent pas au même endroit : la configuration est figée dans
 * la colonne `diffused`, alors que les conversations, artefacts et mémoire
 * s'écrivent dans la version de travail (`espace`). D'où les deux gestes :
 *   - LIRE : `composerVersionPersonnelle(diffusee, travail)` ;
 *   - ÉCRIRE : `fusionnerUsage(travail, espace)`, qui ne reporte QUE l'usage
 *     — sans cela, l'espace réécrirait la configuration diffusée par-dessus
 *     le travail en cours du studio, et le perdrait.
 *
 * Un gent jamais diffusé n'a que sa version de travail : c'est elle qui sert.
 *
 * Module PUR.
 */

/** Ce qui appartient à l'UTILISATEUR, et non à la configuration du gent. */
const CHAMPS_USAGE = [
  "memory",
  "conversations",
  "activeConversationId",
  "files",
  "themeTabs",
  "profile",
  "metrics",
  "integrations",
  "tools",
  "tabs",
  "map",
  // Tirées de la boîte mail du propriétaire : à lui, pas à la configuration.
  "amorcesContextuelles",
] as const satisfies readonly (keyof Espace)[];

function usagePinned(travail: PinnedArtefact | undefined, config: PinnedArtefact | undefined): PinnedArtefact | undefined {
  if (!config) return undefined;
  if (!travail) return config;
  // Les ENTRÉES sont définies par la configuration ; leurs VALEURS, et le
  // tableau de bord qu'elles ont produit, par l'utilisateur.
  const valeurs = new Map(travail.inputs.map((i) => [i.id, i.value]));
  return {
    ...config,
    inputs: config.inputs.map((i) => (valeurs.get(i.id) !== undefined ? { ...i, value: valeurs.get(i.id) } : i)),
    dashboard: travail.dashboard,
    generatedAt: travail.generatedAt,
    runs: travail.runs,
  };
}

/** Données d'usage d'un espace, à reporter sur une autre version du même gent. */
function reporterUsage(base: Espace, source: Espace): Espace {
  const sortie: Espace = { ...base };
  for (const champ of CHAMPS_USAGE) {
    (sortie as unknown as Record<string, unknown>)[champ] = source[champ];
  }
  // Le document d'une visionneuse est CONFIGURATION : il vient de `base` ;
  // tous les autres artefacts sont à l'utilisateur.
  sortie.artefacts = mergeVisionneuseArtefact(source.artefacts ?? [], base.artefacts ?? []);
  sortie.pinnedArtefact = usagePinned(source.pinnedArtefact, base.pinnedArtefact);
  sortie.routine = base.routine
    ? { ...base.routine, lastRunAt: source.routine?.lastRunAt, lastRunNote: source.routine?.lastRunNote }
    : undefined;
  sortie.channel = base.channel
    ? { ...base.channel, lastDeliveryNote: source.channel?.lastDeliveryNote }
    : undefined;
  // Déclencheurs : générés à la demande et coûteux (un appel au modèle) ; on
  // garde ceux qui existent déjà plutôt que d'en regénérer à chaque visite.
  if (!base.starters?.length && source.starters?.length) {
    sortie.starters = source.starters;
    sortie.startersGeneratedAt = source.startersGeneratedAt;
  }
  return sortie;
}

/** L'espace personnel : configuration diffusée + usage de la version de travail. */
export function composerVersionPersonnelle(diffusee: Espace | null | undefined, travail: Espace): Espace {
  if (!diffusee || typeof diffusee !== "object") return travail;
  return {
    ...reporterUsage(diffusee, travail),
    // La diffusion privée s'applique dès la case cochée, comme côté serveur :
    // lue sur la version de travail. Jamais RÉÉCRITE par l'espace (absente de
    // `fusionnerUsage`) : un onglet resté ouvert rouvrirait sinon un gent
    // qu'on vient de rendre privé.
    diffusionPrivee: travail.diffusionPrivee,
    adressePrivee: travail.adressePrivee,
  };
}

/**
 * Ce que l'espace personnel écrit : la version de TRAVAIL intacte, avec
 * l'usage à jour. La configuration du studio n'est jamais touchée.
 */
export function fusionnerUsage(travail: Espace, espace: Espace): Espace {
  return reporterUsage(travail, espace);
}
