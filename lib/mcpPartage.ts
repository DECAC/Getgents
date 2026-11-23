/**
 * Connecteur MCP « partager un artefact » — PHASE 0 (essai, 11/2026).
 *
 * Question que l'essai doit trancher : une IA (Claude, ChatGPT…) transmet-elle
 * un artefact ENTIER et FIDÈLE à un connecteur ? Un connecteur ne voit pas
 * l'artefact : il ne reçoit que ce que le modèle recopie dans l'appel d'outil.
 * Sur un gros artefact, la copie peut arriver tronquée ou abrégée. D'où le
 * contrôle de fidélité (`controleFidelite`) renvoyé à chaque partage.
 *
 * Module PUR : le protocole (JSON-RPC 2.0, transport « Streamable HTTP » en
 * réponses JSON simples, sans flux) et la validation vivent ici ; le
 * stockage est injecté. Testable sans serveur ni base.
 */

import { PlafondAtteint } from "./offre";
import { donneesPersonnelles, type DonneesPersonnelles } from "./donneesPersonnelles";
import { modeleMailTextes, type Langue } from "./langueLecteur";
import { fichiersReferences } from "./fichiersPage";

export const FORMATS_ARTEFACT = ["html", "markdown", "svg", "react", "texte"] as const;
export type FormatArtefact = (typeof FORMATS_ARTEFACT)[number];

/** Au-delà, ce n'est plus un artefact mais un fichier : 2 millions de caractères. */
export const CONTENU_MAX = 2_000_000;
export const TITRE_MAX = 200;
export const DESTINATAIRE_MAX = 200;
export const MESSAGE_MAX = 2_000;

export interface DemandePartage {
  titre: string;
  contenu: string;
  format: FormatArtefact;
  destinataire: string;
  message?: string;
  /** Assistant du document : le destinataire peut poser des questions sur l'artefact. */
  assistant?: boolean;
  /**
   * Page déjà partagée (rubrique Pages) : on la partage à un nouveau
   * destinataire SANS recopier le contenu — titre, contenu et format sont
   * alors ignorés (vides).
   */
  pageId?: string;
}

export interface Fidelite {
  caracteres: number;
  lignes: number;
  /** La fin attendue du format est présente (ex. `</html>`) ; null si le format n'en a pas. */
  finPresente: boolean | null;
  /** Le contenu contient une marque d'abréviation typique d'un modèle (« … reste du code »). */
  abreviationSuspecte: boolean;
  /**
   * L'artefact lit ses données dans Claude (`window.claude`…) :
   * chez le client, il s'affichera VIDE. Vécu au premier essai (12/11) : un
   * « Poste de pilotage » branché sur l'agenda et les e-mails, partagé tel quel.
   * `window.storage` n'en est PLUS (23/11) : Getgents le sert (votes communs).
   */
  dependClaude: boolean;
  /** Adresses e-mail et téléphones écrits dans la page (repérage simple). */
  donnees: DonneesPersonnelles;
  /** Fichiers locaux (musique, photo…) que la page appelle par leur nom : à joindre depuis la fiche. */
  fichiers: string[];
  debut: string;
  fin: string;
}

const ABREVIATIONS = [
  /\/\/\s*\.\.\.\s*(rest|reste|suite|remaining|existing)/i,
  /\/\*\s*\.\.\.\s*\*\//,
  /<!--\s*\.\.\.\s*-->/,
  /\[\s*(\.\.\.|…)\s*(reste|suite|rest|remaining|contenu)[^\]]*\]/i,
  /\((reste|suite) (du|de l')\s*(code|contenu|artefact)[^)]*\)/i,
  /(rest|remainder) of (the )?(code|content|file) (unchanged|omitted|remains)/i,
  /contenu (tronqué|abrégé|omis)/i,
];

/** Ce qu'on peut dire de la copie reçue, sans l'original sous les yeux. */
const APPELS_CLAUDE = [/\bwindow\.claude\b/, /depuis claude\.ai/i, /\bclaude\.ai\b.{0,40}\bdonn[ée]es\b/i];

export function controleFidelite(contenu: string, format: FormatArtefact): Fidelite {
  const net = contenu.trim();
  let finPresente: boolean | null = null;
  if (format === "html") finPresente = /<\/html>\s*$/i.test(net) || (!/<html[\s>]/i.test(net) && /<\/[a-z0-9]+>\s*$/i.test(net));
  else if (format === "svg") finPresente = /<\/svg>\s*$/i.test(net);
  else if (format === "react") finPresente = /[};)]\s*$/.test(net);
  return {
    caracteres: contenu.length,
    lignes: contenu === "" ? 0 : contenu.split("\n").length,
    finPresente,
    abreviationSuspecte: ABREVIATIONS.some((re) => re.test(contenu)),
    dependClaude: APPELS_CLAUDE.some((re) => re.test(contenu)),
    donnees: donneesPersonnelles(contenu),
    fichiers: fichiersReferences(contenu),
    debut: net.slice(0, 80),
    fin: net.slice(-80),
  };
}

export type ResultatValidation = { ok: true; demande: DemandePartage } | { ok: false; erreur: string };

export function validerDemande(args: unknown): ResultatValidation {
  const a = (args && typeof args === "object" ? args : {}) as Record<string, unknown>;
  const texte = (v: unknown) => (typeof v === "string" ? v : "");
  const titre = texte(a.titre).trim();
  const contenu = texte(a.contenu);
  const destinataire = texte(a.destinataire).trim();
  const message = texte(a.message).trim();
  const format = FORMATS_ARTEFACT.includes(a.format as FormatArtefact) ? (a.format as FormatArtefact) : null;
  const assistant = a.assistant === true ? { assistant: true } : {};

  // Repartage d'une page existante : seul le destinataire compte.
  const page = texte(a.page).trim();
  if (page) {
    if (!/^[0-9a-f-]{36}$/i.test(page)) return { ok: false, erreur: "Identifiant de page invalide : prends-le dans un partage précédent ou dans lister_partages." };
    if (!destinataire) return { ok: false, erreur: "Destinataire vide : une adresse e-mail ou le nom du client." };
    if (destinataire.length > DESTINATAIRE_MAX) return { ok: false, erreur: "Destinataire trop long." };
    if (message.length > MESSAGE_MAX) return { ok: false, erreur: `Message trop long (${MESSAGE_MAX} caractères au plus).` };
    return {
      ok: true,
      demande: { titre: "", contenu: "", format: "html", destinataire, pageId: page.toLowerCase(), ...(message ? { message } : {}), ...assistant },
    };
  }

  if (!titre) return { ok: false, erreur: "Le titre est vide." };
  if (titre.length > TITRE_MAX) return { ok: false, erreur: `Titre trop long (${TITRE_MAX} caractères au plus).` };
  if (!contenu.trim()) return { ok: false, erreur: "Le contenu est vide : recopie le code COMPLET de la page (l'artefact ou le canvas)." };
  if (contenu.length > CONTENU_MAX) return { ok: false, erreur: `Contenu trop long (${CONTENU_MAX} caractères au plus).` };
  if (!format) return { ok: false, erreur: `Format inconnu : choisis parmi ${FORMATS_ARTEFACT.join(", ")}.` };
  // Sans destinataire : la page est créée SANS lien (vécu 23/11 : une page de
  // vote pour neuf personnes, que Claude refusait de partager faute d'un nom).
  // L'auteur crée ensuite, depuis sa fiche, un lien de groupe ou des liens.
  if (destinataire.length > DESTINATAIRE_MAX) return { ok: false, erreur: "Destinataire trop long." };
  if (message.length > MESSAGE_MAX) return { ok: false, erreur: `Message trop long (${MESSAGE_MAX} caractères au plus).` };
  return {
    ok: true,
    demande: { titre, contenu, format, destinataire, ...(message ? { message } : {}), ...assistant },
  };
}

export function estAdresseEmail(s: string): boolean {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);
}

/** Le mail que le commercial enverra lui-même : en phase 0, Getgents n'envoie rien. */
export function modeleMail(d: DemandePartage, lien: string, langue: Langue = "fr"): { objet: string; corps: string } {
  // Dans la langue des LECTEURS de la page (lot anglais 1) : c'est eux qui le lisent.
  const x = modeleMailTextes(langue);
  const appel = x.bonjour(estAdresseEmail(d.destinataire) ? null : d.destinataire);
  return {
    objet: d.titre,
    corps: [appel, "", d.message ?? x.phrase, lien, "", x.signature].join("\n"),
  };
}

// --- Partages d'un compte (lot 2) ------------------------------------------

/** Une ligne de « Mes partages » : tout sauf le contenu. */
export interface ResumePartage {
  jeton: string;
  titre: string;
  format: FormatArtefact;
  destinataire: string;
  caracteres: number;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  /** Assistant du document activé. */
  assistant?: boolean;
  /** Page partagée (rubrique Pages). */
  pageId?: string | null;
}

export type StatutPartage = "actif" | "revoque" | "expire";

export function statutPartage(p: Pick<ResumePartage, "expiresAt" | "revokedAt">, maintenant = Date.now()): StatutPartage {
  if (p.revokedAt) return "revoque";
  if (p.expiresAt && Date.parse(p.expiresAt) < maintenant) return "expire";
  return "actif";
}

const sansAccents = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/**
 * Filtre par titre ou destinataire, sans tenir compte des accents ni de la
 * casse : « marie » trouve « Marie Dupont » et « marie@acme.fr ». Chaque mot
 * de la recherche doit apparaître (ET), comme dans une barre de recherche.
 */
export function filtrerPartages<T extends Pick<ResumePartage, "titre" | "destinataire">>(liste: T[], recherche?: string): T[] {
  const mots = sansAccents(recherche ?? "").split(/\s+/).filter(Boolean);
  if (!mots.length) return liste;
  return liste.filter((p) => {
    const cible = sansAccents(`${p.titre} ${p.destinataire}`);
    return mots.every((m) => cible.includes(m));
  });
}

const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });

const LIBELLE_STATUT: Record<StatutPartage, string> = { actif: "actif", revoque: "révoqué", expire: "expiré" };

/** La liste telle que le modèle la lit : une ligne par partage, identifiant compris. */
export function texteListe(liste: ResumePartage[], base: string, maintenant = Date.now()): string {
  if (!liste.length) return "Aucun partage ne correspond.";
  return liste
    .map((p) => {
      const statut = statutPartage(p, maintenant);
      const fin = statut === "actif" && p.expiresAt ? `, expire le ${dateCourte(p.expiresAt)}` : "";
      const page = p.pageId ? ` — page ${p.pageId}` : "";
      return `- « ${p.titre} » → ${p.destinataire} — partagé le ${dateCourte(p.createdAt)}, ${LIBELLE_STATUT[statut]}${fin} — identifiant ${p.jeton}${page} — ${base}/partage/${p.jeton}`;
    })
    .join("\n");
}

// --- Protocole MCP ---------------------------------------------------------

export const VERSIONS_PROTOCOLE = ["2025-06-18", "2025-03-26", "2024-11-05"];
export const NOM_OUTIL = "partager_page";
/**
 * Ancien nom (jusqu'au 12/11). Claude GARDE la liste d'outils lue à l'ajout
 * du connecteur : une conversation qui l'a encore appelle `partager_artefact`.
 * On l'accepte toujours, sans plus l'annoncer.
 */
export const NOM_OUTIL_ANCIEN = "partager_artefact";

export const DESCRIPTION_OUTIL =
  // Décrit ce que fait l'outil et ce qu'il attend (critères de l'annuaire de
  // Claude, 23/11) : pas de consignes de comportement. Les vraies gardes
  // sont côté serveur (contrôle de fidélité, repérage des coordonnées et des
  // données branchées sur Claude), renvoyées dans la réponse de l'outil.
  "Partage une page avec un destinataire — ce que Claude appelle un artefact, ChatGPT et Mistral un canvas : " +
  "page HTML, document, schéma, application. Enregistre la page dans Getgents, crée un lien privé pour ce " +
  "destinataire et rend le lien avec un modèle de mail ; Getgents n'envoie aucun e-mail. " +
  "Pour une page déjà partagée, `page` (son identifiant) remplace titre, contenu et format. " +
  "Sans `destinataire` (page pour un groupe, destinataire pas encore connu), la page est enregistrée sans lien " +
  "et l'outil rend l'adresse de sa fiche, où l'utilisateur crée un lien de groupe ou des liens personnels. " +
  "`contenu` attend le code ou le texte complet de la page, à l'identique : le destinataire voit exactement ce " +
  "qui est envoyé, et un contenu abrégé (« ... », « reste du code inchangé ») s'affiche tel quel. Une page qui " +
  "lit des données en direct depuis Claude (window.claude : agenda, e-mails) ne les affiche pas chez le " +
  "destinataire : il faut une version figée, données actuelles écrites dans la page. Le destinataire voit tout " +
  "ce que la page contient, données personnelles comprises (agenda, e-mails, contacts) ; la réponse signale " +
  "les coordonnées repérées. Le stockage des artefacts (window.storage) fonctionne chez Getgents : les " +
  "données partagées (`shared`, des votes par exemple) sont communes à tous les lecteurs de la page. " +
  "Les fichiers (musique, photo, vidéo, PDF) ne passent pas par `contenu` : la page les appelle par leur nom " +
  "de fichier (src=\"musique.mp3\"), l'utilisateur les ajoute ensuite dans la fiche de la page, et l'outil " +
  "liste les noms repérés. " +
  "In English: shares an artifact or canvas privately with one recipient (client, team, group), who can reply " +
  "and ask an assistant about the page.";

export const SCHEMA_OUTIL = {
  type: "object",
  properties: {
    page: {
      type: "string",
      description: "Facultatif : identifiant d'une page déjà partagée. Avec lui, ne fournis ni titre, ni contenu, ni format.",
    },
    titre: { type: "string", description: "Titre de la page, tel que le client le lira (obligatoire sans `page`)." },
    contenu: {
      type: "string",
      description:
        "Le code ou le texte COMPLET de la page (l'artefact ou le canvas), à l'identique (obligatoire sans `page`). Pour une page HTML : le document entier, de <!DOCTYPE> à </html>.",
    },
    format: {
      type: "string",
      enum: [...FORMATS_ARTEFACT],
      description: "html (page ou document HTML), markdown, svg, react (composant JSX/TSX), texte.",
    },
    destinataire: {
      type: "string",
      description:
        "Facultatif : adresse e-mail, nom du client, ou nom d'un groupe. Sans destinataire, la page est enregistrée sans lien et l'utilisateur choisit dans Getgents à qui l'envoyer (lien de groupe, liens personnels).",
    },
    message: { type: "string", description: "Facultatif : mot d'accompagnement pour le mail." },
    assistant: {
      type: "boolean",
      description:
        "Facultatif, faux par défaut. Vrai si l'utilisateur veut que son client puisse poser des questions sur le document à un assistant IA, à côté de l'artefact (« avec l'assistant »). Les réponses sont facturées à l'utilisateur.",
    },
  },
  required: [],
  additionalProperties: false,
};

export const OUTIL_LISTER = "lister_partages";
export const OUTIL_REVOQUER = "revoquer_partage";

const DESCRIPTION_LISTER =
  "Liste les pages que l'utilisateur a partagées par Getgents, du plus récent au plus ancien : titre, " +
  "destinataire, date, statut (actif, révoqué, expiré), lien et identifiant. `recherche` filtre par titre ou " +
  "destinataire (« Marie », « offre Acme »).";

const DESCRIPTION_REVOQUER =
  "Révoque un lien de partage : son destinataire ne peut plus ouvrir la page. Irréversible. " +
  "`identifiant` est celui que rend lister_partages ; quand plusieurs partages correspondent à la demande, " +
  "l'utilisateur est le seul à savoir lequel couper.";

const SCHEMA_LISTER = {
  type: "object",
  properties: { recherche: { type: "string", description: "Facultatif : mots du titre ou du destinataire." } },
  additionalProperties: false,
};

const SCHEMA_REVOQUER = {
  type: "object",
  properties: { identifiant: { type: "string", description: "Identifiant du partage, tel que rendu par lister_partages." } },
  required: ["identifiant"],
  additionalProperties: false,
};

export const OUTIL_METTRE_A_JOUR = "mettre_a_jour_page";

const DESCRIPTION_METTRE_A_JOUR =
  "Remplace le contenu d'une page déjà partagée par une nouvelle version : tous ses liens affichent aussitôt " +
  "la nouvelle version, l'ancienne est gardée et restaurable depuis Getgents. `contenu` attend le code ou le " +
  "texte complet de la nouvelle version, à l'identique — pas un extrait ni une différence. Pour un document " +
  "différent, partager_page crée une nouvelle page.";

const SCHEMA_METTRE_A_JOUR = {
  type: "object",
  properties: {
    page: { type: "string", description: "Identifiant de la page (rendu par le partage ou par lister_partages)." },
    contenu: { type: "string", description: "Le contenu COMPLET de la nouvelle version, à l'identique." },
    titre: { type: "string", description: "Facultatif : nouveau titre." },
    format: { type: "string", enum: [...FORMATS_ARTEFACT], description: "Facultatif : nouveau format." },
  },
  required: ["page", "contenu"],
  additionalProperties: false,
};

export const INSTRUCTIONS_SERVEUR =
  "Getgents partage par un lien privé les pages qu'un utilisateur destine à quelqu'un — un artefact dans " +
  "Claude, un canvas dans ChatGPT ou Mistral. partager_page crée la page et un lien par destinataire, et rend " +
  "le lien et un modèle de mail : Getgents n'envoie aucun e-mail, c'est l'utilisateur qui l'envoie. " +
  "lister_partages retrouve les liens envoyés, revoquer_partage en coupe un, mettre_a_jour_page remplace le " +
  "contenu d'une page partagée. Une page déjà partagée se renvoie à quelqu'un d'autre par son identifiant " +
  "(`page`), sans recopier son contenu. " +
  "In English: Getgents shares an artifact or canvas privately — one link per recipient, who can reply and ask " +
  "an assistant about the page; it sends no e-mail itself.";

export interface ContexteMcp {
  /** Crée (ou retrouve) la page SANS lien : partage sans destinataire. */
  creerPage?: (d: DemandePartage) => Promise<{ pageId: string; nouvellePage: boolean; titre: string }>;
  /** Enregistre l'artefact et rend son lien public. */
  enregistrer: (
    d: DemandePartage,
    fidelite: Fidelite | null
  ) => Promise<{ lien: string; pageId?: string; nouvellePage?: boolean; titre?: string; assistant?: boolean; langue?: Langue } | null>;
  /** Nouvelle version d'une page du compte ; null si elle n'existe pas. */
  mettreAJour?: (
    pageId: string,
    d: { contenu: string; titre?: string; format?: FormatArtefact }
  ) => Promise<{ version: number; liens: number; format: FormatArtefact } | null>;
  /** Partages du compte connecté (absent : outils de gestion non proposés). */
  lister?: () => Promise<ResumePartage[]>;
  /** Révoque un partage DU compte connecté ; faux s'il n'existe pas, n'est pas à lui, ou l'était déjà. */
  revoquer?: (jeton: string) => Promise<boolean>;
  /** Origine publique, pour écrire les liens de la liste. */
  base?: string;
}

type Id = string | number | null;
interface Requete {
  jsonrpc?: string;
  id?: Id;
  method?: string;
  params?: Record<string, unknown>;
}
export type ReponseRpc =
  | { jsonrpc: "2.0"; id: Id; result: unknown }
  | { jsonrpc: "2.0"; id: Id; error: { code: number; message: string } };

const erreurRpc = (id: Id, code: number, message: string): ReponseRpc => ({ jsonrpc: "2.0", id, error: { code, message } });

function alertesFidelite(f: Fidelite): string[] {
  const alertes: string[] = [];
  if (f.finPresente === false) alertes.push("la fin attendue du document est ABSENTE : la copie est probablement tronquée");
  if (f.abreviationSuspecte) alertes.push("le contenu contient une marque d'abréviation (« ... reste du code ») : la copie est probablement incomplète");
  if (f.dependClaude)
    alertes.push(
      "la page lit ses données EN DIRECT dans Claude : chez le client, ces blocs resteront vides. Propose une version FIGÉE (données actuelles écrites dans la page, datées), et vérifie avec l'utilisateur qu'elle ne contient rien de personnel"
    );
  return alertes;
}

/** Coordonnées écrites dans la page : à faire relire, sans parler de troncature. */
const ligneDonnees = (f: Fidelite) => {
  const t = [...f.donnees.emails, ...f.donnees.telephones];
  return t.length
    ? `Données personnelles repérées dans la page (${t.slice(0, 3).join(", ")}${t.length > 3 ? "…" : ""}) : demande à l'utilisateur de confirmer qu'elles peuvent être vues par le destinataire ; sinon, revoquer_partage coupe le lien.`
    : "";
};

/** Médias appelés par leur nom : ils ne passent pas par `contenu`, l'utilisateur les joint dans Getgents. */
const ligneFichiers = (f: Fidelite) =>
  f.fichiers.length
    ? `Fichiers appelés par la page : ${f.fichiers.slice(0, 8).join(", ")}${f.fichiers.length > 8 ? "…" : ""}. Ils ne voyagent pas avec le contenu : l'utilisateur les ajoute dans la fiche de la page (Getgents, Mes pages, bloc « Fichiers de la page »), sous ces noms ; d'ici là, ces emplacements restent vides chez le destinataire.`
    : "";

const ligneFidelite = (f: Fidelite) => {
  const alertes = alertesFidelite(f);
  return alertes.length
    ? `ATTENTION — ${alertes.join(" ; ")}. Préviens l'utilisateur et propose de recommencer avec le contenu intégral.`
    : "Contrôle de fidélité : aucune trace de troncature détectée.";
};

function texteResultat(
  f: Fidelite | null,
  lien: string,
  mail: { objet: string; corps: string },
  r: { assistant: boolean; pageId?: string; nouvellePage?: boolean }
): string {
  const page = r.pageId
    ? f === null
      ? `Page existante (identifiant ${r.pageId}) partagée à un nouveau destinataire : aucun contenu recopié, le lien affiche sa dernière version.`
      : r.nouvellePage
        ? `Nouvelle page créée dans Getgents, identifiant ${r.pageId}. Pour l'envoyer à quelqu'un d'autre, passe ce \`page\` au lieu de recopier le contenu ; pour la corriger, mettre_a_jour_page.`
        : `Ce contenu existait déjà : même page (identifiant ${r.pageId}), nouveau lien pour ce destinataire.`
    : "";
  return [
    `Lien privé : ${lien}`,
    "",
    `Objet : ${mail.objet}`,
    mail.corps,
    "",
    page,
    f ? `Reçu : ${f.caracteres} caractères, ${f.lignes} lignes.` : "",
    r.assistant
      ? "Assistant du document ACTIVÉ sur cette page : le client peut poser des questions à côté ; les réponses sont facturées à l'utilisateur."
      : "Assistant du document non activé (l'utilisateur peut l'activer sur la page, dans Getgents).",
    f ? ligneFidelite(f) : "",
    f ? ligneDonnees(f) : "",
    f ? ligneFichiers(f) : "",
    "",
    "Donne à l'utilisateur le lien et le modèle de mail ci-dessus, et rappelle-lui que c'est à lui d'envoyer le mail.",
  ]
    .filter((l, i, t) => l !== "" || (t[i - 1] ?? "") !== "")
    .join("\n");
}

/** Réponse d'un partage SANS destinataire : la page existe, aucun lien n'est encore créé. */
function texteSansDestinataire(f: Fidelite, fiche: string, p: { pageId: string; nouvellePage: boolean }): string {
  return [
    p.nouvellePage
      ? `Page enregistrée dans Getgents (identifiant ${p.pageId}), SANS lien pour l'instant.`
      : `Ce contenu existait déjà : même page (identifiant ${p.pageId}), aucun lien créé.`,
    `Fiche de la page : ${fiche}`,
    "Depuis la fiche, l'utilisateur choisit à qui l'envoyer : un LIEN DE GROUPE (un seul lien à poster dans un groupe WhatsApp, chacun choisit son prénom) ou un lien par personne. Pour un destinataire précis, rappelle partager_page avec `page` et `destinataire`.",
    `Reçu : ${f.caracteres} caractères, ${f.lignes} lignes.`,
    ligneFidelite(f),
    ligneDonnees(f),
    ligneFichiers(f),
    "",
    "Donne à l'utilisateur l'adresse de la fiche. Aucun e-mail n'est parti.",
  ]
    .filter((l, i, t) => l !== "" || (t[i - 1] ?? "") !== "")
    .join("\n");
}

/** Traite UN message JSON-RPC. Renvoie null pour une notification (pas de réponse due). */
export async function traiterMessage(msg: unknown, ctx: ContexteMcp): Promise<ReponseRpc | null> {
  const r = (msg && typeof msg === "object" ? msg : {}) as Requete;
  const id: Id = r.id ?? null;
  const notification = r.id === undefined;
  if (r.jsonrpc !== "2.0" || typeof r.method !== "string") {
    return notification ? null : erreurRpc(id, -32600, "Requête JSON-RPC invalide");
  }
  if (notification) return null; // notifications/initialized, notifications/cancelled…

  switch (r.method) {
    case "initialize": {
      const demandee = typeof r.params?.protocolVersion === "string" ? r.params.protocolVersion : "";
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: VERSIONS_PROTOCOLE.includes(demandee) ? demandee : VERSIONS_PROTOCOLE[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "getgents", title: "Getgents Pages", version: "1.0.0" },
          instructions: INSTRUCTIONS_SERVEUR,
        },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            {
              name: NOM_OUTIL,
              title: "Partager une page avec un client",
              description: DESCRIPTION_OUTIL,
              inputSchema: SCHEMA_OUTIL,
              annotations: { title: "Partager une page avec un client", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
            },
            ...(ctx.lister
              ? [
                  {
                    name: OUTIL_LISTER,
                    title: "Lister mes partages",
                    description: DESCRIPTION_LISTER,
                    inputSchema: SCHEMA_LISTER,
                    annotations: { title: "Lister mes partages", readOnlyHint: true, openWorldHint: false },
                  },
                ]
              : []),
            ...(ctx.mettreAJour
              ? [
                  {
                    name: OUTIL_METTRE_A_JOUR,
                    title: "Mettre à jour une page partagée",
                    description: DESCRIPTION_METTRE_A_JOUR,
                    inputSchema: SCHEMA_METTRE_A_JOUR,
                    annotations: {
                      title: "Mettre à jour une page partagée",
                      readOnlyHint: false,
                      // Remplace le contenu visible par tous les liens : Claude demande confirmation.
                      destructiveHint: true,
                      idempotentHint: false,
                      openWorldHint: true,
                    },
                  },
                ]
              : []),
            ...(ctx.revoquer
              ? [
                  {
                    name: OUTIL_REVOQUER,
                    title: "Révoquer un partage",
                    description: DESCRIPTION_REVOQUER,
                    inputSchema: SCHEMA_REVOQUER,
                    annotations: { title: "Révoquer un partage", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
                  },
                ]
              : []),
          ],
        },
      };
    case "tools/call": {
      const echec = (texte: string): ReponseRpc => ({ jsonrpc: "2.0", id, result: { isError: true, content: [{ type: "text", text: texte }] } });
      const args = (r.params?.arguments && typeof r.params.arguments === "object" ? r.params.arguments : {}) as Record<string, unknown>;
      if (r.params?.name === OUTIL_LISTER && ctx.lister) {
        try {
          const recherche = typeof args.recherche === "string" ? args.recherche.slice(0, 200) : undefined;
          const liste = filtrerPartages(await ctx.lister(), recherche).slice(0, 30);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: texteListe(liste, ctx.base ?? "") }],
              structuredContent: {
                partages: liste.map((p) => ({ ...p, statut: statutPartage(p), lien: `${ctx.base ?? ""}/partage/${p.jeton}` })),
              },
            },
          };
        } catch {
          return echec("La liste des partages n'a pas pu être lue. Réessaie dans un instant.");
        }
      }
      if (r.params?.name === OUTIL_REVOQUER && ctx.revoquer) {
        const jeton = typeof args.identifiant === "string" ? args.identifiant.trim() : "";
        if (!jeton) return echec("identifiant manquant : prends-le dans lister_partages.");
        try {
          const coupe = await ctx.revoquer(jeton);
          return {
            jsonrpc: "2.0",
            id,
            result: coupe
              ? { content: [{ type: "text", text: "Lien révoqué : le destinataire ne peut plus ouvrir la page." }], structuredContent: { revoque: true } }
              : {
                  isError: true,
                  content: [
                    {
                      type: "text",
                      text: "Aucun partage actif de ce compte ne porte cet identifiant (déjà révoqué, ou introuvable). Vérifie avec lister_partages.",
                    },
                  ],
                },
          };
        } catch {
          return echec("La révocation n'a pas pu être enregistrée. Réessaie dans un instant.");
        }
      }
      if (r.params?.name === OUTIL_METTRE_A_JOUR && ctx.mettreAJour) {
        const page = typeof args.page === "string" ? args.page.trim().toLowerCase() : "";
        const contenu = typeof args.contenu === "string" ? args.contenu : "";
        const format = FORMATS_ARTEFACT.includes(args.format as FormatArtefact) ? (args.format as FormatArtefact) : undefined;
        const titre = typeof args.titre === "string" ? args.titre.trim().slice(0, TITRE_MAX) : undefined;
        if (!/^[0-9a-f-]{36}$/.test(page)) return echec("Identifiant de page manquant ou invalide : prends-le dans lister_partages.");
        if (!contenu.trim()) return echec("Le contenu est vide : envoie le code COMPLET de la nouvelle version.");
        if (contenu.length > CONTENU_MAX) return echec(`Contenu trop long (${CONTENU_MAX} caractères au plus).`);
        try {
          const maj = await ctx.mettreAJour(page, { contenu, titre: titre || undefined, format });
          if (!maj) return echec("Aucune page de ce compte ne porte cet identifiant. Vérifie avec lister_partages.");
          // Contrôle avec le format que la page a désormais (inchangé si l'appel n'en donne pas).
          const f = controleFidelite(contenu, maj.format);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: [
                    `Page mise à jour : version ${maj.version}. Ses ${maj.liens} lien(s) actif(s) affichent désormais cette version ; la précédente est gardée et restaurable.`,
                    `Reçu : ${f.caracteres} caractères, ${f.lignes} lignes.`,
                    ligneFidelite(f),
                    ligneFichiers(f),
                    "Aucun e-mail n'est parti : si l'utilisateur veut prévenir ses destinataires, c'est à lui de le faire.",
                  ]
                    .filter(Boolean)
                    .join("\n"),
                },
              ],
              structuredContent: { page, version: maj.version, liens: maj.liens, fidelite: f },
            },
          };
        } catch {
          return echec("La mise à jour n'a pas pu être enregistrée. Réessaie dans un instant.");
        }
      }
      if (r.params?.name !== NOM_OUTIL && r.params?.name !== NOM_OUTIL_ANCIEN) return erreurRpc(id, -32602, `Outil inconnu : ${String(r.params?.name)}`);
      const v = validerDemande(r.params?.arguments);
      // Une erreur de saisie est un RÉSULTAT d'outil en échec, que le modèle lit et corrige.
      if (!v.ok) return echec(v.erreur);
      // Repartage d'une page : rien n'a été recopié, il n'y a rien à contrôler.
      const fidelite = v.demande.pageId ? null : controleFidelite(v.demande.contenu, v.demande.format);
      // Sans destinataire : la page seule, puis la fiche pour choisir à qui l'envoyer.
      if (!v.demande.destinataire && fidelite) {
        if (!ctx.creerPage) return echec("Destinataire vide : une adresse e-mail, le nom du client ou le nom d'un groupe.");
        try {
          const p = await ctx.creerPage(v.demande);
          const fiche = `${ctx.base ?? ""}/pages/${p.pageId}`;
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: texteSansDestinataire(fidelite, fiche, p) }],
              structuredContent: { lien: null, page: p.pageId, fiche, fidelite },
            },
          };
        } catch (e) {
          if (e instanceof PlafondAtteint) return echec(`${e.message} Dis-le à l'utilisateur ; ne réessaie pas.`);
          return echec("La page n'a pas pu être enregistrée. Réessaie dans un instant.");
        }
      }
      try {
        const res = await ctx.enregistrer(v.demande, fidelite);
        if (!res) return echec("Aucune page de ce compte ne porte cet identifiant. Vérifie avec lister_partages, ou partage le contenu complet.");
        const mail = modeleMail({ ...v.demande, titre: res.titre ?? v.demande.titre }, res.lien, res.langue);
        const assistant = res.assistant ?? v.demande.assistant === true;
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: texteResultat(fidelite, res.lien, mail, { assistant, pageId: res.pageId, nouvellePage: res.nouvellePage }) }],
            structuredContent: { lien: res.lien, page: res.pageId ?? null, objet: mail.objet, corps: mail.corps, fidelite },
          },
        };
      } catch (e) {
        // Plafond de l'offre « pages » : un message à transmettre tel quel, pas une panne.
        if (e instanceof PlafondAtteint) return echec(`${e.message} Dis-le à l'utilisateur ; ne réessaie pas.`);
        return echec("Le partage n'a pas pu être enregistré. Réessaie dans un instant.");
      }
    }
    default:
      return erreurRpc(id, -32601, `Méthode inconnue : ${r.method}`);
  }
}
