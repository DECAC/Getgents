import type { ContexteLlm } from "@/lib/server/openRouterKey";
import { enTetesOpenRouter } from "@/lib/server/openRouterKey";
import {
  budgetEpuise,
  DELAI_RECHERCHE_MS,
  MESSAGE_BUDGET_EPUISE,
  MESSAGE_DELAI_DEPASSE,
} from "@/lib/rechercheBudget";

/**
 * La recherche web, donnée au modèle comme un OUTIL qu'il appelle s'il en a
 * besoin — au lieu d'être déclenchée à chaque tour.
 *
 * Le plugin web d'OpenRouter s'exécute AVANT le modèle : activé sur un gent,
 * il faisait payer une recherche complète à chaque message, y compris pour
 * « quelles sont tes certifications ? », entièrement répondable depuis le
 * corpus déjà ingéré. C'est ce qui rendait les réponses lentes.
 *
 * En outil, la décision revient à qui a lu la question ET le corpus. Les tours
 * qui n'en ont pas besoin — la grande majorité — deviennent immédiats. Ceux
 * qui en ont besoin paient un aller-retour de plus, et c'est l'échange voulu.
 */

const OPENROUTER_API =
  process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";

/**
 * Modèle du sous-appel de recherche. Volontairement rapide et bon marché : sa
 * tâche est de RESTITUER ce que la recherche a trouvé, pas de raisonner. Le
 * modèle du gent, lui, garde la main sur la réponse finale.
 */
const MODELE_RECHERCHE = "google/gemini-2.5-flash";

/** Bornes : une recherche ne doit pas coûter plus qu'une réponse. */
const MAX_TOKENS = 1200;
const MAX_RESULTAT = 6000;

export const DECLARATION_RECHERCHE_WEB = {
  type: "function",
  function: {
    name: "recherche_web",
    description:
      "Cherche une information sur le web ouvert. À n'utiliser QUE si la réponse ne peut pas " +
      "être trouvée dans ta base de connaissance : actualité, événement récent, page publique " +
      "précise. Chaque appel ralentit sensiblement la réponse — ne t'en sers pas par confort. " +
      "Une seule recherche, bien formulée, suffit presque toujours : ne relance pas pour affiner.",
    parameters: {
      type: "object",
      properties: {
        requete: {
          type: "string",
          description: "Ce que tu cherches, formulé comme une requête de moteur de recherche.",
        },
      },
      required: ["requete"],
    },
  },
} as const;

/**
 * Exécution : un sous-appel au fournisseur, avec son plugin de recherche.
 *
 * Ne lève JAMAIS. Une recherche qui échoue doit produire un constat que le
 * modèle peut lire et annoncer — « je n'ai pas pu vérifier » — plutôt qu'une
 * exception qui casserait la conversation. C'est aussi ce qui l'empêche
 * d'inventer : on lui dit explicitement qu'il n'a rien trouvé.
 */
export async function executerRechercheWeb(
  args: Record<string, unknown>,
  ctx: ContexteLlm
): Promise<{ text: string; ok: boolean }> {
  const requete = typeof args.requete === "string" ? args.requete.trim() : "";
  if (!requete) {
    return { text: "Aucune requête fournie. Reformule ta recherche.", ok: false };
  }
  if (!ctx.cle) {
    return { text: "La recherche web n'est pas disponible pour le moment.", ok: false };
  }

  // Sans délai maximal, une recherche lente bloque tout le tour : c'est la
  // moitié des 150 secondes mesurées en production. `AbortSignal` coupe la
  // requête ET libère la connexion chez le fournisseur.
  const minuteur = AbortSignal.timeout(DELAI_RECHERCHE_MS);
  const debut = Date.now();

  try {
    const res = await fetch(OPENROUTER_API, {
      method: "POST",
      signal: minuteur,
      headers: enTetesOpenRouter(ctx.cle),
      body: JSON.stringify({
        model: MODELE_RECHERCHE,
        plugins: [{ id: "web" }],
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: "system",
            content:
              "Tu restitues des résultats de recherche, tu ne réponds pas toi-même. " +
              "Rapporte UNIQUEMENT ce que les sources disent, avec leur URL. " +
              "Si les sources ne répondent pas à la requête, écris exactement : " +
              "AUCUN RÉSULTAT PERTINENT. N'invente jamais un fait, une date ou une citation.",
          },
          { role: "user", content: requete },
        ],
      }),
    });

    if (!res.ok) {
      return { text: "La recherche web a échoué. Réponds sans elle, en le disant.", ok: false };
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const texte = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!texte) {
      return { text: "AUCUN RÉSULTAT PERTINENT", ok: false };
    }
    journaliser(requete, debut, "ok");
    return { text: texte.slice(0, MAX_RESULTAT), ok: true };
  } catch (e) {
    const expire = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    journaliser(requete, debut, expire ? "delai_depasse" : "echec");
    if (expire) return { text: MESSAGE_DELAI_DEPASSE, ok: false };
    return { text: "La recherche web a échoué. Réponds sans elle, en le disant.", ok: false };
  }
}

/**
 * Trace d'une recherche. La REQUÊTE est écrite — elle vient du modèle, pas du
 * visiteur, et sans elle on ne peut pas savoir pourquoi il a cherché. Le
 * résultat, lui, ne l'est jamais : il porterait le contenu de la conversation.
 */
function journaliser(requete: string, debut: number, issue: string) {
  console.log(
    JSON.stringify({
      tag: "getgents:chat",
      event: "recherche_web",
      issue,
      dureeMs: Date.now() - debut,
      requete: requete.slice(0, 120),
    })
  );
}

/**
 * L'outil tel qu'il est remis à UN tour de conversation : il porte son propre
 * compteur. Le modèle qui insiste reçoit un refus lisible plutôt qu'une
 * nouvelle attente — c'est ce qui borne le silence total, le délai par appel
 * ne bornant que chaque appel pris isolément.
 */
export function creerOutilRechercheWeb(ctx: ContexteLlm) {
  let appels = 0;
  return {
    exec: async (args: Record<string, unknown>) => {
      if (budgetEpuise(appels)) {
        journaliser(String(args.requete ?? ""), Date.now(), "budget_epuise");
        return { text: MESSAGE_BUDGET_EPUISE, ok: false };
      }
      appels += 1;
      return executerRechercheWeb(args, ctx);
    },
  };
}
