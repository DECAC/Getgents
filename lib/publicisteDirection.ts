/**
 * Publiciste, lot 2 : la direction artistique des étapes 1 à 3 de la maquette
 * (`mockups/recit/publiciste/index.html`) — direction visuelle (trois
 * planches d'ambiance), typographie (trois associations de polices), couleurs
 * (trois palettes de cinq). Chaque étape : trois pistes, une recommandation
 * argumentée, et « Autre proposition » à partir d'une remarque de l'auteur.
 *
 * Le texte des pistes vient d'UN appel au modèle par étape, en JSON validé
 * ici ; les planches viennent ensuite, une par piste (Gemini 3 Pro Image,
 * 928×1152 — le format de la maquette). Les polices sont prises dans une
 * liste FERMÉE de Google Fonts : jamais une police inventée qui ne se
 * chargerait pas. Les couleurs sont des hexadécimaux validés.
 *
 * Module PUR.
 */
import type { FichePubliciste } from "@/lib/publiciste";

export type EtapeDirection = "visuel" | "typo" | "couleurs";
export const ETAPES_DIRECTION: readonly EtapeDirection[] = ["visuel", "typo", "couleurs"];

export const MODELE_PLANCHE = "google/gemini-3-pro-image";
export const FORMAT_PLANCHE = "4:5";
/** Coûts mesurés le 27/11 (affichés AVANT de lancer, comme dans la maquette). */
export const COUT_PLANCHE_ESTIME = 0.14;

export interface PisteVisuel {
  id: string;
  nom: string;
  desc: string;
  pour: string;
  contre: string;
  /** Ce qu'on demande au modèle d'image (jamais montré tel quel). */
  prompt: string;
  /** Nom du fichier de la planche générée (`publiciste_fichiers.nom`), une fois faite. */
  image?: string;
  /** Coût mesuré de la planche, en dollars. */
  cout?: number;
}

/** Associations de polices proposables : Google Fonts seulement (CSP), chargées à l'affichage. */
export const POLICES = [
  { id: "montserrat-ecolier", nom: "Montserrat et écriture d'écolier", titre: "Montserrat", poidsTitre: 800, texte: "Montserrat", main: "Playwrite FR Trad", detail: "Montserrat · Playwrite FR Trad (cursive scolaire française)" },
  { id: "fraunces-inter", nom: "Fraunces et Inter", titre: "Fraunces", poidsTitre: 700, texte: "Inter", main: null, detail: "Fraunces · Inter" },
  { id: "bricolage-montserrat", nom: "Affiche d'atelier", titre: "Bricolage Grotesque", poidsTitre: 800, texte: "Montserrat", main: null, detail: "Bricolage Grotesque · Montserrat" },
  { id: "playfair-source", nom: "Élégance classique", titre: "Playfair Display", poidsTitre: 700, texte: "Source Sans 3", main: null, detail: "Playfair Display · Source Sans 3" },
  { id: "dmserif-dmsans", nom: "Éditorial doux", titre: "DM Serif Display", poidsTitre: 400, texte: "DM Sans", main: null, detail: "DM Serif Display · DM Sans" },
  { id: "archivo-inter", nom: "Coupe franche", titre: "Archivo Black", poidsTitre: 400, texte: "Inter", main: null, detail: "Archivo Black · Inter" },
  { id: "nunito-caveat", nom: "Fait main", titre: "Nunito", poidsTitre: 800, texte: "Nunito", main: "Caveat", detail: "Nunito · Caveat (écriture à la main)" },
  { id: "cormorant-work", nom: "Maison ancienne", titre: "Cormorant Garamond", poidsTitre: 700, texte: "Work Sans", main: null, detail: "Cormorant Garamond · Work Sans" },
  { id: "spacegrotesk-plex", nom: "Technique et net", titre: "Space Grotesk", poidsTitre: 700, texte: "IBM Plex Sans", main: null, detail: "Space Grotesk · IBM Plex Sans" },
  { id: "abril-lora", nom: "Gazette", titre: "Abril Fatface", poidsTitre: 400, texte: "Lora", main: null, detail: "Abril Fatface · Lora" },
] as const;
export type IdPolice = (typeof POLICES)[number]["id"];

export interface PisteTypo {
  id: IdPolice;
  nom: string;
  note: string;
}

export interface Couleur {
  nom: string;
  hex: string;
}
export interface PistePalette {
  id: string;
  nom: string;
  couleurs: Couleur[];
  /** Rôles pour l'aperçu : fond, encre (texte), accent, couverture, étiquette. */
  fond: string;
  encre: string;
  accent: string;
  note: string;
}

/** Les textes des spécimens de typographie, tirés du projet (comme « Pour Sophie, Ateliers Morvan »). */
export interface Specimen {
  etiquette: string;
  titre: string;
  corps: string;
  fin: string;
  bouton: string;
}

export interface Proposition {
  etape: EtapeDirection;
  /** Les deux paragraphes de la bulle du Publiciste (le second : la recommandation). */
  bulle: string[];
  recommandee: string;
  visuel?: PisteVisuel[];
  typo?: PisteTypo[];
  specimen?: Specimen;
  couleurs?: PistePalette[];
  /** La remarque de l'auteur qui a motivé cette proposition, s'il y en a une. */
  remarque?: string;
}

const txt = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const hex = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : /^#[0-9a-f]{3}$/i.test(s) ? ("#" + s.slice(1).split("").map((c) => c + c).join("")).toLowerCase() : null;
};
const ident = (v: unknown, i: number): string => {
  const s = txt(v, 40).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return s || `piste-${i + 1}`;
};

/** Valide la réponse du modèle pour une étape. Trois pistes exactement, sinon null. */
export function validerProposition(etape: EtapeDirection, brut: unknown, remarque?: string): Proposition | null {
  if (!brut || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const bulle = (Array.isArray(o.bulle) ? o.bulle : [o.bulle]).map((b) => txt(b, 900)).filter(Boolean).slice(0, 2);
  const pistes = Array.isArray(o.pistes) ? o.pistes.slice(0, 3) : [];
  if (pistes.length !== 3 || !bulle.length) return null;
  const base: Proposition = { etape, bulle, recommandee: "", ...(remarque ? { remarque: txt(remarque, 500) } : {}) };

  if (etape === "visuel") {
    const visuel: PisteVisuel[] = pistes.map((p, i) => {
      const r = (p ?? {}) as Record<string, unknown>;
      const image = typeof r.image === "string" && /^visuel-[a-z0-9-]{1,80}$/.test(r.image) ? r.image : undefined;
      const cout = typeof r.cout === "number" && Number.isFinite(r.cout) && r.cout >= 0 ? Math.min(r.cout, 10) : undefined;
      return { id: ident(r.id ?? r.nom, i), nom: txt(r.nom, 80), desc: txt(r.desc, 700), pour: txt(r.pour, 500), contre: txt(r.contre, 500), prompt: txt(r.prompt, 1500), ...(image ? { image } : {}), ...(cout !== undefined ? { cout } : {}) };
    });
    if (visuel.some((p) => !p.nom || !p.prompt) || new Set(visuel.map((p) => p.id)).size !== 3) return null;
    return { ...base, visuel, recommandee: choisirReco(o.recommandee, visuel.map((p) => p.id)) };
  }
  if (etape === "typo") {
    const typo: PisteTypo[] = [];
    for (const p of pistes) {
      const r = (p ?? {}) as Record<string, unknown>;
      const police = POLICES.find((x) => x.id === r.id);
      if (!police || typo.some((t) => t.id === police.id)) return null;
      typo.push({ id: police.id, nom: txt(r.nom, 80) || police.nom, note: txt(r.note, 500) });
    }
    const s = (o.specimen ?? {}) as Record<string, unknown>;
    const specimen: Specimen = { etiquette: txt(s.etiquette, 60), titre: txt(s.titre, 90), corps: txt(s.corps, 200), fin: txt(s.fin, 80), bouton: txt(s.bouton, 30) };
    if (!specimen.titre) return null;
    return { ...base, typo, specimen, recommandee: choisirReco(o.recommandee, typo.map((t) => t.id)) };
  }
  const couleurs: PistePalette[] = [];
  for (const [i, p] of pistes.entries()) {
    const r = (p ?? {}) as Record<string, unknown>;
    const cs = (Array.isArray(r.couleurs) ? r.couleurs : []).map((c) => {
      const cc = (c ?? {}) as Record<string, unknown>;
      const h = hex(cc.hex);
      return h ? { nom: txt(cc.nom, 30) || h, hex: h } : null;
    });
    if (cs.length !== 5 || cs.some((c) => !c)) return null;
    const liste = cs as Couleur[];
    const role = (v: unknown, defaut: number) => hex(v) ?? liste[defaut].hex;
    couleurs.push({ id: ident(r.id ?? r.nom, i), nom: txt(r.nom, 60), couleurs: liste, fond: role(r.fond, 3), encre: role(r.encre, 0), accent: role(r.accent, 1), note: txt(r.note, 500) });
  }
  if (couleurs.some((p) => !p.nom) || new Set(couleurs.map((p) => p.id)).size !== 3) return null;
  return { ...base, couleurs, recommandee: choisirReco(o.recommandee, couleurs.map((p) => p.id)) };
}

function choisirReco(v: unknown, ids: string[]): string {
  const s = typeof v === "string" ? v : "";
  return ids.find((id) => id === s) ?? ids.find((id) => id === ident(s, 0)) ?? ids[0];
}

/** Ce qui est déjà décidé, pour que chaque étape tienne compte des précédentes. */
export interface ChoixPrecedents {
  visuel?: { nom: string; desc: string };
  typo?: { nom: string; detail: string };
}

function resumeFiche(f: FichePubliciste): string {
  const lignes = [
    f.projet && `Projet : ${f.projet}`,
    f.marque && `Marque : ${f.marque}`,
    ...Object.entries(f.fond).map(([k, v]) => v && `Fond — ${k} : ${v}`),
    ...Object.entries(f.forme).map(([k, v]) => v && `Forme — ${k} : ${v}`),
  ].filter(Boolean);
  return lignes.join("\n");
}

/** La consigne de l'appel qui prépare les trois pistes d'une étape. */
export function consigneDirection(etape: EtapeDirection, fiche: FichePubliciste, avant: ChoixPrecedents, remarque?: string): string {
  const commun =
    "Tu es le Publiciste : tu proposes la direction artistique d'un projet de communication, à partir de l'entretien avec l'auteur. " +
    "Tu écris en français, au vouvoiement, avec franchise : chaque piste a ce qu'elle apporte et ce qu'elle risque. " +
    "Sois bref : une phrase par champ de texte (« pour », « contre », « note »), deux au plus pour une description. " +
    "Tu réponds UNIQUEMENT par un objet JSON valide, sans texte autour.\n\n" +
    `CE QUE L'ENTRETIEN A ÉTABLI :\n${resumeFiche(fiche) || "(fiche encore vide)"}\n` +
    (avant.visuel ? `\nUnivers choisi : ${avant.visuel.nom} — ${avant.visuel.desc}` : "") +
    (avant.typo ? `\nLettres choisies : ${avant.typo.nom} (${avant.typo.detail})` : "") +
    (remarque ? `\n\nREMARQUE DE L'AUTEUR SUR LA PROPOSITION PRÉCÉDENTE (à suivre) : ${remarque}` : "") +
    "\n\n";
  if (etape === "visuel") {
    return (
      commun +
      "ÉTAPE : DIRECTION VISUELLE. Propose TROIS univers visuels nettement différents (planches d'ambiance : on juge un univers, pas une image finale). " +
      "L'un peut partir de l'univers actuel de la marque ; un autre peut oser ; recommande celui qui sert le mieux le cœur de la marque, sans effet « IA » ni cliché publicitaire. " +
      'Format : {"bulle": ["ce que tu as relevé de la marque, en deux phrases", "ta recommandation et pourquoi, en deux phrases"], "recommandee": "id", ' +
      '"pistes": [{"id": "court-sans-accent", "nom": "nom évocateur", "desc": "l\'univers en une ou deux phrases", "pour": "ce qu\'il apporte", "contre": "ce qu\'il risque", ' +
      '"prompt": "description détaillée de la planche pour un modèle d\'image : un collage de 5 à 6 vignettes (photos, dessins, matières, lumière, palette) qui fait sentir l\'univers ; précise technique, lumière et matières ; aucun texte lisible, aucun logo"}]}'
    );
  }
  if (etape === "typo") {
    const liste = POLICES.map((p) => `"${p.id}" : ${p.detail}`).join(" ; ");
    return (
      commun +
      "ÉTAPE : TYPOGRAPHIE. Les lettres de l'étiquette, de la page finale et de la phrase de fin. Choisis TROIS associations UNIQUEMENT dans cette liste fermée, par leur identifiant : " +
      liste +
      ". Si la marque a déjà une police de titres de la liste, garde-la dans au moins une piste. " +
      'Format : {"bulle": ["ce que tu gardes et pourquoi", "ta recommandation"], "recommandee": "id", "pistes": [{"id": "identifiant de la liste", "nom": "nom court", "note": "ce qu\'elle apporte, ou sa réserve, en une phrase"}], ' +
      '"specimen": {"etiquette": "une étiquette manuscrite du projet, 2 à 5 mots", "titre": "une phrase forte du projet", "corps": "une phrase descriptive", "fin": "la phrase de fin du projet", "bouton": "un appel à l\'action de 2 à 3 mots"}}'
    );
  }
  return (
    commun +
    "ÉTAPE : COULEURS. Propose TROIS palettes de CINQ couleurs pour l'histoire et sa page. Garde les couleurs de la marque si elle en a, en leur donnant un rôle ; " +
    "une palette doit avoir un fond clair et une encre lisible dessus (contraste suffisant). " +
    'Format : {"bulle": ["comment tu traites les couleurs de la marque", "ta recommandation"], "recommandee": "id", "pistes": [{"id": "court-sans-accent", "nom": "nom évocateur", ' +
    '"couleurs": [{"nom": "nom de la teinte", "hex": "#rrggbb"}, … cinq], "fond": "#rrggbb (une des cinq)", "encre": "#rrggbb (une des cinq)", "accent": "#rrggbb (une des cinq)", "note": "facultatif, une phrase"}]}'
  );
}

/** Ce qui est demandé au modèle d'image pour une planche : la consigne de la piste, cadrée. */
export function promptPlanche(p: PisteVisuel): string {
  return (
    `Planche d'ambiance (moodboard) : ${p.prompt} ` +
    "Composition en collage sur un fond de papier, vignettes légèrement espacées, cohérence de lumière et de palette. " +
    "Aucun texte lisible, aucune lettre, aucun logo, aucune marque déposée."
  );
}

/** Un nom par génération : une planche refaite ne remplace jamais en silence celle d'une autre proposition. */
export const nomFichierPlanche = (pisteId: string, quand = Date.now()) => `visuel-${pisteId}-${quand.toString(36)}`.slice(0, 88);

/** L'adresse Google Fonts qui charge les polices des spécimens proposés. */
export function adressePolices(ids: readonly string[]): string | null {
  const familles = new Map<string, Set<number>>();
  const ajouter = (famille: string, poids: number[]) => {
    const p = familles.get(famille) ?? new Set<number>();
    poids.forEach((x) => p.add(x));
    familles.set(famille, p);
  };
  for (const id of ids) {
    const p = POLICES.find((x) => x.id === id);
    if (!p) continue;
    ajouter(p.titre, [p.poidsTitre]);
    ajouter(p.texte, [400, 600, 700]);
    if (p.main) ajouter(p.main, [400]);
  }
  if (!familles.size) return null;
  const params = Array.from(familles).map(([f, poids]) => `family=${f.replace(/ /g, "+")}:wght@${Array.from(poids).sort((a, b) => a - b).join(";")}`);
  return `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap`;
}

/** Ce qu'a coûté la direction artistique d'un projet : texte des pistes + planches. */
export function coutDirection(direction: Partial<Record<EtapeDirection, Proposition>> | undefined, depenseTexte = 0): { texte: number; planches: number; total: number } {
  const planches = (direction?.visuel?.visuel ?? []).reduce((a, p) => a + (p.cout ?? 0), 0);
  const r = (x: number) => Math.round(x * 100) / 100;
  return { texte: r(depenseTexte), planches: r(planches), total: r(depenseTexte + planches) };
}

/** Estimation montrée AVANT de lancer une étape (comme « ≈ 0,42 $ » dans la maquette). */
export function coutEstime(etape: EtapeDirection): number {
  return etape === "visuel" ? Math.round((3 * COUT_PLANCHE_ESTIME + 0.04) * 100) / 100 : 0.04;
}
