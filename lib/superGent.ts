import type { Espace, EspacesMap } from "@/lib/types";

/**
 * « Super gent » : la page d'accueil du Gent' space. Une seule barre de saisie,
 * une question, et le gent le mieux placé y répond avec son runtime complet.
 *
 * Ce module tient la partie DÉTERMINISTE — description des gents pour le
 * routage, agrégation des suggestions, choix du gent à partir de la réponse du
 * classifieur. L'appel au modèle vit dans app/api/supergent/route.ts.
 */

/**
 * Modèle du routeur. Le classement est une tâche courte et cadrée (choisir un
 * identifiant dans une liste) : un modèle rapide et bon marché y suffit, et
 * c'est ce qui garde la page d'accueil réactive. La RÉPONSE, elle, reste
 * produite par le modèle propre au gent retenu.
 */
export const SUPER_GENT_ROUTER_MODEL = "google/gemini-2.5-flash";

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
  currentGentId?: string | null,
  options?: { hasConversationContext?: boolean }
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

  const pickedRaw = parsed?.gentId;
  const picked =
    typeof pickedRaw === "string"
      ? pickedRaw.trim()
      : pickedRaw === null
        ? "null"
        : "";
  const reason = typeof parsed?.reason === "string" ? parsed.reason.trim() : undefined;
  const isExplicitNone = !picked || picked.toLowerCase() === "null" || picked.toLowerCase() === "aucun";

  if (picked && !isExplicitNone && known.has(picked)) return { gentId: picked, reason };
  // Id inventé : on retombe sur le gent en cours plutôt que d'échouer.
  if (picked && !isExplicitNone) {
    return { gentId: currentGentId && known.has(currentGentId) ? currentGentId : null, reason };
  }
  // « aucun » explicite dans un fil en cours : conserver le gent mobilisé pour
  // les relances elliptiques (ex. « synthèse MyClaw » après un bilan Gmail).
  if (options?.hasConversationContext && currentGentId && known.has(currentGentId)) {
    return { gentId: currentGentId, reason: reason ?? "suite du fil en cours" };
  }
  return { gentId: null, reason };
}

/** Un échange du fil, tel que le rapport d'administration le restitue. */
export interface SuperGentReportEntry {
  question: string;
  /** Gent mobilisé — absent quand aucun ne couvrait le sujet. */
  gentName?: string;
  gentId?: string;
  /** Motif renvoyé par le routeur. */
  reason?: string;
  /** Modèle qui a produit la réponse (celui du gent, pas celui du routeur). */
  model?: string;
  durationMs?: number;
  answer: string;
}

/**
 * Rapport d'administration du super gent.
 *
 * Il ne restitue pas seulement le transcript : il expose le ROUTAGE, seule
 * partie réellement opaque de la fonctionnalité. Pour chaque question on voit
 * le vivier de gents disponibles, celui qui a été retenu, le motif, le modèle
 * et le temps de réponse — de quoi diagnostiquer un mauvais aiguillage plutôt
 * que de le constater sans pouvoir l'expliquer.
 */
export function buildSuperGentReport(
  entries: SuperGentReportEntry[],
  descriptors: GentDescriptor[],
  routerModel: string
): string {
  const lines: string[] = [];
  lines.push("# Rapport — Super gent");
  lines.push(`Généré le ${new Date().toLocaleString("fr-FR")}`);
  lines.push("");

  lines.push("## Vivier de routage");
  lines.push(`- **Modèle du routeur** : ${routerModel}`);
  lines.push(`- **Gents interrogeables** : ${descriptors.length}`);
  for (const d of descriptors) lines.push(`  - \`${d.id}\` — ${d.name}`);
  lines.push("");

  lines.push("## Aiguillage");
  if (entries.length === 0) {
    lines.push("_Aucun échange dans cette session._");
  } else {
    const counts = new Map<string, number>();
    for (const e of entries) {
      const key = e.gentName ?? "— aucun gent —";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    lines.push("| Gent mobilisé | Questions |");
    lines.push("| --- | --- |");
    for (const [name, n] of Array.from(counts.entries()).sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${name} | ${n} |`);
    }
    lines.push("");

    lines.push("## Échanges");
    entries.forEach((e, i) => {
      lines.push(`### ${i + 1}. ${e.question}`);
      lines.push(
        `- **Gent** : ${e.gentName ?? "aucun (question hors du domaine des gents actifs)"}` +
          (e.gentId ? ` (\`${e.gentId}\`)` : "")
      );
      if (e.reason) lines.push(`- **Motif du routeur** : ${e.reason}`);
      if (e.model) lines.push(`- **Modèle de réponse** : ${e.model}`);
      if (typeof e.durationMs === "number") lines.push(`- **Durée** : ${(e.durationMs / 1000).toFixed(1)} s`);
      lines.push("");
      lines.push(e.answer.trim() || "_(réponse vide)_");
      lines.push("");
    });
  }

  return lines.join("\n");
}

/** Consigne de classement envoyée au modèle. */
export function routingPrompt(descriptors: GentDescriptor[], currentGentId?: string | null): string {
  const list = descriptors.map((d) => `- id="${d.id}" — ${d.name} : ${d.summary}`).join("\n");
  const current = currentGentId ? descriptors.find((d) => d.id === currentGentId) : undefined;
  const inertie = currentGentId
    ? `\n\nLe gent « ${current?.name ?? currentGentId} » (id="${currentGentId}") répond déjà dans ce fil. ` +
      "Si la nouvelle question est une relance, une précision, une synthèse ou un approfondissement du même sujet — " +
      "y compris elliptique (« et pour Lyon ? », « synthèse des derniers sujets », « compare avec X ») — " +
      "GARDE CE GENT. Les entités ou marques déjà évoquées dans le fil (newsletter, expéditeur, produit…) " +
      "restent dans le domaine du gent en cours tant que la question s'y rattache. " +
      "Ne change que si la question relève clairement et entièrement d'un autre gent."
    : "";

  return (
    "Tu es un routeur. On te donne la liste des gents (assistants spécialisés) d'un utilisateur, " +
    "le fil récent de la conversation (s'il existe) et sa nouvelle question. " +
    "Désigne LE gent le mieux placé pour y répondre.\n\n" +
    `GENTS DISPONIBLES :\n${list}${inertie}\n\n` +
    "Réponds UNIQUEMENT par un objet JSON, sans texte autour :\n" +
    '{"gentId":"<id exact d\'un gent ci-dessus, ou null>","reason":"<10 mots max>"}\n\n' +
    "Mets null UNIQUEMENT si AUCUN gent ne couvre le sujet ET que ce n'est pas une suite du fil en cours. " +
    "Ne rattache jamais une question à un gent par simple proximité de vocabulaire si un autre est plus adapté — " +
    "mais une relance sur le même sujet doit rester sur le gent déjà mobilisé."
  );
}

/** Formate le fil récent pour le classifieur (questions + réponses tronquées). */
export function formatRoutingConversationContext(
  turns: { role: string; text: string; gentName?: string }[]
): string {
  return turns
    .filter((t) => t.text.trim())
    .map((t) => {
      if (t.role === "user") return `Utilisateur : ${t.text.trim()}`;
      const who = t.gentName ? `Gent « ${t.gentName} »` : "Assistant";
      const body = t.text.trim();
      const short = body.length > 900 ? `${body.slice(0, 900)}…` : body;
      return `${who} : ${short}`;
    })
    .join("\n\n");
}
