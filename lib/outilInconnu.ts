/**
 * Réponse à un outil que le modèle a INVENTÉ.
 *
 * Mesuré en production : un gent a appelé un outil nommé `QUESTIONS`. Il
 * n'existe pas — c'est un MARQUEUR HTML (`<!--QUESTIONS: […]-->`, voir
 * `lib/suggestions.ts`) que le prompt lui apprend à écrire dans son texte.
 * Deux conventions coexistent depuis que la recherche web est un outil, et le
 * modèle a pris l'une pour l'autre.
 *
 * Le message rendu était « Outil inconnu : QUESTIONS ». Exact, et inutile : il
 * ne dit ni ce qui existe, ni quoi faire. Le modèle a donc refait un tour
 * complet — 42 secondes de silence pour le visiteur.
 *
 * Un retour d'erreur adressé à un modèle est une CONSIGNE, pas un constat.
 *
 * Module PUR.
 */

/**
 * Marqueurs que le prompt enseigne et qui ressemblent à des outils. Les
 * confondre est l'erreur naturelle, pas une bizarrerie : autant la nommer.
 */
const MARQUEURS = new Set(["questions", "pinned", "suggestions"]);

export function estUnMarqueur(nom: string): boolean {
  return MARQUEURS.has(nom.trim().toLowerCase());
}

export function messageOutilInconnu(nom: string, outilsDisponibles: string[]): string {
  const dispo = outilsDisponibles.length
    ? `Outils réellement disponibles : ${outilsDisponibles.join(", ")}.`
    : "Aucun outil n'est disponible pour cette réponse.";

  if (estUnMarqueur(nom)) {
    return (
      `\`${nom}\` n'est PAS un outil : c'est un marqueur que tu écris DANS ta réponse, ` +
      `sous la forme <!--${nom.toUpperCase()}: …-->. Ne l'appelle jamais comme un outil. ` +
      `Reprends ta réponse en texte, en y insérant ce marqueur si tu en as besoin. ${dispo}`
    );
  }

  return (
    `L'outil \`${nom}\` n'existe pas. Ne le rappelle pas. ${dispo} ` +
    `Réponds maintenant à l'utilisateur avec ce que tu as déjà.`
  );
}
