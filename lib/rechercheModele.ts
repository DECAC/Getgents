/**
 * Filtre du sélecteur de modèles.
 *
 * Deux défauts observés en usage réel, avec une clé personnelle — où le
 * catalogue vient d'OpenRouter et compte plusieurs centaines d'entrées, ce qui
 * rend la recherche indispensable et non plus commode :
 *
 * 1. La saisie n'était comparée qu'au libellé et au fournisseur, jamais à
 *    l'IDENTIFIANT. Or c'est lui qu'un créateur connaît et recopie —
 *    « google/gemini-2.5-flash » ne trouvait rien.
 * 2. Elle exigeait une sous-chaîne CONTIGUË. OpenRouter nomme ce modèle
 *    « Google: Gemini 2.5 Flash » : taper « gemini flash » ne correspondait à
 *    rien à cause du « 2.5 » au milieu. Un modèle présent paraissait absent —
 *    et rien ne le signalait.
 *
 * Chaque mot est donc cherché séparément, dans le libellé, le fournisseur ET
 * l'identifiant réunis. Les séparateurs d'identifiant (`/`, `-`, `.`, `:`)
 * comptent comme des espaces, pour que « gemini flash » trouve
 * « google/gemini-2.5-flash ».
 *
 * Module PUR.
 */

export interface ModeleCherchable {
  id: string;
  label: string;
  provider: string;
}

/** Minuscules, accents retirés, séparateurs ramenés à des espaces. */
function normaliser(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function termesDeRecherche(requete: string): string[] {
  return normaliser(requete).split(" ").filter(Boolean);
}

/** Tous les termes doivent apparaître — dans n'importe quel ordre. */
export function correspond(modele: ModeleCherchable, requete: string): boolean {
  const termes = termesDeRecherche(requete);
  if (!termes.length) return true;
  const foin = normaliser(`${modele.label} ${modele.provider} ${modele.id}`);
  return termes.every((t) => foin.includes(t));
}
