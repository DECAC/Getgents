// Mini-application à STRUCTURE FIGÉE.
//
// À l'origine, « Update » faisait tout réécrire au modèle : sections, ordre,
// indicateurs. Deux générations ne se comparaient pas, et l'ancienne était
// écrasée. Ici, le créateur fige la structure d'un aperçu réussi (le
// GABARIT) ; chaque génération rend ensuite les mêmes blocs, à la même
// place, et l'état précédent est rangé en version.
//
// Le gabarit ne porte AUCUNE donnée — seulement la forme (types, titres,
// libellés, colonnes). L'aperçu du créateur est produit à partir de SES
// entrées (son CV, son profil) : en garder les valeurs les ferait relire par
// le modèle à chaque génération d'un visiteur.
//
// Module PUR.
import type { BlockWidth, DashboardBlock, DashboardSpec } from "@/lib/dashboardArtefact";
import type { PinnedArtefact, PinnedVersion } from "@/lib/types";

export interface GabaritBloc {
  id: string;
  type: DashboardBlock["type"];
  width?: BlockWidth;
  /** Titre du bloc (ou texte d'un intertitre) : c'est de la structure. */
  titre?: string;
  /** Libellés attendus : indicateurs, lignes clé-valeur, colonnes, séries. */
  champs?: string[];
  /** Variante d'un graphique. */
  variante?: string;
}

export interface GabaritMiniApp {
  blocs: GabaritBloc[];
}

export const MAX_VERSIONS_MINI_APP = 8;

const court = (t: string | undefined, max = 80) => (t ?? "").replace(/\s+/g, " ").trim().slice(0, max) || undefined;

function formeDuBloc(b: DashboardBlock, id: string): GabaritBloc {
  const base: GabaritBloc = { id, type: b.type, ...(b.width ? { width: b.width } : {}) };
  switch (b.type) {
    case "heading":
      return { ...base, titre: court(b.text) };
    case "stats":
      return { ...base, champs: b.items.map((i) => court(i.label, 40) ?? "") };
    case "kv":
      return { ...base, titre: court(b.title), champs: b.items.map((i) => court(i.label, 40) ?? "") };
    case "table":
      return { ...base, titre: court(b.title), champs: b.columns.map((c) => court(c, 40) ?? "") };
    case "chart":
      return { ...base, titre: court(b.title), variante: b.variant, champs: b.series.map((s) => court(s.label, 40) ?? "") };
    case "text":
      return base;
    default:
      return { ...base, titre: court(b.title) };
  }
}

/** La FORME d'un tableau réussi, sans ses données. `null` s'il n'a aucun bloc. */
export function figerGabarit(dashboard: DashboardSpec | null | undefined): GabaritMiniApp | null {
  const blocs = (dashboard?.blocks ?? []).map((b, i) => formeDuBloc(b, b.id ?? `b${i + 1}`));
  return blocs.length ? { blocs } : null;
}

/** Consigne jointe au prompt : rendre ces blocs, et eux seuls. */
export function consigneDonnees(gabarit: GabaritMiniApp): string {
  const lignes = gabarit.blocs.map((b) => {
    const details = [
      b.titre ? `titre « ${b.titre} »` : "",
      b.variante ? `variante ${b.variante}` : "",
      b.champs?.length ? `libellés : ${b.champs.join(" | ")}` : "",
      b.width ? `largeur ${b.width}` : "",
    ].filter(Boolean);
    return `- id "${b.id}" — type ${b.type}${details.length ? ` — ${details.join(" ; ")}` : ""}`;
  });
  return (
    "STRUCTURE FIGÉE : ce tableau de bord a une structure fixe, décidée par son créateur. " +
    `Rends EXACTEMENT ces ${gabarit.blocs.length} blocs, dans cet ordre, chacun avec son "id" et son "type" inchangés. ` +
    "N'en ajoute aucun, n'en retire aucun, n'en change pas le type. Garde les titres et les libellés indiqués ; " +
    "seules les DONNÉES (valeurs, lignes, textes, points) viennent des entrées de l'utilisateur. " +
    "Une donnée introuvable s'écrit « non renseigné » — elle ne s'invente pas.\n" +
    lignes.join("\n")
  );
}

export interface DonneesAppliquees {
  dashboard: DashboardSpec;
  /** Identifiants du gabarit que le modèle n'a pas rendus (ou d'un autre type). */
  manquants: string[];
  /** Blocs reçus hors gabarit, écartés. */
  ecartes: number;
}

/**
 * Le tableau reçu du modèle, ramené au gabarit : chaque bloc du gabarit est
 * pris s'il revient avec le même id ET le même type, à SA place ; un bloc
 * absent est signalé (jamais inventé), un bloc en trop est écarté. `null` si
 * aucun bloc du gabarit n'est revenu — la génération a échoué.
 */
export function appliquerDonnees(gabarit: GabaritMiniApp, recu: DashboardSpec | null | undefined): DonneesAppliquees | null {
  if (!recu) return null;
  const parId = new Map(recu.blocks.map((b) => [b.id ?? "", b]));
  const blocks: DashboardBlock[] = [];
  const manquants: string[] = [];
  for (const g of gabarit.blocs) {
    const b = parId.get(g.id);
    if (b && b.type === g.type) {
      const { width: _w, ...sansLargeur } = b;
      blocks.push({ ...sansLargeur, ...(g.width ? { width: g.width } : {}), id: g.id } as DashboardBlock);
    } else manquants.push(g.id);
  }
  if (!blocks.length) return null;
  const ecartes = recu.blocks.length - blocks.length;
  return { dashboard: { ...recu, blocks }, manquants, ecartes: Math.max(0, ecartes) };
}

/**
 * Remet à leur place les blocs manquants à partir du tableau PRÉCÉDENT :
 * une génération incomplète ne fait pas disparaître une section déjà
 * remplie. `ordre` est celui du gabarit.
 */
export function completerAvecPrecedent(
  dashboard: DashboardSpec,
  precedent: DashboardSpec | null | undefined,
  ordre: readonly string[]
): DashboardSpec {
  if (!precedent || !ordre.length) return dashboard;
  const neufs = new Map(dashboard.blocks.map((b) => [b.id ?? "", b]));
  const anciens = new Map(precedent.blocks.map((b) => [b.id ?? "", b]));
  const blocks = ordre.map((id) => neufs.get(id) ?? anciens.get(id)).filter((b): b is DashboardBlock => !!b);
  return blocks.length ? { ...dashboard, blocks } : dashboard;
}

/** Ce qui a changé entre deux tableaux, en une phrase. */
export function resumeChangement(avant: DashboardSpec | null | undefined, apres: DashboardSpec): string {
  if (!avant) return "première génération";
  const anciens = new Map(avant.blocks.map((b) => [b.id ?? "", JSON.stringify(b)]));
  let modifies = 0;
  let nouveaux = 0;
  for (const b of apres.blocks) {
    const a = anciens.get(b.id ?? "");
    if (a === undefined) nouveaux += 1;
    else if (a !== JSON.stringify(b)) modifies += 1;
  }
  const retires = avant.blocks.filter((b) => !apres.blocks.some((x) => x.id === b.id)).length;
  if (!modifies && !nouveaux && !retires) return "aucun changement";
  const pl = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
  return [
    modifies ? `${pl(modifies, "bloc")} mis à jour sur ${apres.blocks.length}` : "",
    nouveaux ? `${pl(nouveaux, "bloc")} ajouté${nouveaux > 1 ? "s" : ""}` : "",
    retires ? `${pl(retires, "bloc")} retiré${retires > 1 ? "s" : ""}` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

/** Le nouveau tableau prend la place ; l'ancien, s'il existe, est rangé. */
export function avecNouveauTableau(pinned: PinnedArtefact, dashboard: DashboardSpec, date: string): PinnedArtefact {
  const versions = pinned.dashboard
    ? [
        {
          n: (pinned.versions?.[0]?.n ?? 0) + 1,
          date: pinned.generatedAt,
          resume: resumeChangement(pinned.dashboard, dashboard),
          dashboard: pinned.dashboard,
        } satisfies PinnedVersion,
        ...(pinned.versions ?? []),
      ].slice(0, MAX_VERSIONS_MINI_APP)
    : pinned.versions;
  return { ...pinned, dashboard, generatedAt: date, ...(versions ? { versions } : {}) };
}

/**
 * Annule la dernière mise à jour : le tableau précédent revient, et celui
 * qu'on quitte est rangé à son tour — on peut revenir d'une annulation.
 */
export function annulerDerniereMiseAJour(pinned: PinnedArtefact): PinnedArtefact | null {
  const [derniere, ...reste] = pinned.versions ?? [];
  if (!derniere || !pinned.dashboard) return null;
  const rangee: PinnedVersion = {
    n: derniere.n + 1,
    date: pinned.generatedAt,
    resume: "annulée",
    dashboard: pinned.dashboard,
  };
  return {
    ...pinned,
    dashboard: derniere.dashboard,
    generatedAt: derniere.date,
    versions: [rangee, ...reste].slice(0, MAX_VERSIONS_MINI_APP),
  };
}
