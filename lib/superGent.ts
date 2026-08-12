import type { Espace, EspacesMap } from "@/lib/types";

/**
 * « Super gent » : la page d'accueil du Gent' space. Une seule barre de saisie,
 * une question, et le gent le mieux placé y répond avec son runtime complet.
 *
 * Ce module tient la partie DÉTERMINISTE — description des gents pour le
 * routage, agrégation des suggestions, choix du gent à partir de la réponse du
 * classifieur. L'appel au modèle vit dans app/api/supergent/route.ts.
 */

/** Fiche compacte d'un gent, envoyée au classifieur. Jamais son prompt entier. */
export interface GentDescriptor {
  id: string;
  name: string;
  icon: string;
  /** Ce que le gent sait faire, en une ou deux phrases. */
  summary: string;
}

/** Un gent « actif » au sens de la liste du rail : utilisable pour répondre. */
export function isRoutableGent(espace: Espace): boolean {
  // Les mini-applications ne conversent pas : elles produisent un tableau de
  // bord à partir d'entrées. Les router reviendrait à leur poser une question
  // à laquelle elles n'ont aucun moyen de répondre.
  if (espace.pinnedArtefact?.enabled) return false;
  return !!espace.systemPrompt?.trim();
}

/**
 * Résumé d'un gent pour le routage. On prend l'amorce du prompt du créateur —
 * c'est là qu'il décrit le rôle — plutôt que le prompt entier : le classifieur
 * doit comparer des gents, pas les incarner.
 */
const SUMMARY_CHARS = 400;

export function describeGent(id: string, espace: Espace): GentDescriptor {
  const prompt = (espace.systemPrompt ?? "").trim();
  // Le prompt publié commence par les blocs plateforme ; la consigne du
  // créateur ferme le message (voir draftToEspace). C'est elle qui décrit le
  // rôle, donc on lit la FIN.
  const marker = "INSTRUCTIONS DU GENT";
  const creator = prompt.includes(marker) ? prompt.slice(prompt.indexOf(marker) + marker.length) : prompt;
  const tail = creator.length > SUMMARY_CHARS ? creator.slice(0, SUMMARY_CHARS) : creator;

  const capacites: string[] = [];
  if (espace.webSearch) capacites.push("recherche web");
  if (espace.restApis?.length) capacites.push(`API : ${espace.restApis.map((r) => r.name).join(", ")}`);
  if (espace.datasets?.length) capacites.push("données open data");
  if (espace.prim) capacites.push("transports Île-de-France");
  if (espace.powens) capacites.push("données bancaires");
  if (espace.gmail) capacites.push("Gmail");
  if (espace.visionneuse?.enabled) capacites.push("lecture d'un document de référence");
  if (espace.files?.some((f) => f.date === "Base de connaissance")) capacites.push("base de connaissance documentaire");

  return {
    id,
    name: espace.gent || espace.name,
    icon: espace.icon,
    summary: [tail.replace(/\s+/g, " ").trim(), capacites.length ? `Capacités : ${capacites.join(" ; ")}.` : ""]
      .filter(Boolean)
      .join(" "),
  };
}

export function describeGents(espaces: EspacesMap): GentDescriptor[] {
  return Object.entries(espaces)
    .filter(([, e]) => isRoutableGent(e))
    .map(([id, e]) => describeGent(id, e));
}

/**
 * Idées de questions proposées sous la barre de saisie.
 *
 * Elles sont AGRÉGÉES depuis les déclencheurs déjà générés par chaque gent
 * (voir lib/starterSignal.ts) plutôt que produites par un appel de plus : elles
 * reflètent donc exactement les gents actifs, et suivent leurs évolutions sans
 * travail supplémentaire. Un gent sans déclencheur est représenté par son
 * objectif, pour qu'aucun gent actif ne soit absent de la liste.
 */
export function suggestionsFromGents(espaces: EspacesMap, max = 5): { gentId: string; question: string }[] {
  const routable = Object.entries(espaces).filter(([, e]) => isRoutableGent(e));
  const out: { gentId: string; question: string }[] = [];

  // Un tour par gent avant d'en reprendre un second : la liste couvre ainsi la
  // FAMILLE de gents plutôt que d'être monopolisée par le plus bavard.
  for (let round = 0; out.length < max; round++) {
    let addedThisRound = false;
    for (const [id, espace] of routable) {
      if (out.length >= max) break;
      const question = espace.starters?.[round];
      if (!question) continue;
      out.push({ gentId: id, question });
      addedThisRound = true;
    }
    if (!addedThisRound) break;
  }

  return out;
}

/** Réponse attendue du classifieur. */
export interface RoutingDecision {
  gentId: string | null;
  reason?: string;
}

/**
 * Choisit le gent à mobiliser à partir de la sortie brute du classifieur.
 *
 * `currentGentId` porte l'INERTIE demandée : une relance elliptique (« et pour
 * Lyon ? ») n'a pas assez de matière pour être classée seule, et repartirait
 * sur un gent au hasard. Le classifieur est donc invité à conserver le gent en
 * cours par défaut, et on ne bascule que sur un choix explicite et valide.
 */
export function resolveRouting(
  raw: string,
  descriptors: GentDescriptor[],
  currentGentId?: string | null
): RoutingDecision {
  const known = new Set(descriptors.map((d) => d.id));

  let parsed: { gentId?: unknown; reason?: unknown } | null = null;
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      parsed = null;
    }
  }

  const picked = typeof parsed?.gentId === "string" ? parsed.gentId.trim() : "";
  const reason = typeof parsed?.reason === "string" ? parsed.reason.trim() : undefined;

  if (picked && known.has(picked)) return { gentId: picked, reason };
  // « aucun » explicite, ou identifiant inventé : on ne force jamais un gent au
  // hasard — mieux vaut le dire (voir SuperGentThread).
  if (picked && picked.toLowerCase() !== "null" && picked.toLowerCase() !== "aucun") {
    return { gentId: currentGentId && known.has(currentGentId) ? currentGentId : null, reason };
  }
  return { gentId: null, reason };
}

/** Consigne de classement envoyée au modèle. */
export function routingPrompt(descriptors: GentDescriptor[], currentGentId?: string | null): string {
  const list = descriptors.map((d) => `- id="${d.id}" — ${d.name} : ${d.summary}`).join("\n");
  const inertie = currentGentId
    ? `\n\nLe gent « ${currentGentId} » répond déjà dans cette conversation. Si la question est une relance, ` +
      "une précision ou reste dans son domaine — y compris quand elle est elliptique (« et pour Lyon ? », " +
      "« combien ? ») — GARDE-LE. Ne change que si la question relève clairement d'un autre gent."
    : "";

  return (
    "Tu es un routeur. On te donne la liste des gents (assistants spécialisés) d'un utilisateur et sa question. " +
    "Désigne LE gent le mieux placé pour y répondre.\n\n" +
    `GENTS DISPONIBLES :\n${list}${inertie}\n\n` +
    "Réponds UNIQUEMENT par un objet JSON, sans texte autour :\n" +
    '{"gentId":"<id exact d\'un gent ci-dessus, ou null>","reason":"<10 mots max>"}\n\n' +
    "Mets null si AUCUN gent ne couvre le sujet : ne rattache jamais une question à un gent " +
    "par simple proximité de vocabulaire — un utilisateur préfère un « aucun de vos gents ne couvre ça » " +
    "à une réponse hors sujet."
  );
}
