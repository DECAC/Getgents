import { estFrequenceArtefacts, type FrequenceArtefacts } from "@/lib/artefactSignal";

/**
 * Mesure du cycle de vie des propositions d'artefact.
 *
 * Les verdicts « gardé / jeté » n'étaient enregistrés NULLE PART côté
 * serveur : on ne pouvait pas savoir si le gent proposait trop, trop peu, ni
 * lequel des modèles suivait mal la consigne. Tout réglage se faisait à
 * l'aveugle.
 *
 * On journalise des FAITS, jamais de contenu : ni texte de conversation, ni
 * titre d'artefact (il peut contenir une donnée personnelle), ni jeton de
 * lien. « Sans réponse » n'est pas un événement : il se déduit (proposés
 * moins gardés, remplacés et jetés).
 *
 * Module PUR : la validation est testable, la route ne fait qu'écrire.
 */

export type EvenementArtefact = "propose" | "garde" | "remplace" | "jete" | "perdu";

const EVENEMENTS: readonly EvenementArtefact[] = ["propose", "garde", "remplace", "jete", "perdu"];
const FORMES = ["report", "checklist", "chart", "visual", "map", "dashboard", "profile-summary", "image"] as const;
const ECHECS = ["tronque", "illisible"] as const;

export interface MesureArtefact {
  evenement: EvenementArtefact;
  mode: "espace" | "lien";
  forme?: (typeof FORMES)[number];
  echec?: (typeof ECHECS)[number];
  modele?: string;
  frequence?: FrequenceArtefacts;
  gent?: string;
}

/** Au-delà, ce n'est pas un événement de mesure : on refuse sans lire. */
export const TAILLE_MAX_MESURE = 1_000;

function court(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);
  return t || undefined;
}

/** Ne laisse passer qu'un événement connu, aux valeurs énumérées ou bornées. */
export function validerMesureArtefact(brut: unknown): MesureArtefact | null {
  const b = brut as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return null;
  if (!EVENEMENTS.includes(b.evenement as EvenementArtefact)) return null;
  if (b.mode !== "espace" && b.mode !== "lien") return null;
  const mesure: MesureArtefact = { evenement: b.evenement as EvenementArtefact, mode: b.mode };
  if ((FORMES as readonly unknown[]).includes(b.forme)) mesure.forme = b.forme as MesureArtefact["forme"];
  if ((ECHECS as readonly unknown[]).includes(b.echec)) mesure.echec = b.echec as MesureArtefact["echec"];
  // Identifiant OpenRouter : caractères d'un slug, rien d'autre.
  const modele = court(b.modele, 80);
  if (modele && /^[~a-z0-9._:/-]+$/i.test(modele)) mesure.modele = modele;
  if (estFrequenceArtefacts(b.frequence)) mesure.frequence = b.frequence;
  const gent = court(b.gent, 80);
  if (gent) mesure.gent = gent;
  return mesure;
}

/**
 * Envoi depuis le navigateur. `keepalive` : l'événement part même si la page
 * se ferme juste après le clic. Un échec est ignoré — la mesure ne doit jamais
 * gêner l'usage.
 */
export function mesurerArtefact(mesure: MesureArtefact): void {
  if (typeof window === "undefined") return;
  try {
    void fetch("/api/telemetrie/artefact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mesure),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // fetch indisponible : rien à faire.
  }
}

/**
 * Plafond par adresse et par minute. Une route publique qui écrit — même dans
 * un journal — se fait remplir par le premier script venu. En mémoire du
 * processus : sur des fonctions éphémères il ne tient pas une attaque
 * obstinée, il écarte la boucle accidentelle et le robot de passage, ce qui
 * suffit pour des lignes de journal.
 */
export const PLAFOND_MESURES_PAR_MINUTE = 60;

export function creerPlafond(max = PLAFOND_MESURES_PAR_MINUTE, fenetreMs = 60_000) {
  const compteurs = new Map<string, { debut: number; n: number }>();
  return function autoriser(cle: string, maintenant = Date.now()): boolean {
    const c = compteurs.get(cle);
    if (!c || maintenant - c.debut >= fenetreMs) {
      // Ménage opportuniste : la table ne grossit pas sans fin.
      if (compteurs.size > 5_000) compteurs.clear();
      compteurs.set(cle, { debut: maintenant, n: 1 });
      return true;
    }
    c.n += 1;
    return c.n <= max;
  };
}
