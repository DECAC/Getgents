// Traitement serveur d'un e-mail transféré à l'adresse d'un gent « chantier ».
// Le serveur LIT, fait répondre le gent et DÉPOSE les retouches dans
// `courrier_entrant` ; il n'écrit JAMAIS dans le dossier : le navigateur du
// propriétaire réécrit son brouillon à chaque frappe et écraserait l'écriture.
import { buildGentSystemPrompt } from "@/lib/gentRuntimePrompt";
import { contexteArtefacts } from "@/lib/operationsBlocs";
import { BUDGET_DOSSIER, dossierEnTete } from "@/lib/chantier";
import { avecContexteEspace } from "@/lib/historiqueModele";
import { modeleConversationEffectif } from "@/lib/modeleConversation";
import { MESSAGE_VISITEUR_INDISPONIBLE } from "@/lib/openRouterKey";
import {
  extraireRetouches,
  jetonCourrier,
  lireChargeBrevo,
  messagePourModele,
  verifierCourrier,
  jetonDeAdresse,
  type RetoucheCourrier,
} from "@/lib/courrier";
import { sendBrevoEmail } from "@/lib/server/brevo";
import { consommerPourVisiteur } from "@/lib/server/gentGuard";
import { contexteForUser, enTetesOpenRouter } from "@/lib/server/openRouterKey";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import type { Espace } from "@/lib/types";

const OPENROUTER_API = process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";
const DELAI_MS = 120_000;

export type IssueCourrier =
  | "traite"
  | "charge_illisible"
  | "adresse_inconnue"
  | "expediteur"
  | "spam"
  | "vide"
  | "quota"
  | "modele"
  | "non_configure";

function journal(event: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ tag: "getgents:courrier", event, ...extra }));
}

const echapper = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Le texte de la réponse en HTML minimal : paragraphes, sans rien d'exécutable. */
export function reponseEnHtml(texte: string): string {
  return texte
    .split(/\n{2,}/)
    .map((p) => `<p>${echapper(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export async function traiterCourrierEntrant(charge: unknown, secret: string): Promise<IssueCourrier> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return "non_configure";

  const courrier = lireChargeBrevo(charge);
  if (!courrier) return "charge_illisible";
  const jeton = courrier.destinataires.map(jetonDeAdresse).find((j): j is string => !!j);
  if (!jeton) return "adresse_inconnue";

  // Le jeton se dérive du gent : on retrouve celui qui le porte parmi les gents
  // chantier (même balayage que le webhook WhatsApp).
  const { data } = await supabase.from("published_gents").select("id, owner_id, espace");
  const ligne = (data ?? []).find((r) => {
    const e = r.espace as Espace | null;
    return e?.chantier?.enabled === true && jetonCourrier(r.id as string, secret) === jeton;
  });
  if (!ligne || !ligne.owner_id) return "adresse_inconnue";
  const espace = ligne.espace as Espace;
  const ownerId = ligne.owner_id as string;

  const { data: user } = await supabase.auth.admin.getUserById(ownerId);
  const email = user?.user?.email ?? null;
  const refus = verifierCourrier(courrier, email);
  if (refus) {
    journal("refuse", { raison: refus, gentId: ligne.id });
    return refus;
  }

  const ctx = await contexteForUser(ownerId);
  const quota = await consommerPourVisiteur(ctx, "llm");
  if (!quota.ok || !ctx.cle) {
    await sendBrevoEmail(email!, "Votre dossier de chantier", reponseEnHtml(MESSAGE_VISITEUR_INDISPONIBLE));
    return "quota";
  }

  const artefacts = dossierEnTete(espace.artefacts ?? []);
  const contexte = contexteArtefacts(artefacts, BUDGET_DOSSIER);
  const historique = avecContexteEspace([{ role: "user", content: messagePourModele(courrier) }], contexte);

  let reponse = "";
  try {
    const res = await fetch(OPENROUTER_API, {
      method: "POST",
      headers: enTetesOpenRouter(ctx.cle),
      body: JSON.stringify({
        model: modeleConversationEffectif(espace.chatModelId).id,
        messages: [{ role: "system", content: buildGentSystemPrompt(espace, { variant: "espace" }) }, ...historique],
        max_tokens: 4_000,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(DELAI_MS),
    });
    if (!res.ok) {
      journal("modele_refuse", { statut: res.status, gentId: ligne.id });
      return "modele";
    }
    const d = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    reponse = (d.choices?.[0]?.message?.content ?? "").trim();
  } catch (e) {
    journal("modele_injoignable", { erreur: (e as Error).name, gentId: ligne.id });
    return "modele";
  }

  const { texte, retouches, ecartees } = extraireRetouches(reponse, artefacts);
  let depot = true;
  if (retouches.length) depot = await deposer(ligne.id as string, ownerId, courrier.objet, texte, retouches);

  journal("traite", { gentId: ligne.id, retouches: retouches.length, ecartees, depot });
  const suite = retouches.length
    ? depot
      ? `\n\nDossier : ${retouches.length} mise(s) à jour ${retouches.length > 1 ? "attendent" : "attend"} à l'ouverture de votre gent (annulable(s)).`
      : "\n\nLe dossier n'a PAS pu être mis à jour (dépôt impossible) : redites-le dans le gent."
    : "";
  await sendBrevoEmail(email!, `Re: ${courrier.objet || "votre e-mail"}`, reponseEnHtml((texte || "Je n'ai rien à ajouter.") + suite));
  return "traite";
}

async function deposer(
  gentId: string,
  ownerId: string,
  objet: string,
  resume: string,
  retouches: RetoucheCourrier[]
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { error } = await supabase
    .from("courrier_entrant")
    .insert({ gent_id: gentId, owner_id: ownerId, objet, resume: resume.slice(0, 2_000), retouches });
  if (error) journal("depot_echoue", { erreur: error.message.slice(0, 160), gentId });
  return !error;
}
