/**
 * Gent « Le Publiciste » — CONFORME À LA MAQUETTE (décision de l'éditeur,
 * 27/11) : `mockups/recit/publiciste/index.html`. Huit étapes, de l'entretien
 * à la validation de la direction ; chacune produit de VRAIES générations pour
 * le projet de l'auteur. Lot 1 : l'interface des huit étapes, l'entretien
 * réel et sa fiche « Ce que j'en retiens », l'enregistrement du projet.
 *
 * Pendant l'entretien, le gent tient la fiche à jour : à la fin de CHAQUE
 * réponse, il la recopie entière entre `<!--FICHE-->` et `<!--/FICHE-->`, en
 * JSON. Le bloc quitte le texte (jamais affiché brut) ; l'écran l'affiche à
 * côté de la conversation, comme dans la maquette.
 *
 * Module PUR : aucune dépendance au navigateur ni au serveur.
 */

export const MARQUEUR_FICHE = "<!--FICHE-->";
export const MARQUEUR_FICHE_FIN = "<!--/FICHE-->";

/** Les étapes de la maquette, dans son ordre et avec ses mots. */
export const ETAPES_PUBLICISTE = [
  { id: "entretien", nom: "L'entretien" },
  { id: "visuel", nom: "Direction visuelle" },
  { id: "typo", nom: "Typographie" },
  { id: "couleurs", nom: "Couleurs" },
  { id: "musique", nom: "Musique" },
  { id: "voix", nom: "Voix" },
  { id: "storyboard", nom: "Storyboard" },
  { id: "recap", nom: "Valider" },
] as const;
export type EtapePubliciste = (typeof ETAPES_PUBLICISTE)[number]["id"];

/** Les rubriques de la fiche, celles de la maquette (FICHE_FOND, FICHE_FORME). */
export const RUBRIQUES_FOND = [
  { cle: "vend", libelle: "Ce qu'il vend" },
  { cle: "pourQui", libelle: "Pour qui" },
  { cle: "coeur", libelle: "Le cœur" },
  { cle: "ressenti", libelle: "Ce que doit ressentir celui qui regarde" },
  { cle: "aEviter", libelle: "À ne pas dire" },
  { cle: "matiere", libelle: "Ce qu'on a sous la main" },
] as const;
export const RUBRIQUES_FORME = [
  { cle: "ou", libelle: "Où ce sera vu" },
  { cle: "forme", libelle: "Forme pressentie" },
  { cle: "aMontrer", libelle: "À montrer aussi" },
] as const;

type CleFond = (typeof RUBRIQUES_FOND)[number]["cle"];
type CleForme = (typeof RUBRIQUES_FORME)[number]["cle"];

export interface FichePubliciste {
  /** Nom du projet, court (« Le premier couteau »). */
  projet: string;
  /** La marque ou l'auteur pour qui on travaille. */
  marque: string;
  fond: Partial<Record<CleFond, string>>;
  forme: Partial<Record<CleForme, string>>;
  /** La forme est-elle tranchée, ou seulement pressentie ? */
  formeDecidee: boolean;
  /** Le gent juge l'entretien suffisant pour passer à la direction artistique. */
  pret: boolean;
}

export const FICHE_VIDE: FichePubliciste = { projet: "", marque: "", fond: {}, forme: {}, formeDecidee: false, pret: false };

const texte = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** Valide et nettoie une fiche venue du modèle ou du navigateur. */
export function validerFiche(brut: unknown): FichePubliciste | null {
  if (!brut || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const lire = <K extends string>(src: unknown, rubriques: readonly { cle: K }[]): Partial<Record<K, string>> => {
    const r: Partial<Record<K, string>> = {};
    if (!src || typeof src !== "object") return r;
    for (const { cle } of rubriques) {
      const v = texte((src as Record<string, unknown>)[cle], 400);
      if (v) r[cle] = v;
    }
    return r;
  };
  return {
    projet: texte(o.projet, 80),
    marque: texte(o.marque, 80),
    fond: lire(o.fond, RUBRIQUES_FOND),
    forme: lire(o.forme, RUBRIQUES_FORME),
    formeDecidee: o.formeDecidee === true,
    pret: o.pret === true,
  };
}

/**
 * Retire de la réponse le bloc de la fiche (le DERNIER, s'il y en a
 * plusieurs) et le rend validé. Un bloc illisible ou coupé part quand même.
 */
export function extraireFiche(raw: string): { text: string; fiche?: FichePubliciste } {
  const motif = /<!--FICHE-->([\s\S]*?)<!--\/FICHE-->/g;
  let dernier: string | null = null;
  for (const m of raw.matchAll(motif)) dernier = m[1];
  let text = raw.replace(motif, "");
  const ouvert = text.indexOf(MARQUEUR_FICHE);
  if (ouvert >= 0) text = text.slice(0, ouvert);
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  if (dernier === null) return { text };
  const json = dernier.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const fiche = validerFiche(JSON.parse(json));
    return fiche ? { text, fiche } : { text };
  } catch {
    return { text };
  }
}

/** Nombre de rubriques remplies, sur le total : l'avancement de l'entretien. */
export function remplissage(f: FichePubliciste): { remplies: number; total: number } {
  const total = RUBRIQUES_FOND.length + RUBRIQUES_FORME.length;
  const remplies = Object.values(f.fond).filter(Boolean).length + Object.values(f.forme).filter(Boolean).length;
  return { remplies, total };
}

/** Consigne de l'entretien, jointe au prompt du gent. Elle fixe la conduite et la FORME de la fiche. */
export function consignePubliciste(): string {
  const fond = RUBRIQUES_FOND.map((r) => `"${r.cle}" (${r.libelle})`).join(", ");
  const forme = RUBRIQUES_FORME.map((r) => `"${r.cle}" (${r.libelle})`).join(", ");
  return (
    "RÔLE PUBLICISTE — L'ENTRETIEN : tu mènes l'entretien qui ouvre un projet de communication pour la marque de l'utilisateur. " +
    "L'écran a déjà posé la première question, avant le premier message de l'utilisateur : « Racontez-moi votre marque. Qu'est-ce que vous vendez, au fond ? » ; " +
    "sa première réponse y répond. " +
    "Une seule question à la fois, courte et concrète. D'abord le FOND : ce qu'il vend et à qui, le souvenir ou l'émotion au cœur de sa marque " +
    "(cherche l'histoire vraie, un lieu, une odeur, un geste), ce que doit ressentir celui qui verra le résultat, ce qu'il ne faut surtout pas dire, " +
    "et ce qu'on a sous la main (photos, images, une voix). Puis la FORME : où ce sera vu, et la forme pressentie (film court, histoire qu'on fait " +
    "avancer au clic, présentation animée…) ; la forme peut rester pressentie, elle s'affine pendant la direction artistique. " +
    "Reformule ce que tu as compris quand c'est utile, et dis franchement quand une idée sonne comme une publicité banale. " +
    "Huit à dix questions suffisent ; quand tu as de quoi travailler, dis-le et annonce la suite : la direction artistique, trois pistes à chaque étape, et ta recommandation. " +
    `À la fin de CHAQUE réponse, recopie la fiche ENTIÈRE, à jour, entre ${MARQUEUR_FICHE} et ${MARQUEUR_FICHE_FIN}, chacun seul sur sa ligne, en JSON strict : ` +
    '{"projet": "nom court du projet", "marque": "…", "fond": {…}, "forme": {…}, "formeDecidee": false, "pret": false}. ' +
    `Clés de "fond" : ${fond}. Clés de "forme" : ${forme}. ` +
    "Chaque valeur est une phrase courte, dans les mots de l'utilisateur ; une rubrique encore inconnue est absente, jamais inventée. " +
    '"pret" passe à true seulement quand le fond est assez clair pour proposer une direction artistique. ' +
    "Ce bloc n'est pas affiché : l'utilisateur voit la fiche à côté de la conversation. Ne le mentionne jamais."
  );
}

export const PROMPT_PUBLICISTE_DEFAUT =
  "Tu es mon publiciste. Tu m'aides à raconter ma marque avec justesse : tu cherches l'histoire vraie derrière ce que je vends, " +
  "plutôt que la liste de mes produits, et tu me dis franchement quand une idée sonne comme une publicité banale.";

/** Ce qui est gardé du projet (table `publiciste_projets`, migration 040). Grandit à chaque lot. */
export interface EtatProjet {
  etape: EtapePubliciste;
  fiche: FichePubliciste;
  /** Choix de l'auteur, étape par étape (identifiants des pistes). */
  choix: Partial<Record<Exclude<EtapePubliciste, "entretien" | "recap">, string>>;
}

export const ETAT_VIDE: EtatProjet = { etape: "entretien", fiche: FICHE_VIDE, choix: {} };
export const ETAT_MAX_OCTETS = 200_000;

/** Valide un état envoyé par le navigateur avant de l'écrire. Rend null s'il est refusé. */
export function validerEtat(brut: unknown): EtatProjet | null {
  if (!brut || typeof brut !== "object") return null;
  try {
    if (JSON.stringify(brut).length > ETAT_MAX_OCTETS) return null;
  } catch {
    return null;
  }
  const o = brut as Record<string, unknown>;
  const etape = ETAPES_PUBLICISTE.some((e) => e.id === o.etape) ? (o.etape as EtapePubliciste) : "entretien";
  const choix: EtatProjet["choix"] = {};
  if (o.choix && typeof o.choix === "object") {
    for (const e of ETAPES_PUBLICISTE) {
      if (e.id === "entretien" || e.id === "recap") continue;
      const v = texte((o.choix as Record<string, unknown>)[e.id], 60);
      if (v) choix[e.id] = v;
    }
  }
  return { etape, fiche: validerFiche(o.fiche) ?? FICHE_VIDE, choix };
}
