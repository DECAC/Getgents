/**
 * « Le Prompteur » : un gent qui aide à écrire une capsule vidéo d'une minute
 * pour LinkedIn, puis la fait lire sur un prompteur qui défile AU RYTHME DE LA
 * VOIX, pendant que la caméra enregistre.
 *
 * Trois moments, trois responsabilités :
 *   1. la conversation écrit le texte — la consigne ci-dessous en fixe la
 *      forme, et le gent encadre chaque version complète entre deux marqueurs
 *      (`<!--SCRIPT-->` … `<!--/SCRIPT-->`) ;
 *   2. un clic sur « Prompteur » sous la réponse VALIDE ce texte : il est
 *      gardé tel quel (copie fidèle, comme « Garder en note ») et lu ;
 *   3. le prompteur (components/prompteur/Prompteur.tsx) suit la voix et
 *      enregistre — tout se passe dans le navigateur, rien ne part au serveur.
 *
 * Le gent ne DÉCIDE pas de produire un artefact : c'est le clic qui le fait.
 * La consigne ne parle que de FORME (voir `consigneArtefacts`, source unique
 * de la fréquence des artefacts).
 *
 * Module PUR — testable sans navigateur.
 */

export const DUREES_CIBLES = [30, 45, 60, 90] as const;
export const DUREE_PAR_DEFAUT = 60;
/** Débit parlé posé, face caméra. Sert à l'estimation et au défilement automatique. */
export const MOTS_PAR_MINUTE = 150;

export const MARQUEUR_SCRIPT = "<!--SCRIPT-->";
export const MARQUEUR_SCRIPT_FIN = "<!--/SCRIPT-->";
export const TYPE_SCRIPT = "Script";

export function motsCibles(dureeSecondes: number): number {
  return Math.round((dureeSecondes * MOTS_PAR_MINUTE) / 60);
}

export function consignePrompteur(dureeSecondes = DUREE_PAR_DEFAUT): string {
  const mots = motsCibles(dureeSecondes);
  return (
    "RÔLE PROMPTEUR : tu aides l'utilisateur à écrire le texte d'une capsule vidéo pour LinkedIn, " +
    `qu'il dira face caméra en ${dureeSecondes} secondes environ (${mots} mots, à ${MOTS_PAR_MINUTE} mots par minute). ` +
    "Il te donne une idée, un thème ou un brouillon : tu écris un texte À DIRE, pas à lire. " +
    "Règles d'écriture : une accroche qui arrête le défilement dès la première phrase ; des phrases courtes et percutantes, " +
    "une idée par phrase ; la langue parlée de l'utilisateur, sans jargon ; ni liste, ni titre, ni émoji, ni hashtag dans le texte à dire ; " +
    "un paragraphe par respiration ; une chute ou une question qui appelle la réaction. " +
    "Travaille le texte AVEC l'utilisateur : propose une version, puis resserre-la selon ses retours — plus court, plus direct, plus personnel. " +
    `Chaque fois que tu donnes une version COMPLÈTE du texte à dire, encadre-la, et elle seule, entre ${MARQUEUR_SCRIPT} et ${MARQUEUR_SCRIPT_FIN}, ` +
    "chacun seul sur sa ligne ; tes remarques restent en dehors. Indique après le texte sa durée estimée. " +
    "L'utilisateur lance le texte dans le prompteur d'un bouton, sous ta réponse : ne lui demande jamais de le recopier."
  );
}

/** Markdown d'un texte à dire → texte brut, paragraphes gardés (ce sont les respirations). */
export function texteParle(md: string): string {
  return md
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((para) =>
      para
        .split("\n")
        .map((ligne) =>
          ligne
            .replace(/^\s{0,3}#{1,6}\s+/, "")
            .replace(/^\s*>\s?/, "")
            .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")
        )
        .join(" ")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/(\*\*|__)(.+?)\1/g, "$2")
        .replace(/(^|[^*\w])[*_]([^*_\n]+)[*_](?=[^*\w]|$)/g, "$1$2")
        .replace(/`([^`]*)`/g, "$1")
        .replace(/<[^>]+>/g, "")
        .replace(/[ \t]+/g, " ")
        .trim()
    )
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Retire les marqueurs du texte (le script reste visible dans la réponse) et
 * rend la DERNIÈRE version complète encadrée. Un marqueur ouvert sans
 * fermeture — réponse coupée — ne donne pas de script : on ne lance pas un
 * texte tronqué dans le prompteur.
 */
export function extraireScript(raw: string): { text: string; script?: string } {
  if (!raw.includes(MARQUEUR_SCRIPT)) return { text: raw };
  let script: string | undefined;
  const re = /<!--SCRIPT-->([\s\S]*?)<!--\/SCRIPT-->/g;
  for (const m of Array.from(raw.matchAll(re))) {
    const t = texteParle(m[1]);
    if (t) script = t;
  }
  const text = raw
    .split(MARQUEUR_SCRIPT_FIN)
    .join("")
    .split(MARQUEUR_SCRIPT)
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, script };
}

/** Texte à dire d'un artefact gardé : ses blocs de texte, sans les titres. */
export function texteDepuisBlocs(blocks: readonly Record<string, unknown>[] | undefined): string {
  return (blocks ?? [])
    .map((b) => {
      if (b.type === "text" || b.type === "callout") return texteParle(String(b.body ?? ""));
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export function compterMots(texte: string): number {
  return texte.split(/\s+/).filter(Boolean).length;
}

export function dureeEstimee(texte: string, motsParMinute = MOTS_PAR_MINUTE): number {
  return Math.round((compterMots(texte) * 60) / Math.max(motsParMinute, 1));
}

export function formatDuree(secondes: number): string {
  const s = Math.max(0, Math.round(secondes));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// --- Suivi de la voix ------------------------------------------------------

export interface MotScript {
  /** Tel qu'affiché, ponctuation comprise. */
  mot: string;
  /** Forme comparée à la reconnaissance vocale. */
  norm: string;
  paragraphe: number;
}

/** Minuscules, sans accents ni ponctuation : « L'IA, » → « lia ». */
export function normaliserMot(mot: string): string {
  return mot
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function decouperScript(texte: string): MotScript[] {
  const mots: MotScript[] = [];
  texte.split(/\n{2,}/).forEach((para, paragraphe) => {
    for (const mot of para.split(/\s+/).filter(Boolean)) {
      mots.push({ mot, norm: normaliserMot(mot), paragraphe });
    }
  });
  return mots;
}

/** Mots entendus : la reconnaissance vocale rend du texte libre. */
export function motsEntendus(transcription: string): string[] {
  return transcription.split(/\s+/).map(normaliserMot).filter(Boolean);
}

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

/**
 * La reconnaissance se trompe d'une lettre, coupe un mot, accorde mal :
 * « prompteurs » pour « prompteur », « lia » pour « l'IA ».
 */
export function motsProches(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const court = Math.min(a.length, b.length);
  if (court >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  return court >= 5 && distance(a, b) <= 1;
}

/**
 * Où en est la lecture ? Les derniers mots entendus sont cherchés dans le
 * script, un peu en arrière et surtout en avant de la position courante ;
 * la position rendue est celle du PROCHAIN mot à dire.
 *
 * Prudent par construction : un mot court (« de », « la ») ne suffit jamais à
 * faire sauter le texte — il faut deux mots qui se suivent, ou un mot long.
 * Faute d'accord, la position ne bouge pas : mieux vaut un prompteur qui
 * attend qu'un prompteur qui part devant.
 */
export function alignerPosition(
  script: readonly string[],
  entendus: readonly string[],
  position: number,
  { avant = 30, arriere = 3, memoire = 4 }: { avant?: number; arriere?: number; memoire?: number } = {}
): number {
  const derniers = entendus.slice(-memoire);
  if (!derniers.length || !script.length) return position;
  let meilleur = { fin: -1, score: 0, ecart: Infinity };
  const debut = Math.max(0, position - arriere);
  const finFenetre = Math.min(script.length - 1, position + avant);
  for (let fin = debut; fin <= finFenetre; fin++) {
    let score = 0;
    let longs = 0;
    for (let j = 0; j < derniers.length && fin - j >= 0; j++) {
      const entendu = derniers[derniers.length - 1 - j];
      if (!motsProches(entendu, script[fin - j])) break;
      score += 1;
      if (script[fin - j].length >= 4) longs += 1;
    }
    const suffisant = score >= 2 || (score === 1 && longs === 1 && fin - position <= 8);
    if (!suffisant) continue;
    const ecart = Math.abs(fin - position);
    if (score > meilleur.score || (score === meilleur.score && ecart < meilleur.ecart)) {
      meilleur = { fin, score, ecart };
    }
  }
  return meilleur.fin < 0 ? position : Math.max(position, meilleur.fin + 1);
}

// --- Enregistrement --------------------------------------------------------

export type Cadrage = "carre" | "vertical" | "paysage";

export const CADRAGES: { id: Cadrage; libelle: string; ratio: number }[] = [
  { id: "carre", libelle: "Carré 1:1", ratio: 1 },
  { id: "vertical", libelle: "Vertical 9:16", ratio: 9 / 16 },
  { id: "paysage", libelle: "Paysage 16:9", ratio: 16 / 9 },
];

/** Recadrage centré de l'image de la caméra au format choisi, sans agrandir. */
export function rectangleCadrage(largeur: number, hauteur: number, cadrage: Cadrage) {
  const ratio = CADRAGES.find((c) => c.id === cadrage)?.ratio ?? 1;
  let sw = largeur;
  let sh = Math.round(largeur / ratio);
  if (sh > hauteur) {
    sh = hauteur;
    sw = Math.round(hauteur * ratio);
  }
  // Dimensions paires : certains encodeurs H.264 refusent l'impair.
  sw -= sw % 2;
  sh -= sh % 2;
  return { sx: Math.round((largeur - sw) / 2), sy: Math.round((hauteur - sh) / 2), sw, sh };
}

/**
 * Format du fichier : MP4 d'abord (Safari, Chrome récent) — le plus simple à
 * publier partout ; WebM sinon (Firefox, Chrome plus ancien).
 */
export function choisirFormatVideo(estSupporte: (type: string) => boolean): { mimeType: string; extension: string } | null {
  const candidats: [string, string][] = [
    ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9,opus", "webm"],
    ["video/webm;codecs=vp8,opus", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [mimeType, extension] of candidats) {
    if (estSupporte(mimeType)) return { mimeType, extension };
  }
  return null;
}

export function nomFichierCapsule(date: Date, extension: string): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `capsule-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.${extension}`;
}

/** Titre d'un script gardé : sa première phrase, courte. */
export function titreScript(texte: string, max = 60): string {
  const premiere = texte.replace(/\s+/g, " ").trim().split(/(?<=[.!?…])\s/)[0] ?? "";
  const net = premiere.replace(/[.!…]+$/, "").trim();
  if (!net) return "Capsule vidéo";
  return net.length <= max ? net : `${net.slice(0, max - 1).trimEnd()}…`;
}
