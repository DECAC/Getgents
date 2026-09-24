import type { Artefact, ConversationMessage } from "@/lib/types";
import { ARTEFACT_KIND_META } from "@/lib/artefactKind";

/**
 * Historique envoyé au modèle, avec la MÉMOIRE de ses propositions d'artefact.
 *
 * On ne transmettait que les messages texte, bloc ARTEFACT retiré : le modèle
 * ignorait qu'il avait déjà proposé la même frise, ou que l'utilisateur avait
 * jeté ses trois dernières propositions. Il reproposait, doublonnait, et
 * insistait.
 *
 * Chaque proposition est désormais rattachée à la réponse qui l'a produite,
 * sous une forme que `consigneArtefacts` apprend au modèle à lire :
 *   [Artefact proposé : « Parcours professionnel » (Tableau de bord) — jeté]
 *
 * L'annotation voyage DANS le contenu du message assistant, et non dans le
 * prompt système : l'historique est construit par le navigateur sur les deux
 * chemins (espace et lien public), si bien qu'aucune route serveur n'a à
 * changer. Un visiteur qui falsifierait ces lignes ne tromperait que sa
 * propre conversation.
 *
 * Module PUR.
 */

export interface MessageModele {
  role: "user" | "assistant";
  content: string;
}

const VERDICT: Record<"pending" | "added" | "dismissed", string> = {
  added: "gardé",
  dismissed: "jeté",
  pending: "sans réponse",
};

const PERTE: Record<NonNullable<ConversationMessage["artefactEchec"]>, string> = {
  tronque: "réponse coupée",
  illisible: "illisible",
};

function sansBalises(html: string | undefined): string {
  return (html ?? "").replace(/<[^>]+>/g, "");
}

export function historiquePourModele(messages: readonly ConversationMessage[]): MessageModele[] {
  const sortie: MessageModele[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      sortie.push({ role: "user", content: sansBalises(m.text) });
    } else if (m.role === "agent") {
      let content = sansBalises(m.text);
      if (m.artefactEchec) content += `\n[Artefact annoncé mais perdu : ${PERTE[m.artefactEchec]}]`;
      sortie.push({ role: "assistant", content });
    } else if (m.role === "artef-proposal" && m.proposal) {
      // Rattachée à la DERNIÈRE réponse du gent : c'est elle qui l'a émise.
      const precedente = [...sortie].reverse().find((x) => x.role === "assistant");
      if (!precedente) continue;
      const forme = ARTEFACT_KIND_META[m.proposal.kind]?.type ?? m.proposal.kind;
      const verdict = VERDICT[m.proposalStatus ?? "pending"];
      precedente.content += `\n[Artefact proposé : « ${m.proposal.title} » (${forme}) — ${verdict}]`;
    }
  }
  return sortie;
}

function normaliserTitre(t: string): string {
  return t.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Artefact déjà gardé qui porte le même titre qu'une proposition : c'en est
 * une version mise à jour, qui le REMPLACE au lieu de s'y ajouter.
 *
 * La consigne demande au modèle de reprendre exactement le titre quand il
 * modifie un artefact gardé. Le document fixé par le créateur (visionneuse)
 * n'est jamais remplacé : c'est un livrable du gent, pas du lecteur.
 */
export function artefactHomonyme(artefacts: readonly Artefact[], titre: string): Artefact | undefined {
  const cible = normaliserTitre(titre);
  if (!cible) return undefined;
  return artefacts.find((a) => a.id !== "visionneuse-doc" && normaliserTitre(a.title) === cible);
}

/** Libellé du bouton « garder » : il annonce un remplacement quand c'en est un. */
export function libelleGarder(artefacts: readonly Artefact[], titre: string): string {
  return artefactHomonyme(artefacts, titre) ? "Mettre à jour dans l'espace" : "Garder dans l'espace";
}
