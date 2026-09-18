/**
 * Lecture de l'état de jeu émis par un moteur déterministe.
 *
 * Le moteur termine chaque réponse par un bloc caché
 * `<!--ETAT_JEU: {"moteur":"elysee-2027","tour":3,…}-->`. On le retire du texte
 * visible — comme les blocs QUESTIONS ou FOLLOWUPS — et on en tire les valeurs
 * qui alimentent le bandeau de jauges.
 *
 * Tout est CALCULÉ ici, pas dans les composants : les seuils du jeu vivent
 * dans `lib/elysee2027/types.ts`, et une règle dupliquée dans du JSX finit
 * toujours par contredire le moteur.
 *
 * Module PUR — testable sans navigateur.
 */
import {
  JAUGES,
  SEUILS,
  type ConsequenceAffichee,
  type DecisionAffichee,
  type EtatJeuPublic,
  type Effets,
  type JaugeId,
} from "@/lib/elysee2027/types";

// Capture jusqu'au `-->` et non jusqu'à la première accolade fermante :
// l'état contient des objets imbriqués (les jauges), qu'une expression
// paresseuse couperait en plein milieu.
const ETAT_RE = /<!--\s*ETAT_JEU\s*:\s*([\s\S]*?)-->/g;
const ETAT_TRONQUE_RE = /<!--\s*ETAT_JEU\s*:[\s\S]*$/;

function estNombreJauge(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
}

function jaugesValides(v: unknown): v is Effets {
  if (!v || typeof v !== "object") return false;
  const rec = v as Record<string, unknown>;
  return JAUGES.every((j) => estNombreJauge(rec[j.id]));
}

function deltasValides(v: unknown): v is Effets {
  if (!v || typeof v !== "object") return false;
  const rec = v as Record<string, unknown>;
  return JAUGES.every((j) => typeof rec[j.id] === "number" && Number.isFinite(rec[j.id] as number));
}

function texteNonVide(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}


/**
 * La décision posée, telle que la surface de tour la dessine. Tout ce qui
 * n'est pas une chaîne exploitable est écarté : le composant ne teste rien.
 */
function decisionValide(v: unknown): DecisionAffichee | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const options = Array.isArray(o.options) ? o.options.filter(texteNonVide) : [];
  if (!texteNonVide(o.titre) || !texteNonVide(o.question) || options.length === 0) return undefined;
  return {
    theme: texteNonVide(o.theme) ? o.theme : "",
    titre: o.titre,
    ...(texteNonVide(o.lieu) ? { lieu: o.lieu } : {}),
    ...(texteNonVide(o.urgence) ? { urgence: o.urgence } : {}),
    ...(texteNonVide(o.scenette) ? { scenette: o.scenette } : {}),
    situation: texteNonVide(o.situation) ? o.situation : "",
    question: o.question,
    options,
  };
}

/** La conséquence encaissée, et l'unique action qui reste. */
function consequenceValide(v: unknown): ConsequenceAffichee | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  if (!texteNonVide(o.texte) || !texteNonVide(o.question) || !texteNonVide(o.action)) return undefined;
  return {
    choisi: texteNonVide(o.choisi) ? o.choisi : "",
    texte: o.texte,
    ...(texteNonVide(o.une) ? { une: o.une } : {}),
    ...(texteNonVide(o.reaction) ? { reaction: o.reaction } : {}),
    question: o.question,
    action: o.action,
  };
}

/**
 * Valide la forme avant de l'afficher. Un bloc mal formé est ignoré plutôt
 * que rendu à moitié : un bandeau qui affiche « NaN » est pire qu'un bandeau
 * absent.
 *
 * ATTENTION — cette fonction RECONSTRUIT l'objet champ par champ, elle ne le
 * laisse pas passer. Un champ ajouté au moteur et oublié ici disparaît en
 * silence : l'interface ne le voit jamais, et rien ne le signale. C'est
 * exactement ce qui est arrivé à la surface de tour.
 */
function etatValide(v: unknown): EtatJeuPublic | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.moteur !== "string" || !o.moteur) return null;
  if (typeof o.tour !== "number" || typeof o.duree !== "number" || o.duree <= 0) return null;
  if (!jaugesValides(o.jauges)) return null;
  const deltas = deltasValides(o.deltas) ? (o.deltas as Effets) : undefined;
  const derniers = Array.isArray(o.derniers)
    ? o.derniers
        .filter(
          (d): d is { tour: number; titre: string; choix: string; deltas: Effets } =>
            !!d &&
            typeof d === "object" &&
            typeof (d as Record<string, unknown>).tour === "number" &&
            typeof (d as Record<string, unknown>).titre === "string" &&
            deltasValides((d as Record<string, unknown>).deltas)
        )
        .map((d) => ({
          tour: d.tour,
          titre: d.titre,
          choix: typeof d.choix === "string" ? d.choix : "",
          deltas: d.deltas,
        }))
    : [];
  return {
    moteur: o.moteur,
    tour: o.tour,
    duree: o.duree,
    difficulte: (o.difficulte as EtatJeuPublic["difficulte"]) ?? "realiste",
    titre: typeof o.titre === "string" ? o.titre : "Président(e)",
    jauges: o.jauges,
    ...(deltas ? { deltas } : {}),
    serieVictoire: typeof o.serieVictoire === "number" ? o.serieVictoire : 0,
    ...(typeof o.fin === "string" ? { fin: o.fin as EtatJeuPublic["fin"] } : {}),
    ...(typeof o.finTitre === "string" ? { finTitre: o.finTitre } : {}),
    derniers,
    ...(decisionValide(o.decision) ? { decision: decisionValide(o.decision) } : {}),
    ...(consequenceValide(o.consequence) ? { consequence: consequenceValide(o.consequence) } : {}),
  };
}

/**
 * Retire tous les blocs ETAT_JEU du texte et renvoie le DERNIER état valide.
 * Le dernier, parce qu'une réponse peut être diffusée en plusieurs fragments
 * concaténés par le navigateur : c'est le plus récent qui décrit la partie.
 */
export function extractEtatJeu(raw: string): { text: string; etat: EtatJeuPublic | null } {
  let etat: EtatJeuPublic | null = null;
  let texte = raw.replace(ETAT_RE, (_tout, json: string) => {
    try {
      const candidat = etatValide(JSON.parse(json.trim()));
      if (candidat) etat = candidat;
    } catch {
      // bloc illisible : ignoré, le précédent reste en vigueur
    }
    return "";
  });
  // Bloc coupé en cours de diffusion : on le masque sans toucher au reste.
  texte = texte.replace(ETAT_TRONQUE_RE, "");
  return { text: texte.trim(), etat };
}

export type ZoneJauge = "alerte" | "recompense" | "normale";

export function zoneJauge(valeur: number): ZoneJauge {
  if (valeur <= SEUILS.alerteBasse) return "alerte";
  if (valeur >= SEUILS.alerteHaute) return "recompense";
  return "normale";
}

/** Vrai dès qu'une jauge est en zone d'alerte : le bandeau passe en tension. */
export function enTension(etat: EtatJeuPublic): boolean {
  return JAUGES.some((j) => zoneJauge(etat.jauges[j.id]) === "alerte");
}

export interface Menace {
  /** Nom de l'issue redoutée (« Révolution »…). */
  issue: string;
  jauge: JaugeId;
  label: string;
  valeur: number;
  seuil: number;
  /** Points restants avant l'issue. */
  marge: number;
}

const ISSUES: { issue: string; jauge: JaugeId; seuil: number }[] = [
  { issue: "Révolution", jauge: SEUILS.revolution.jauge, seuil: SEUILS.revolution.max },
  { issue: "Guerre civile", jauge: SEUILS.guerreCivile.jauge, seuil: SEUILS.guerreCivile.max },
  { issue: "Mise sous tutelle", jauge: SEUILS.tutelle.jauge, seuil: SEUILS.tutelle.max },
];

/**
 * La catastrophe la plus proche. C'est le ressort de tension du bandeau : le
 * joueur doit savoir en permanence par où son mandat peut tomber.
 */
export function menaceLaPlusProche(etat: EtatJeuPublic): Menace {
  return ISSUES.map((i) => ({
    issue: i.issue,
    jauge: i.jauge,
    label: JAUGES.find((j) => j.id === i.jauge)?.label ?? i.jauge,
    valeur: etat.jauges[i.jauge],
    seuil: i.seuil,
    marge: etat.jauges[i.jauge] - i.seuil,
  })).sort((a, b) => a.marge - b.marge)[0];
}

export interface Franchissement {
  jauge: JaugeId;
  label: string;
  sens: "alerte" | "recompense";
  valeur: number;
}

/**
 * Seuils FRANCHIS au tour qui vient d'être joué — pas les jauges simplement
 * basses. Une alerte répétée à chaque tour devient un bruit de fond qu'on
 * n'entend plus ; on ne signale que le passage.
 */
export function franchissements(etat: EtatJeuPublic): Franchissement[] {
  if (!etat.deltas) return [];
  const out: Franchissement[] = [];
  for (const j of JAUGES) {
    const delta = etat.deltas[j.id] ?? 0;
    const apres = etat.jauges[j.id];
    const avant = apres - delta;
    if (apres <= SEUILS.alerteBasse && avant > SEUILS.alerteBasse) {
      out.push({ jauge: j.id, label: j.label, sens: "alerte", valeur: apres });
    }
    if (apres >= SEUILS.alerteHaute && avant < SEUILS.alerteHaute) {
      out.push({ jauge: j.id, label: j.label, sens: "recompense", valeur: apres });
    }
  }
  return out;
}

/** Progression vers la victoire : les deux seuils, et la série en cours. */
export function objectifVictoire(etat: EtatJeuPublic): {
  bonheurAtteint: boolean;
  confianceAtteinte: boolean;
  serie: number;
  requis: number;
} {
  return {
    bonheurAtteint: etat.jauges.bonheur >= SEUILS.victoire.bonheur,
    confianceAtteinte: etat.jauges.confiance >= SEUILS.victoire.confiance,
    serie: etat.serieVictoire,
    requis: SEUILS.victoire.toursConsecutifs,
  };
}

/**
 * Couleur à donner à la fin de partie. Trois tons et non deux : un « bilan
 * mitigé » n'est pas une catastrophe, et l'annoncer en rouge avec une flamme
 * ferait croire au joueur qu'il a perdu alors qu'il a simplement fini.
 */
export function tonFin(fin: EtatJeuPublic["fin"]): "gagnee" | "perdue" | "neutre" {
  if (fin === "victoire" || fin === "victoire_mandat") return "gagnee";
  if (fin === "bilan_mitige" || !fin) return "neutre";
  return "perdue";
}
