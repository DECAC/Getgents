/**
 * Publiciste, lot 4 : le storyboard de la maquette (`mockups/recit/publiciste/index.html`,
 * vue « storyboard ») — l'histoire en scènes, chacune avec son croquis, sa
 * voix, ce qu'on voit, ce qu'on entend et le passage à la suivante ;
 * l'animatique ; la validation de la direction.
 *
 * Le texte vient d'UN appel au modèle (JSON validé ici). L'auteur corrige
 * directement chaque scène ; pour ajouter, supprimer, déplacer, il écrit ses
 * remarques et le Publiciste propose un storyboard RÉVISÉ, dont les
 * différences sont montrées avant de remplacer quoi que ce soit. Seules les
 * scènes dont « On voit » a changé sont redessinées.
 *
 * Croquis : `gemini-3.1-flash-lite-image` en 9:16 — mesuré le 27/11 : 3 s,
 * 0,034 $, JPEG 768×1376 (la maquette annonçait ≈ 0,035 $).
 *
 * Module PUR.
 */
import type { FichePubliciste } from "@/lib/publiciste";
import { resumeFiche } from "@/lib/publicisteDirection";

export const MODELE_CROQUIS = "google/gemini-3.1-flash-lite-image";
export const FORMAT_CROQUIS = "9:16";
export const COUT_CROQUIS_ESTIME = 0.034;
export const SCENES_MAX = 16;
export const VO_MAX = 300;

export interface TexteScene {
  voit: string;
  vo: string;
  entend: string;
  trans: string;
}

export interface Scene extends TexteScene {
  id: string;
  titre: string;
  /** Durée prévue, en secondes. */
  duree: number;
  /** Le texte tel que le Publiciste l'a écrit : « Revenir au texte d'origine ». */
  origine: TexteScene;
  /** Le croquis (fichier du projet) et le « On voit » qu'il dessine. */
  croquis?: string;
  dessine?: string;
  coutCroquis?: number;
}

export interface Revision {
  bulle: string[];
  scenes: Scene[];
  /** Ce que l'auteur avait demandé (remarques + scènes modifiées). */
  demande: string;
}

export interface Storyboard {
  bulle: string[];
  scenes: Scene[];
  /** « Vos remarques sur l'ensemble ». */
  commentaire: string;
  /** Un storyboard révisé, proposé, pas encore accepté. */
  revision?: Revision;
  /** L'état avant la dernière révision acceptée (« Annuler »). */
  precedent?: { bulle: string[]; scenes: Scene[] };
}

const txt = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const CHAMPS = ["voit", "vo", "entend", "trans"] as const;
const LIMITES: Record<(typeof CHAMPS)[number], number> = { voit: 600, vo: VO_MAX, entend: 300, trans: 200 };
const fichier = (v: unknown, prefixe: string) => (typeof v === "string" && new RegExp(`^${prefixe}-[a-z0-9-]{1,80}$`).test(v) ? v : undefined);
const texteScene = (o: Record<string, unknown>): TexteScene => ({
  voit: txt(o.voit, LIMITES.voit),
  vo: txt(o.vo, LIMITES.vo),
  entend: txt(o.entend, LIMITES.entend),
  trans: txt(o.trans, LIMITES.trans),
});

/** Une liste de scènes (réponse du modèle ou état enregistré). Les identifiants sont gardés s'ils sont propres, sinon refaits. */
export function validerScenes(brut: unknown, garderFichiers = true, revision = false): Scene[] | null {
  if (!Array.isArray(brut)) return null;
  const vus = new Set<string>();
  const scenes: Scene[] = [];
  for (const [i, s] of brut.slice(0, SCENES_MAX).entries()) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const t = texteScene(o);
    const titre = txt(o.titre, 80);
    if (!titre || !t.voit) continue;
    // Dans une révision, une scène nouvelle s'appelle « n… » : jamais confondue avec une scène existante.
    let id = typeof o.id === "string" && (revision ? /^[sn][a-z0-9]{1,12}$/ : /^s[a-z0-9]{1,12}$/).test(o.id) ? o.id : `${revision ? "n" : "s"}${i + 1}`;
    while (vus.has(id)) id = `s${Math.random().toString(36).slice(2, 8)}`;
    vus.add(id);
    const duree = Math.min(20, Math.max(2, Math.round((Number(o.duree) || 5) * 10) / 10));
    const orig = o.origine && typeof o.origine === "object" ? texteScene(o.origine as Record<string, unknown>) : t;
    const croquis = garderFichiers ? fichier(o.croquis, "croquis") : undefined;
    const cout = typeof o.coutCroquis === "number" && Number.isFinite(o.coutCroquis) && o.coutCroquis >= 0 ? Math.min(o.coutCroquis, 5) : undefined;
    scenes.push({
      id,
      titre,
      duree,
      ...t,
      origine: orig,
      ...(croquis ? { croquis, dessine: txt(o.dessine, LIMITES.voit) || orig.voit } : {}),
      ...(croquis && cout !== undefined ? { coutCroquis: cout } : {}),
    });
  }
  return scenes.length >= 2 ? scenes : null;
}

const bulleDe = (v: unknown) => (Array.isArray(v) ? v : [v]).map((b) => txt(b, 900)).filter(Boolean).slice(0, 2);

/** La réponse du modèle : {bulle, scenes}. Les scènes neuves prennent leur texte comme origine. */
export function validerReponseStoryboard(brut: unknown, revision = false): { bulle: string[]; scenes: Scene[] } | null {
  if (!brut || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const scenes = validerScenes(
    (Array.isArray(o.scenes) ? o.scenes : []).map((s) => (s && typeof s === "object" ? { ...(s as object), origine: undefined, croquis: undefined } : s)),
    false,
    revision
  );
  const bulle = bulleDe(o.bulle);
  if (!scenes || !bulle.length) return null;
  return { bulle, scenes };
}

/** L'état enregistré du storyboard. */
export function validerStoryboard(brut: unknown): Storyboard | undefined {
  if (!brut || typeof brut !== "object") return undefined;
  const o = brut as Record<string, unknown>;
  const scenes = validerScenes(o.scenes);
  if (!scenes) return undefined;
  const sb: Storyboard = { bulle: bulleDe(o.bulle), scenes, commentaire: txt(o.commentaire, 2000) };
  const r = o.revision as Record<string, unknown> | undefined;
  const rs = r ? validerScenes(r.scenes) : null;
  if (r && rs) sb.revision = { bulle: bulleDe(r.bulle), scenes: rs, demande: txt(r.demande, 2500) };
  const p = o.precedent as Record<string, unknown> | undefined;
  const ps = p ? validerScenes(p.scenes) : null;
  if (p && ps) sb.precedent = { bulle: bulleDe(p.bulle), scenes: ps };
  return sb;
}

export const dureeTotale = (scenes: Pick<Scene, "duree">[]) => Math.round(scenes.reduce((a, s) => a + s.duree, 0));
export const sceneModifiee = (s: Scene) => CHAMPS.some((k) => s[k] !== s.origine[k]);
export const aRedessiner = (s: Scene) => !s.croquis || s.dessine !== s.voit;

/** Durée visée, lue dans la forme pressentie (« un film d'une minute », « 45 s »), sinon 60 s. */
export function dureeVisee(forme: string | undefined): number {
  const f = (forme ?? "").toLowerCase();
  const s = /(\d{2,3})\s*(s\b|sec)/.exec(f);
  if (s) return Math.min(120, Math.max(15, Number(s[1])));
  const m = /(\d+(?:[.,]\d+)?)\s*min/.exec(f);
  if (m) return Math.min(120, Math.max(15, Math.round(Number(m[1].replace(",", ".")) * 60)));
  if (/une minute|1 minute/.test(f)) return 60;
  if (/trente secondes/.test(f)) return 30;
  return 60;
}

export interface ContexteStoryboard {
  univers?: { nom: string; desc: string };
  musique?: { nom: string; ressenti: string };
  voix?: string;
  jeu?: string;
}

const contexte = (fiche: FichePubliciste, c: ContexteStoryboard) =>
  `CE QUE LE BRIEF A ÉTABLI :\n${resumeFiche(fiche) || "(fiche encore vide)"}\n` +
  (c.univers ? `\nUnivers visuel choisi : ${c.univers.nom} — ${c.univers.desc}` : "") +
  (c.musique ? `\nMusique choisie : ${c.musique.nom} — ${c.musique.ressenti}` : "") +
  (c.voix ? `\nVoix de la narration : ${c.voix}${c.jeu ? ` (jeu : ${c.jeu})` : ""}` : "");

const FORMAT =
  'Format : {"bulle": ["comment tu as construit le récit, en deux phrases", "ce que l\'auteur peut corriger, ou ce qui reste à trancher, en une ou deux phrases"], ' +
  '"scenes": [{"id": "s1", "titre": "titre court de la scène", "duree": secondes, "voit": "ce qu\'on voit : cadrage et action, une ou deux phrases", ' +
  '"vo": "la phrase dite par la voix sur cette scène, ou chaîne vide", "entend": "sons et musique, ou chaîne vide", "trans": "le passage à la scène suivante, quelques mots"}]}';

/** Écrire le storyboard (première fois). */
export function consigneStoryboard(fiche: FichePubliciste, c: ContexteStoryboard): string {
  const duree = dureeVisee(fiche.forme.forme);
  return (
    "Tu es le Publiciste. La direction artistique est choisie ; tu écris maintenant le STORYBOARD : l'histoire en scènes. " +
    "Tu écris en français, au vouvoiement. Une histoire vraie et incarnée, tirée du cœur du brief — jamais une liste de produits ni un slogan publicitaire. " +
    "Le récit doit se comprendre sans le son ; la voix dit peu, avec des silences ; chaque phrase dite tient en une ligne (12 mots au plus) et se lit en moins de quatre secondes. " +
    `Vise environ ${duree} secondes au total, en 6 à ${Math.min(SCENES_MAX, 12)} scènes de 3 à 9 secondes. La dernière scène dit ce que fait celui qui regarde (sans prix inventé). ` +
    "N'invente aucun fait sur la marque que le brief ne donne pas. Tu réponds UNIQUEMENT par un objet JSON valide, sans texte autour.\n\n" +
    contexte(fiche, c) +
    "\n\n" +
    FORMAT
  );
}

/** Ce qui a changé dans les scènes, dit au modèle et gardé dans la révision. */
export function demandeRevision(scenes: Scene[], commentaire: string): string {
  const mod = scenes
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => sceneModifiee(s))
    .map(({ s, i }) => `Scène ${i + 1} (${s.titre}) corrigée par l'auteur : ${CHAMPS.filter((k) => s[k] !== s.origine[k]).map((k) => `${k} → « ${s[k]} »`).join(" ; ")}`);
  return [...mod, commentaire.trim() ? `Remarques sur l'ensemble : ${commentaire.trim()}` : ""].filter(Boolean).join("\n");
}

/** Réviser le storyboard d'après les corrections et les remarques de l'auteur. */
export function consigneRevision(fiche: FichePubliciste, c: ContexteStoryboard, scenes: Scene[], commentaire: string): string {
  const actuel = scenes.map((s) => ({ id: s.id, titre: s.titre, duree: s.duree, voit: s.voit, vo: s.vo, entend: s.entend, trans: s.trans }));
  return (
    "Tu es le Publiciste. Tu RÉVISES le storyboard d'après ce que l'auteur demande. Tu écris en français, au vouvoiement. " +
    "Applique ses demandes (ajouter, supprimer, déplacer, rythme, fin) et garde ses corrections de scène telles quelles. " +
    "Garde l'\"id\" de chaque scène conservée (même déplacée ou retouchée) ; une scène NOUVELLE prend un id neuf (\"n1\", \"n2\"…). " +
    "Ne change PAS une scène que rien ne demande de changer : un mot changé = un croquis redessiné. " +
    "Dans la bulle, dis en une phrase ce que tu as changé. Tu réponds UNIQUEMENT par un objet JSON valide, sans texte autour.\n\n" +
    contexte(fiche, c) +
    `\n\nSTORYBOARD ACTUEL :\n${JSON.stringify(actuel)}\n\nCE QUE DEMANDE L'AUTEUR :\n${demandeRevision(scenes, commentaire) || "(rien de précis : resserre le récit)"}\n\n` +
    FORMAT.replace('"id": "s1"', '"id": "id existant, ou n1 pour une scène nouvelle"')
  );
}

/**
 * Applique la réponse d'une révision aux scènes actuelles : une scène gardée
 * garde son croquis (s'il dessine encore le même « On voit ») ; son texte
 * révisé devient sa nouvelle origine.
 */
export function fusionnerRevision(actuelles: Scene[], revisees: Scene[]): Scene[] {
  const parId = new Map(actuelles.map((s) => [s.id, s]));
  const vus = new Set(actuelles.map((s) => s.id));
  return revisees.map((r) => {
    const a = parId.get(r.id);
    let id = r.id;
    if (!a) {
      while (vus.has(id) || !/^s[a-z0-9]{1,12}$/.test(id)) id = `s${Math.random().toString(36).slice(2, 8)}`;
      vus.add(id);
    }
    const t: TexteScene = { voit: r.voit, vo: r.vo, entend: r.entend, trans: r.trans };
    const base: Scene = { id, titre: r.titre, duree: r.duree, ...t, origine: t };
    if (a?.croquis) return { ...base, croquis: a.croquis, dessine: a.dessine, ...(a.coutCroquis !== undefined ? { coutCroquis: a.coutCroquis } : {}) };
    return base;
  });
}

/** Les différences montrées AVANT de remplacer (maquette : « je vous montre les différences »). */
export function differences(actuelles: Scene[], revisees: Scene[]): { ajoutees: string[]; supprimees: string[]; modifiees: string[]; deplacees: boolean; aDessiner: number } {
  const ids = new Set(actuelles.map((s) => s.id));
  const idsR = new Set(revisees.map((s) => s.id));
  const parId = new Map(actuelles.map((s) => [s.id, s]));
  const ajoutees = revisees.filter((s) => !ids.has(s.id)).map((s) => s.titre);
  const supprimees = actuelles.filter((s) => !idsR.has(s.id)).map((s) => s.titre);
  const modifiees = revisees
    .filter((s) => parId.has(s.id))
    .filter((s) => {
      const a = parId.get(s.id)!;
      return s.titre !== a.titre || CHAMPS.some((k) => s[k] !== a[k]) || s.duree !== a.duree;
    })
    .map((s) => s.titre);
  const ordreA = actuelles.map((s) => s.id).filter((i) => idsR.has(i));
  const ordreR = revisees.map((s) => s.id).filter((i) => ids.has(i));
  const aDessiner = revisees.filter((s) => {
    const a = parId.get(s.id);
    return !a?.croquis || (a.dessine ?? a.voit) !== s.voit;
  }).length;
  return { ajoutees, supprimees, modifiees, deplacees: ordreA.join() !== ordreR.join(), aDessiner };
}

/** Ce qu'on demande au modèle de croquis : grossier, au crayon, dans l'univers choisi, sans texte. */
export function promptCroquis(voit: string, univers?: string): string {
  return (
    "Croquis de storyboard, volontairement grossier et rapide : crayon graphite sur papier, quelques traits et ombres, pas de couleur, " +
    "aucun texte, aucun logo, aucune bulle. Cadrage vertical 9:16. " +
    (univers ? `Ambiance du film : ${univers.slice(0, 300)}. ` : "") +
    `Scène : ${voit}`
  ).slice(0, 1500);
}

export const nomFichierCroquis = (sceneId: string, quand = Date.now()) => `croquis-${sceneId}-${quand.toString(36)}`.slice(0, 88);

/** Coût du storyboard : croquis faits (le texte est compté avec celui des pistes). */
export const coutCroquis = (sb: Storyboard | undefined) => Math.round((sb?.scenes ?? []).reduce((a, s) => a + (s.coutCroquis ?? 0), 0) * 100) / 100;

/** Estimation montrée avant d'écrire le storyboard : texte + une dizaine de croquis. */
export const coutStoryboardEstime = (n = 10) => Math.round((0.05 + n * COUT_CROQUIS_ESTIME) * 100) / 100;

/**
 * Le minutage de l'animatique : chaque scène dure au moins sa durée prévue,
 * et assez pour que sa phrase soit dite (voix à 0,4 s du début, 0,6 s de
 * respiration après). Rend le début de chaque scène et de chaque phrase.
 */
export function minutage(scenes: Pick<Scene, "duree" | "vo">[], dureesVoix: (number | null)[]): { debut: number; fin: number; voix: number | null }[] {
  let t = 0;
  return scenes.map((s, i) => {
    const dv = s.vo ? dureesVoix[i] : null;
    const d = Math.max(s.duree, dv ? dv + 1 : 0);
    const r = { debut: t, fin: t + d, voix: dv ? t + 0.4 : null };
    t += d;
    return r;
  });
}

/** Estimation de la PRODUCTION (maquette : « Estimation de la production ») — des ordres de grandeur, pas un devis. */
export function devisProduction(nbScenes: number): { libelle: string; cout: number | null }[] {
  const images = Math.max(1, Math.round(nbScenes * 1.5));
  return [
    { libelle: `Images finales (≈ ${images} dessins et photos, avec retouches)`, cout: Math.round(images * 0.16 * 100) / 100 },
    { libelle: "Voix retenue, prises supplémentaires", cout: 0.15 },
    { libelle: "Musique en morceau complet (2 essais)", cout: 0.16 },
    { libelle: "Sons réels (banque ou génération)", cout: null },
  ];
}
