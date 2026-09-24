import type { Artefact } from "@/lib/types";
import {
  avecIdentifiants,
  formeDeduite,
  ID_BLOC,
  lireBloc,
  parseDashboard,
  type DashboardBlock,
  type DashboardSpec,
} from "@/lib/dashboardArtefact";
import { reportSpecFromArtefact } from "@/lib/reportArtefact";

/**
 * RETOUCHES CIBLÉES d'un artefact à blocs.
 *
 * Demander « ajoute 2020 à la frise » faisait régénérer l'artefact entier :
 * chaque passe pouvait altérer en silence ce qu'on n'avait pas demandé de
 * toucher, et au bout de dix retouches l'artefact avait dérivé. Le modèle
 * émet désormais des OPÉRATIONS sur des blocs identifiés :
 *
 *   {"cible":"artef-123","operations":[
 *     {"op":"modifier","bloc":"b3","avec":{…bloc complet…}},
 *     {"op":"ajouter","apres":"b2","bloc":{…}},      // "apres":"debut", ou absent = à la fin
 *     {"op":"supprimer","bloc":"b4"},
 *     {"op":"deplacer","bloc":"b4","apres":"b1"}
 *   ]}
 *
 * Tout le reste de l'artefact est conservé À L'IDENTIQUE — c'est la garantie
 * qu'une régénération ne peut pas donner.
 *
 * Module PUR.
 */

export type OperationBloc =
  | { op: "modifier"; bloc: string; avec: DashboardBlock }
  | { op: "ajouter"; bloc: DashboardBlock; apres?: string }
  | { op: "supprimer"; bloc: string }
  | { op: "deplacer"; bloc: string; apres?: string };

const MAX_OPERATIONS = 20;
const MAX_BLOCS = 24;

function idValide(v: unknown): string | undefined {
  return typeof v === "string" && (ID_BLOC.test(v) || v === "debut") ? v : undefined;
}

/**
 * Valide les opérations reçues du modèle. Une opération mal formée est
 * écartée seule ; `null` si aucune ne tient.
 */
export function lireOperations(raw: unknown): OperationBloc[] | null {
  if (!Array.isArray(raw)) return null;
  const ops: OperationBloc[] = [];
  for (const brut of raw.slice(0, MAX_OPERATIONS)) {
    const o = brut as Record<string, unknown> | null;
    if (!o || typeof o !== "object") continue;
    const bloc = idValide(o.bloc);
    const apres = idValide(o.apres);
    if (o.op === "modifier" && bloc) {
      const avec = lireBloc(o.avec);
      if (avec) ops.push({ op: "modifier", bloc, avec });
    } else if (o.op === "ajouter") {
      const nouveau = lireBloc(o.bloc);
      if (nouveau) {
        const id = typeof (o.bloc as Record<string, unknown>)?.id === "string" ? String((o.bloc as Record<string, unknown>).id) : undefined;
        ops.push({ op: "ajouter", bloc: id ? { ...nouveau, id } : nouveau, apres });
      }
    } else if (o.op === "supprimer" && bloc) {
      ops.push({ op: "supprimer", bloc });
    } else if (o.op === "deplacer" && bloc) {
      ops.push({ op: "deplacer", bloc, apres });
    }
  }
  return ops.length ? ops : null;
}

const NOM_TYPE: Record<DashboardBlock["type"], string> = {
  heading: "titre",
  text: "texte",
  callout: "encadré",
  stats: "indicateurs",
  kv: "fiche",
  table: "tableau",
  chart: "graphique",
  timeline: "frise",
  checklist: "checklist",
  map: "carte",
};

/** Comment désigner un bloc à l'utilisateur : son titre s'il en a un, sinon son genre. */
export function nomDuBloc(b: DashboardBlock): string {
  const titre =
    "title" in b && b.title ? b.title : b.type === "heading" ? b.text : undefined;
  return titre ? `« ${titre.length > 40 ? `${titre.slice(0, 39)}…` : titre} »` : `le bloc ${NOM_TYPE[b.type]}`;
}

export interface ResultatOperations {
  spec: DashboardSpec;
  /** Phrase lisible : « « Parcours » modifié, checklist ajoutée ». */
  resume: string;
  /** Blocs modifiés ou ajoutés — ceux qu'on met en évidence dans l'aperçu. */
  blocsTouches: string[];
  /** Opérations qui n'ont pu s'appliquer (bloc introuvable, plafond atteint). */
  ignorees: number;
}

function normal(t: string | undefined): string {
  return (t ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function titreDe(b: DashboardBlock): string | undefined {
  return "title" in b ? b.title : undefined;
}

/**
 * Le bloc existant dans lequel un AJOUT doit se fondre, s'il y en a un.
 *
 * Vécu : « ajoute Maltem avant Cegedim » a produit une SECONDE frise
 * « Parcours » au-dessus de la première, au lieu d'une étape de plus. La
 * consigne demande de modifier le bloc existant ; ce garde-fou rattrape le
 * modèle qui ne l'a pas fait. Seulement pour les blocs-listes (frise,
 * checklist, carte, fiche, tableau aux mêmes colonnes), et seulement sans
 * ambiguïté : même titre, ou pas de titre face à un unique bloc de ce genre.
 */
function cibleDeFusion(blocs: DashboardBlock[], nouveau: DashboardBlock): number {
  const LISTES = new Set(["timeline", "checklist", "map", "kv", "table"]);
  if (!LISTES.has(nouveau.type)) return -1;
  const memes = blocs
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.type === nouveau.type)
    .filter(({ b }) =>
      b.type === "table" && nouveau.type === "table"
        ? b.columns.map(normal).join("|") === nouveau.columns.map(normal).join("|")
        : true
    );
  const titre = normal(titreDe(nouveau));
  if (titre) {
    const homonymes = memes.filter(({ b }) => normal(titreDe(b)) === titre);
    return homonymes.length === 1 ? homonymes[0].i : -1;
  }
  return memes.length === 1 ? memes[0].i : -1;
}

/** Fond les éléments de `ajout` dans `cible`, en tête ou à la fin, sans doublon d'intitulé. */
function fusionner(cible: DashboardBlock, ajout: DashboardBlock, enTete: boolean): DashboardBlock {
  const joindre = <T,>(existants: T[], nouveaux: T[], cle: (x: T) => string, max: number): T[] => {
    const deja = new Set(existants.map(cle));
    const frais = nouveaux.filter((x) => !deja.has(cle(x)));
    return (enTete ? [...frais, ...existants] : [...existants, ...frais]).slice(0, max);
  };
  if (cible.type === "timeline" && ajout.type === "timeline") {
    return { ...cible, items: joindre(cible.items, ajout.items, (x) => normal(x.label), 12) };
  }
  if (cible.type === "checklist" && ajout.type === "checklist") {
    return { ...cible, items: joindre(cible.items, ajout.items, (x) => normal(x.label), 30) };
  }
  if (cible.type === "map" && ajout.type === "map") {
    return { ...cible, points: joindre(cible.points, ajout.points, (x) => normal(x.label), 25) };
  }
  if (cible.type === "kv" && ajout.type === "kv") {
    return { ...cible, items: joindre(cible.items, ajout.items, (x) => normal(x.label), 24) };
  }
  if (cible.type === "table" && ajout.type === "table") {
    return { ...cible, rows: joindre(cible.rows, ajout.rows, (r) => r.map(normal).join("|"), 40) };
  }
  return cible;
}

function inserer(blocs: DashboardBlock[], bloc: DashboardBlock, apres?: string): DashboardBlock[] | null {
  if (apres === "debut") return [bloc, ...blocs];
  if (!apres) return [...blocs, bloc];
  const i = blocs.findIndex((b) => b.id === apres);
  if (i < 0) return null;
  return [...blocs.slice(0, i + 1), bloc, ...blocs.slice(i + 1)];
}

/**
 * Applique les opérations une à une, sur une COPIE. Une opération qui vise un
 * bloc absent est ignorée et comptée, jamais devinée : mieux vaut une retouche
 * incomplète et annoncée qu'un bloc modifié au hasard. `null` si rien n'a pu
 * s'appliquer.
 */
export function appliquerOperations(spec: DashboardSpec, ops: OperationBloc[]): ResultatOperations | null {
  let blocs = avecIdentifiants(spec.blocks);
  const faits: string[] = [];
  const touches = new Set<string>();
  let ignorees = 0;

  for (const op of ops) {
    if (op.op === "modifier") {
      const i = blocs.findIndex((b) => b.id === op.bloc);
      if (i < 0) {
        ignorees += 1;
        continue;
      }
      // Même identifiant : la place et la référence du bloc ne bougent pas.
      blocs = blocs.map((b, j) => (j === i ? { ...op.avec, id: op.bloc } : b));
      touches.add(op.bloc);
      faits.push(`${nomDuBloc(blocs[i])} modifié`);
    } else if (op.op === "ajouter") {
      const iFusion = cibleDeFusion(blocs, op.bloc);
      if (iFusion >= 0) {
        // Placé AVANT le bloc existant, l'ajout voulait ses éléments en tête
        // (« avant Cegedim ») ; après, à la fin.
        const iAncre = op.apres === "debut" ? -1 : op.apres ? blocs.findIndex((b) => b.id === op.apres) : blocs.length;
        const enTete = iAncre < iFusion;
        const cible = blocs[iFusion];
        blocs = blocs.map((b, j) => (j === iFusion ? fusionner(cible, op.bloc, enTete) : b));
        touches.add(cible.id!);
        faits.push(`${nomDuBloc(cible)} complété`);
        continue;
      }
      if (blocs.length >= MAX_BLOCS) {
        ignorees += 1;
        continue;
      }
      // L'identifiant proposé s'il est libre, sinon le premier bN libre.
      const pris = new Set(blocs.map((b) => b.id));
      let id = op.bloc.id && ID_BLOC.test(op.bloc.id) && !pris.has(op.bloc.id) ? op.bloc.id : undefined;
      for (let n = 1; !id; n += 1) if (!pris.has(`b${n}`)) id = `b${n}`;
      const nouveau: DashboardBlock = { ...op.bloc, id };
      const suite = inserer(blocs, nouveau, op.apres);
      if (!suite) {
        ignorees += 1;
        continue;
      }
      blocs = suite;
      touches.add(nouveau.id!);
      faits.push(`${nomDuBloc(nouveau)} ajouté`);
    } else if (op.op === "supprimer") {
      const bloc = blocs.find((b) => b.id === op.bloc);
      if (!bloc) {
        ignorees += 1;
        continue;
      }
      blocs = blocs.filter((b) => b.id !== op.bloc);
      touches.delete(op.bloc);
      faits.push(`${nomDuBloc(bloc)} supprimé`);
    } else {
      const bloc = blocs.find((b) => b.id === op.bloc);
      if (!bloc || op.apres === op.bloc) {
        ignorees += 1;
        continue;
      }
      const suite = inserer(
        blocs.filter((b) => b.id !== op.bloc),
        bloc,
        op.apres
      );
      if (!suite) {
        ignorees += 1;
        continue;
      }
      blocs = suite;
      faits.push(`${nomDuBloc(bloc)} déplacé`);
    }
  }

  if (!faits.length) return null;
  if (!blocs.length) return null;
  return {
    spec: { ...spec, blocks: blocs },
    resume: faits.join(", "),
    blocsTouches: Array.from(touches),
    ignorees,
  };
}

/**
 * L'artefact sous forme de blocs, quel que soit son format d'origine. C'est
 * ce qui rend RETOUCHABLE un artefact gardé avant le vocabulaire unique :
 * checklist, graphique, carte ou rapport historiques deviennent des blocs.
 * `null` pour ce qui n'en a pas l'équivalent (résumé de profil, image).
 */
export function versBlocs(a: Artefact): DashboardSpec | null {
  if (a.profileSummary || a.imageUrl) return null;
  if (a.dashboard?.blocks.length) return { ...a.dashboard, blocks: avecIdentifiants(a.dashboard.blocks) };
  const blocs: DashboardBlock[] = [];
  const rapport = reportSpecFromArtefact(a);
  if (rapport) blocs.push(...rapport.blocks);
  if (a.checklistItems?.length) {
    blocs.push({ type: "checklist", items: a.checklistItems.map((i) => ({ label: i.label, checked: i.checked })) });
  }
  if (a.chartData?.length) {
    blocs.push({
      type: "chart",
      variant: "bar",
      xKey: "label",
      series: [{ key: "value", label: a.title }],
      data: a.chartData.map((d) => ({ label: d.label, value: d.value })),
    });
  }
  if (a.mapPoints?.length) {
    blocs.push({
      type: "map",
      points: a.mapPoints.map((p) => ({ label: p.label, lat: p.lat, lon: p.lon, description: p.description })),
    });
  }
  return blocs.length ? { blocks: avecIdentifiants(blocs) } : null;
}

/** Budget du contexte d'artefacts, en caractères, sur l'ensemble et par artefact. */
const BUDGET_TOTAL = 8_000;
const BUDGET_ARTEFACT = 3_000;
const MAX_ARTEFACTS = 5;

function blocResume(b: DashboardBlock): string {
  const titre = "title" in b && b.title ? `,"title":${JSON.stringify(b.title)}` : "";
  return `{"id":"${b.id}","type":"${b.type}"${titre}} (contenu omis)`;
}

/**
 * Ce que le modèle doit voir pour RETOUCHER : les artefacts gardés, avec
 * l'identifiant et le contenu de chaque bloc. Borné — au-delà du budget, un
 * bloc n'est plus décrit que par son identifiant et son titre : on peut
 * encore le supprimer, le déplacer ou le remplacer entièrement.
 *
 * Chaîne vide quand il n'y a rien de retouchable.
 */
export function contexteArtefacts(artefacts: readonly Artefact[]): string {
  const lignes: string[] = [];
  let total = 0;
  for (const a of artefacts.slice(0, MAX_ARTEFACTS)) {
    const spec = versBlocs(a);
    if (!spec) continue;
    const entete = `- artefact "${a.id}" « ${a.title} » (${formeDeduite(spec)}) :`;
    const blocs: string[] = [];
    let taille = entete.length;
    for (const b of spec.blocks) {
      const complet = JSON.stringify(b);
      const choisi = taille + complet.length <= BUDGET_ARTEFACT ? complet : blocResume(b);
      blocs.push(choisi);
      taille += choisi.length;
    }
    const ligne = `${entete}\n  ${blocs.join("\n  ")}`;
    if (total + ligne.length > BUDGET_TOTAL) break;
    lignes.push(ligne);
    total += ligne.length;
  }
  return lignes.join("\n");
}

/**
 * Transforme une retouche reçue du modèle en PROPOSITION : l'artefact visé
 * (par identifiant, à défaut par titre), son contenu une fois les opérations
 * appliquées, et ce qui a changé. `null` si l'artefact ou tous les blocs visés
 * sont introuvables — l'appelant l'annonce, il ne devine pas.
 */
export function resoudreRetouche(
  artefacts: readonly Artefact[],
  cible: string,
  operations: OperationBloc[]
): import("@/lib/types").ArtefactProposal | null {
  const normal = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();
  const vise =
    artefacts.find((a) => a.id === cible) ?? artefacts.find((a) => normal(a.title) === normal(cible));
  if (!vise) return null;
  const base = versBlocs(vise);
  if (!base) return null;
  const res = appliquerOperations(base, operations);
  if (!res) return null;
  return {
    kind: "dashboard",
    title: vise.title,
    dashboard: res.spec,
    modification: {
      artefactId: vise.id,
      resume: res.resume,
      blocsTouches: res.blocsTouches,
      ignorees: res.ignorees,
    },
  };
}

/**
 * L'artefact après une édition À LA MAIN : ses blocs remplacent tout format
 * historique (checklist, graphique, carte, rapport), repassés par la même
 * validation que ce que produit le modèle — la main de l'utilisateur n'est
 * pas plus fiable qu'un modèle pour les bornes et les identifiants.
 */
export function artefactDepuisBlocs(a: Artefact, spec: DashboardSpec, titre: string): Artefact | null {
  const propre = parseDashboard(JSON.parse(JSON.stringify(spec)));
  if (!propre) return null;
  return {
    id: a.id,
    title: titre.replace(/\s+/g, " ").trim().slice(0, 140) || a.title,
    type: formeDeduite(propre),
    icon: a.icon,
    date: a.date,
    kind: "dashboard",
    dashboard: propre,
    versions: a.versions,
  };
}
