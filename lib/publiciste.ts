/**
 * Gent « Le Publiciste » (lot 1, 27/11) : la conversation mène l'entretien
 * (le fond, puis la forme) et écrit le STORYBOARD d'un film court ; l'atelier
 * (components/publiciste/AtelierFilm.tsx) le fait dire par une voix Mistral,
 * l'assemble et fabrique le MP4 DANS LE NAVIGATEUR (WebCodecs). Voir
 * mockups/recit/premier-couteau-brief.md.
 *
 * Comme le Prompteur, la consigne ne règle que la FORME de la sortie : le
 * storyboard voyage entre deux marqueurs, en JSON, et n'est jamais affiché
 * tel quel — un bouton « Atelier du film » sous la réponse l'ouvre.
 *
 * Module PUR : aucune dépendance au navigateur ni au serveur.
 */

export const MARQUEUR_STORYBOARD = "<!--STORYBOARD-->";
export const MARQUEUR_STORYBOARD_FIN = "<!--/STORYBOARD-->";

/** Bornes d'un storyboard. Un film pour les réseaux : court. */
export const SCENES_MIN = 2;
export const SCENES_MAX = 20;
export const DUREE_SCENE_MIN = 2;
export const DUREE_SCENE_MAX = 20;
export const DUREE_FILM_MAX = 180;
/** Débit de parole d'une voix posée : sert à dire au modèle combien écrire. */
export const MOTS_PAR_SECONDE = 2.3;

export interface SceneFilm {
  titre: string;
  /** Durée voulue, en secondes. L'atelier l'allonge si la voix dure plus. */
  duree: number;
  /** Ce qu'on voit : description de l'image, pour l'auteur et le futur générateur. */
  voit: string;
  /** Texte dit par la voix sur cette scène (vide : pas de voix). */
  voix: string;
  /** Sons et musique (indication, pas encore produite). */
  son: string;
}

export interface Storyboard {
  titre: string;
  scenes: SceneFilm[];
}

const texte = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** Valide et nettoie un storyboard venu du modèle. Rend null s'il est inutilisable. */
export function validerStoryboard(brut: unknown): Storyboard | null {
  if (!brut || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const scenesBrutes = Array.isArray(o.scenes) ? o.scenes : [];
  const scenes: SceneFilm[] = [];
  for (const s of scenesBrutes.slice(0, SCENES_MAX)) {
    if (!s || typeof s !== "object") continue;
    const r = s as Record<string, unknown>;
    const d = typeof r.duree === "number" ? r.duree : typeof r.duree === "string" ? parseFloat(r.duree.replace(",", ".")) : NaN;
    const scene: SceneFilm = {
      titre: texte(r.titre, 80),
      duree: Number.isFinite(d) ? Math.min(DUREE_SCENE_MAX, Math.max(DUREE_SCENE_MIN, Math.round(d * 10) / 10)) : 5,
      voit: texte(r.voit, 400),
      voix: texte(r.voix, 300),
      son: texte(r.son, 200),
    };
    if (!scene.titre && !scene.voit && !scene.voix) continue;
    if (!scene.titre) scene.titre = `Scène ${scenes.length + 1}`;
    scenes.push(scene);
  }
  if (scenes.length < SCENES_MIN) return null;
  // Un film trop long est raccourci par la fin plutôt que refusé : l'auteur voit ce qui reste.
  let total = 0;
  const gardees = scenes.filter((s) => (total += s.duree) <= DUREE_FILM_MAX);
  if (gardees.length < SCENES_MIN) return null;
  return { titre: texte(o.titre, 100) || "Mon film", scenes: gardees };
}

/**
 * Retire de la réponse le bloc du storyboard (le DERNIER, s'il y en a
 * plusieurs : c'est la version la plus récente) et le rend validé. Un bloc
 * illisible est retiré quand même — du JSON brut n'a rien à faire à l'écran.
 */
export function extraireStoryboard(raw: string): { text: string; storyboard?: Storyboard } {
  const motif = /<!--STORYBOARD-->([\s\S]*?)<!--\/STORYBOARD-->/g;
  let dernier: string | null = null;
  for (const m of raw.matchAll(motif)) dernier = m[1];
  // Bloc ouvert mais jamais fermé (réponse coupée) : on retire la fin aussi.
  let text = raw.replace(motif, "");
  const ouvert = text.indexOf(MARQUEUR_STORYBOARD);
  if (ouvert >= 0) text = text.slice(0, ouvert);
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  if (dernier === null) return { text };
  const json = dernier.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const storyboard = validerStoryboard(JSON.parse(json));
    return storyboard ? { text, storyboard } : { text };
  } catch {
    return { text };
  }
}

export function dureeTotale(sb: Storyboard): number {
  return Math.round(sb.scenes.reduce((a, s) => a + s.duree, 0) * 10) / 10;
}

/** Consigne de FORME jointe au prompt du gent. Elle ne décide ni du ton ni du fond. */
export function consignePubliciste(): string {
  return (
    "RÔLE PUBLICISTE : tu aides l'utilisateur à faire un film court (30 à 90 secondes) pour sa marque, " +
    "à publier sur les réseaux sociaux et sur son site. " +
    "Commence par un ENTRETIEN, une question à la fois : d'abord le FOND (ce qu'il vend, à qui, le souvenir ou l'émotion au cœur de sa marque, " +
    "ce que doit ressentir celui qui regarde, ce qu'il ne faut surtout pas dire), puis la FORME (où le film sera vu, sa durée, le ton). " +
    "Reformule ce que tu as compris avant de proposer. Ne pose pas plus de six ou sept questions en tout. " +
    "Puis propose le STORYBOARD : une histoire en scènes, avec pour chacune ce qu'on voit, le texte dit par la voix off, et les sons. " +
    `La voix off doit tenir dans la scène : au plus ${MOTS_PAR_SECONDE} mots par seconde de scène, et laisse des scènes sans voix pour respirer. ` +
    "Écris la voix off pour être DITE : phrases courtes, langue parlée, ni émoji ni hashtag. Évite les points de suspension, la voix les lit mal. " +
    `Chaque fois que tu donnes une version COMPLÈTE du storyboard, ajoute-la à la fin de ta réponse, entre ${MARQUEUR_STORYBOARD} et ${MARQUEUR_STORYBOARD_FIN}, ` +
    "chacun seul sur sa ligne, en JSON strict : " +
    '{"titre": "…", "scenes": [{"titre": "…", "duree": 6, "voit": "…", "voix": "…", "son": "…"}]} ' +
    `(${SCENES_MIN} à ${SCENES_MAX} scènes, durée en secondes, entre ${DUREE_SCENE_MIN} et ${DUREE_SCENE_MAX}, « voix » vide pour une scène muette). ` +
    "Ce bloc n'est pas affiché : présente aussi le storyboard en clair dans ta réponse, scène par scène, brièvement. " +
    "L'utilisateur l'ouvre d'un bouton « Atelier du film », sous ta réponse, où il choisit la voix et fabrique le film : ne lui demande jamais de recopier quoi que ce soit."
  );
}

export const PROMPT_PUBLICISTE_DEFAUT =
  "Tu es mon publiciste. Tu m'aides à raconter ma marque dans un film court, sincère et mémorable. " +
  "Tu cherches l'histoire vraie derrière ce que je vends, plutôt que la liste de mes produits. " +
  "Tu me dis franchement quand une idée sonne comme une publicité banale, et tu proposes mieux.";

/** Voix françaises toutes prêtes de Mistral (voxtral-mini-tts-3-0), relevées le 27/11. Toutes féminines. */
export const VOIX_PUBLICISTE = [
  { id: "marie", nom: "Marie", mistral: "01a1536e-a46c-7101-b6e9-1ebda46309fd" },
  { id: "manon", nom: "Manon", mistral: "01a151d2-8c33-7781-a14d-bd91dd8426cc" },
  { id: "lea", nom: "Léa", mistral: "01a151d2-8c29-766d-9ca2-30f33707cef6" },
  { id: "camille", nom: "Camille", mistral: "01a151d2-8c1f-75cf-8cdf-20f328c00764" },
] as const;
export type VoixPubliciste = (typeof VOIX_PUBLICISTE)[number]["id"];
export const VOIX_PAR_DEFAUT: VoixPubliciste = "marie";
export const TEXTE_VOIX_MAX = 400;

export function voixMistral(id: string): string | null {
  return VOIX_PUBLICISTE.find((v) => v.id === id)?.mistral ?? null;
}

/**
 * Texte envoyé à la synthèse : les points de suspension font improviser
 * Voxtral (vécu au casting : « et vlan ! », « Montrez-nous sa grandeur ») —
 * remplacés par une virgule, la pause reste.
 */
export function texteADire(voix: string): string {
  return voix
    .replace(/\s*(?:…|\.{3,})\s*/g, ", ")
    .replace(/,\s*([.!?])/g, "$1")
    .replace(/,\s*$/, ".")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TEXTE_VOIX_MAX);
}
