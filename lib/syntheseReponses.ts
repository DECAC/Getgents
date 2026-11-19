/**
 * Onglet ACTIVITÉ réorganisé (19/11, maquette validée) — calculs PURS.
 * Il répond d'abord à « où en sont les réponses ? » et « qu'ont-ils choisi ? ».
 * Ce qu'il ne dit PAS, exprès : qui a OUVERT la page sans répondre — la
 * lecture est anonyme sans l'accord du lecteur (décision du 19/11).
 */
import { ligneChoix, pastillesLecture, type ReponseEngagement } from "@/lib/engagement";
import { cleInvite } from "@/lib/groupesPages";

export interface OptionChoisie {
  valeur: string;
  nombre: number;
  /** Prénoms (ou noms de lien) de ceux qui l'ont choisie. */
  qui: string[];
}
export interface GroupeChoisi {
  groupe: string;
  options: OptionChoisie[];
}

/** Total des choix de toutes les réponses, par section de la page, options les plus choisies d'abord. */
export function syntheseChoix(reponses: readonly ReponseEngagement[]): { groupes: GroupeChoisi[]; avecChoix: number } {
  const ordre: string[] = [];
  const parGroupe = new Map<string, Map<string, OptionChoisie>>();
  let avecChoix = 0;
  for (const r of reponses) {
    if (r.choix.length) avecChoix++;
    for (const c of r.choix) {
      const g = c.groupe || "Choix";
      if (!parGroupe.has(g)) {
        parGroupe.set(g, new Map());
        ordre.push(g);
      }
      const options = parGroupe.get(g)!;
      const o = options.get(c.valeur) ?? { valeur: c.valeur, nombre: 0, qui: [] };
      if (!o.qui.includes(r.destinataire)) {
        o.nombre++;
        o.qui.push(r.destinataire);
      }
      options.set(c.valeur, o);
    }
  }
  return {
    avecChoix,
    groupes: ordre.map((groupe) => ({
      groupe,
      options: Array.from(parGroupe.get(groupe)!.values()).sort((a, b) => b.nombre - a.nombre),
    })),
  };
}

export interface Attendu {
  jeton: string;
  nom: string;
  /** Lien de groupe : ses invités, et qui a répondu. */
  invites: { prenom: string; repondu: boolean }[] | null;
  repondu: boolean;
}

/** Qui doit répondre : un lien personnel compte pour un, un lien de groupe pour chacun de ses invités. */
export function attendus(
  liens: readonly { jeton: string; destinataire: string }[],
  groupes: Readonly<Record<string, string[]>>,
  reponses: readonly ReponseEngagement[]
): { lignes: Attendu[]; total: number; repondus: number; enAttente: string[] } {
  const lignes: Attendu[] = liens.map((l) => {
    const invites = groupes[l.jeton];
    if (invites) {
      const faits = new Set(reponses.filter((r) => r.jeton === l.jeton && r.invite).map((r) => cleInvite(r.invite!)));
      const liste = invites.map((prenom) => ({ prenom, repondu: faits.has(cleInvite(prenom)) }));
      return { jeton: l.jeton, nom: l.destinataire, invites: liste, repondu: liste.every((i) => i.repondu) };
    }
    return { jeton: l.jeton, nom: l.destinataire, invites: null, repondu: reponses.some((r) => r.jeton === l.jeton && !r.invite) };
  });
  let total = 0;
  let repondus = 0;
  const enAttente: string[] = [];
  for (const l of lignes) {
    if (l.invites) {
      total += l.invites.length;
      for (const i of l.invites) i.repondu ? repondus++ : enAttente.push(i.prenom);
    } else {
      total++;
      l.repondu ? repondus++ : enAttente.push(l.nom);
    }
  }
  return { lignes, total, repondus, enAttente };
}

/** « Sophie, Léa et grand-mère Odile ». */
export const listeLisible = (n: readonly string[]) => (n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} et ${n[n.length - 1]}`);

const cellule = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/**
 * Export pour un tableur. Point-virgule et BOM : c'est ce qu'Excel attend en
 * français. Une formule ne peut pas s'y glisser (=, +, -, @ en tête neutralisés).
 */
export function csvReponses(reponses: readonly ReponseEngagement[]): string {
  const sur = (v: string) => (/^[=+\-@\t]/.test(v) ? `'${v}` : v);
  const lignes = [["Date", "Nom", "Lien de groupe", "Bouton", "Choix", "Mot", "Version lue", "Lecture"]];
  for (const r of reponses)
    lignes.push([
      new Date(r.createdAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
      r.destinataire,
      r.invite ? "oui" : "",
      r.intitule,
      r.choix.map(ligneChoix).join(" | "),
      r.mot ?? "",
      String(r.version),
      r.lecture ? pastillesLecture(r.lecture).join(", ") : "",
    ]);
  return "\uFEFF" + lignes.map((l) => l.map((v) => cellule(sur(v))).join(";")).join("\r\n");
}

/** Les 14 derniers jours (le plus ancien d'abord), zéro les jours sans ouverture. */
export function ouverturesSurQuatorzeJours(parJour: Readonly<Record<string, number>>, aujourdhui: string): { jour: string; n: number }[] {
  const [a, m, j] = aujourdhui.split("-").map(Number);
  const base = Date.UTC(a, m - 1, j);
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(base - (13 - i) * 86_400_000).toISOString().slice(0, 10);
    return { jour: d, n: parJour[d] ?? 0 };
  });
}
