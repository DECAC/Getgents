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
}

export interface Fidelite {
  caracteres: number;
  lignes: number;
  /** La fin attendue du format est présente (ex. `</html>`) ; null si le format n'en a pas. */
  finPresente: boolean | null;
  /** Le contenu contient une marque d'abréviation typique d'un modèle (« … reste du code »). */
  abreviationSuspecte: boolean;
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

  if (!titre) return { ok: false, erreur: "Le titre est vide." };
  if (titre.length > TITRE_MAX) return { ok: false, erreur: `Titre trop long (${TITRE_MAX} caractères au plus).` };
  if (!contenu.trim()) return { ok: false, erreur: "Le contenu est vide : recopie le code COMPLET de l'artefact." };
  if (contenu.length > CONTENU_MAX) return { ok: false, erreur: `Contenu trop long (${CONTENU_MAX} caractères au plus).` };
  if (!format) return { ok: false, erreur: `Format inconnu : choisis parmi ${FORMATS_ARTEFACT.join(", ")}.` };
  if (!destinataire) return { ok: false, erreur: "Destinataire vide : une adresse e-mail ou le nom du client." };
  if (destinataire.length > DESTINATAIRE_MAX) return { ok: false, erreur: "Destinataire trop long." };
  if (message.length > MESSAGE_MAX) return { ok: false, erreur: `Message trop long (${MESSAGE_MAX} caractères au plus).` };
  return { ok: true, demande: { titre, contenu, format, destinataire, ...(message ? { message } : {}) } };
}

export function estAdresseEmail(s: string): boolean {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);
}

/** Le mail que le commercial enverra lui-même : en phase 0, Getgents n'envoie rien. */
export function modeleMail(d: DemandePartage, lien: string): { objet: string; corps: string } {
  const appel = estAdresseEmail(d.destinataire) ? "Bonjour," : `Bonjour ${d.destinataire},`;
  return {
    objet: d.titre,
    corps: [appel, "", d.message ?? "Comme convenu, voici le document préparé pour vous :", lien, "", "Bonne lecture,"].join("\n"),
  };
}

// --- Protocole MCP ---------------------------------------------------------

export const VERSIONS_PROTOCOLE = ["2025-06-18", "2025-03-26", "2024-11-05"];
export const NOM_OUTIL = "partager_artefact";

export const DESCRIPTION_OUTIL =
  "Partage un artefact (page HTML, document, schéma, application) avec un client : crée un lien privé " +
  "Getgents qui l'affiche en pleine page, et rédige le mail à lui envoyer. " +
  "IMPORTANT : `contenu` doit être le code ou le texte COMPLET de l'artefact, recopié À L'IDENTIQUE, " +
  "du premier au dernier caractère. Ne résume pas, ne tronque pas, n'abrège pas (aucun « ... » ni " +
  "« reste du code inchangé »), ne reformate pas : le client verra exactement ce que tu envoies.";

export const SCHEMA_OUTIL = {
  type: "object",
  properties: {
    titre: { type: "string", description: "Titre de l'artefact, tel que le client le lira." },
    contenu: {
      type: "string",
      description:
        "Le code ou le texte COMPLET de l'artefact, à l'identique. Pour une page HTML : le document entier, de <!DOCTYPE> à </html>.",
    },
    format: {
      type: "string",
      enum: [...FORMATS_ARTEFACT],
      description: "html (page ou document HTML), markdown, svg, react (composant JSX/TSX), texte.",
    },
    destinataire: { type: "string", description: "Adresse e-mail ou nom du client destinataire." },
    message: { type: "string", description: "Facultatif : mot d'accompagnement pour le mail." },
  },
  required: ["titre", "contenu", "format", "destinataire"],
  additionalProperties: false,
};

export const INSTRUCTIONS_SERVEUR =
  "Getgents publie les artefacts que l'utilisateur veut partager avec un client. Quand il demande de " +
  "partager, d'envoyer ou de transmettre un artefact, appelle partager_artefact avec son contenu COMPLET, " +
  "puis donne-lui le lien et le modèle de mail. Getgents n'envoie aucun e-mail : c'est l'utilisateur qui " +
  "l'envoie. Ne dis jamais que le mail est parti.";

export interface ContexteMcp {
  /** Enregistre l'artefact et rend son lien public. */
  enregistrer: (d: DemandePartage, fidelite: Fidelite) => Promise<{ lien: string }>;
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

function texteResultat(f: Fidelite, lien: string, mail: { objet: string; corps: string }): string {
  const alertes: string[] = [];
  if (f.finPresente === false) alertes.push("la fin attendue du document est ABSENTE : la copie est probablement tronquée");
  if (f.abreviationSuspecte) alertes.push("le contenu contient une marque d'abréviation (« ... reste du code ») : la copie est probablement incomplète");
  return [
    `Lien privé : ${lien}`,
    "",
    `Objet : ${mail.objet}`,
    mail.corps,
    "",
    `Reçu : ${f.caracteres} caractères, ${f.lignes} lignes.`,
    alertes.length
      ? `ATTENTION — ${alertes.join(" ; ")}. Préviens l'utilisateur et propose de recommencer avec le contenu intégral.`
      : "Contrôle de fidélité : aucune trace de troncature détectée.",
    "",
    "Donne à l'utilisateur le lien et le modèle de mail ci-dessus, et rappelle-lui que c'est à lui d'envoyer le mail.",
  ].join("\n");
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
          serverInfo: { name: "getgents", title: "Getgents — partage d'artefacts", version: "0.1.0" },
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
              title: "Partager un artefact avec un client",
              description: DESCRIPTION_OUTIL,
              inputSchema: SCHEMA_OUTIL,
              annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
            },
          ],
        },
      };
    case "tools/call": {
      if (r.params?.name !== NOM_OUTIL) return erreurRpc(id, -32602, `Outil inconnu : ${String(r.params?.name)}`);
      const v = validerDemande(r.params?.arguments);
      // Une erreur de saisie est un RÉSULTAT d'outil en échec, que le modèle lit et corrige.
      if (!v.ok) return { jsonrpc: "2.0", id, result: { isError: true, content: [{ type: "text", text: v.erreur }] } };
      const fidelite = controleFidelite(v.demande.contenu, v.demande.format);
      try {
        const { lien } = await ctx.enregistrer(v.demande, fidelite);
        const mail = modeleMail(v.demande, lien);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: texteResultat(fidelite, lien, mail) }],
            structuredContent: { lien, objet: mail.objet, corps: mail.corps, fidelite },
          },
        };
      } catch {
        return { jsonrpc: "2.0", id, result: { isError: true, content: [{ type: "text", text: "Le partage n'a pas pu être enregistré. Réessaie dans un instant." }] } };
      }
    }
    default:
      return erreurRpc(id, -32601, `Méthode inconnue : ${r.method}`);
  }
}
