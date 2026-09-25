import { VOCABULAIRE_BLOCS, type DashboardSpec } from "@/lib/dashboardArtefact";

/**
 * « Mettre en forme » une note gardée : le gent en refait la PRÉSENTATION
 * (chiffres clés, tableau, frise, checklist…) sans en changer le fond.
 *
 * La note naît en copie fidèle (voir lib/noteDepuisReponse.ts) ; la mise en
 * forme est un geste distinct, qui coûte un appel au modèle, et qui produit
 * une NOUVELLE VERSION : la copie fidèle reste restaurable dans l'historique.
 *
 * Module PUR : le texte envoyé au modèle et la consigne. L'appel lui-même vit
 * dans lib/server/miseEnForme.ts.
 */

/** Type affiché d'une note tout juste gardée — c'est lui qui offre « Mettre en forme ». */
export const TYPE_NOTE = "Note";
export const TYPE_NOTE_MISE_EN_FORME = "Note mise en forme";

/** Au-delà, la note est tronquée avant l'envoi : le prix d'un tour reste borné. */
export const CONTENU_MAX = 20_000;

type Bloc = Record<string, unknown>;

function cellule(v: unknown): string {
  return String(v ?? "").replace(/\|/g, "/").replace(/\n+/g, " ");
}

/** Une note en markdown lisible par le modèle, bloc par bloc. */
export function noteEnTexte(spec: DashboardSpec): string {
  const lignes: string[] = [];
  for (const brut of spec.blocks as unknown as Bloc[]) {
    const titre = typeof brut.title === "string" && brut.title ? `### ${brut.title}\n` : "";
    const items = Array.isArray(brut.items) ? (brut.items as Bloc[]) : [];
    switch (brut.type) {
      case "heading":
        lignes.push(`## ${brut.text}`);
        break;
      case "text":
        lignes.push(String(brut.body ?? ""));
        break;
      case "callout":
        lignes.push(`${titre}> ${String(brut.body ?? "").replace(/\n/g, "\n> ")}`);
        break;
      case "checklist":
        lignes.push(titre + items.map((i) => `- ${typeof i === "string" ? i : i.label}`).join("\n"));
        break;
      case "stats":
      case "kv":
        lignes.push(titre + items.map((i) => `- ${i.label} : ${i.value}${i.hint ? ` (${i.hint})` : ""}`).join("\n"));
        break;
      case "timeline":
        lignes.push(
          titre +
            items.map((i) => `- ${i.date ? `${i.date} — ` : ""}${i.label}${i.body ? ` : ${i.body}` : ""}`).join("\n")
        );
        break;
      case "table": {
        const colonnes = Array.isArray(brut.columns) ? (brut.columns as unknown[]) : [];
        const rangees = Array.isArray(brut.rows) ? (brut.rows as unknown[][]) : [];
        lignes.push(
          titre +
            [
              `| ${colonnes.map(cellule).join(" | ")} |`,
              `|${colonnes.map(() => "---").join("|")}|`,
              ...rangees.map((r) => `| ${r.map(cellule).join(" | ")} |`),
            ].join("\n")
        );
        break;
      }
      case "map": {
        const points = Array.isArray(brut.points) ? (brut.points as Bloc[]) : [];
        lignes.push(
          titre +
            points
              .map((p) => `- ${p.label} (${p.lat}, ${p.lon})${p.description ? ` : ${p.description}` : ""}`)
              .join("\n")
        );
        break;
      }
      case "chart": {
        const data = Array.isArray(brut.data) ? (brut.data as Bloc[]) : [];
        lignes.push(titre + data.map((d) => `- ${Object.values(d).map(cellule).join(" · ")}`).join("\n"));
        break;
      }
    }
  }
  const texte = lignes.filter((l) => l.trim()).join("\n\n");
  return texte.length > CONTENU_MAX ? `${texte.slice(0, CONTENU_MAX)}\n\n[… note tronquée]` : texte;
}

export const CONSIGNE_MISE_EN_FORME =
  "Tu mets en forme une NOTE que l'utilisateur a gardée. Tu en changes la PRÉSENTATION, jamais le fond.\n\n" +
  "RÈGLES ABSOLUES :\n" +
  "- Conserve TOUTES les informations de la note : chaque fait, chiffre, nom, date et lien doit se retrouver dans un bloc.\n" +
  "- N'ajoute AUCUNE information absente de la note — pas de chiffre, pas d'exemple, pas de conclusion inventés.\n" +
  "- Garde la langue de la note.\n\n" +
  "CE QUE TU FAIS : choisis les blocs qui rendent la note plus lisible — un bandeau « stats » pour des chiffres clés, " +
  "un tableau pour des éléments comparables, une frise pour une chronologie, une checklist pour des actions, " +
  "un encadré pour un point d'attention, des titres pour structurer. Le texte suivi reste en blocs « text » (markdown).\n\n" +
  VOCABULAIRE_BLOCS +
  "\n\nFORMAT DE RÉPONSE OBLIGATOIRE : ta réponse ENTIÈRE est UNIQUEMENT ce bloc, sans texte avant ni après :\n" +
  '<!--PINNED: {"dashboard":{"blocks":[…]}}-->';
