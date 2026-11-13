/**
 * Coordonnées ÉCRITES dans une page partagée, repérées avant l'envoi — pour
 * une page collée à la main comme pour une page venue du connecteur.
 * Module PUR, sans dépendance.
 */

export interface DonneesPersonnelles {
  emails: string[];
  telephones: string[];
}

/**
 * Adresses e-mail et numéros de téléphone ÉCRITS dans la page. Règles simples,
 * sans modèle : c'est une alerte, pas une garantie — un nom, un montant
 * confidentiel ne sont pas repérés. Les `data:` (images encodées) sont
 * ignorés : leurs caractères au hasard ressemblent à n'importe quoi.
 */
export function donneesPersonnelles(contenu: string, max = 5): DonneesPersonnelles {
  const texte = contenu.replace(/data:[a-z0-9.+/-]+;base64,[A-Za-z0-9+/=]+/gi, " ");
  const uniques = (l: string[]) => Array.from(new Set(l)).slice(0, max);
  const emails = uniques(
    (texte.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [])
      .map((e) => e.toLowerCase())
      // Les adresses d'exemple ne sont pas des données personnelles.
      .filter((e) => !/@(example|exemple)\.(com|fr|org)$/.test(e) && !/\.(png|jpe?g|gif|svg|webp)$/.test(e))
  );
  const telephones = uniques(
    (texte.match(/(?<![\d.])(?:\+33\s?[1-9]|0[1-9])(?:[\s.-]?\d{2}){4}(?![\d.])|(?<![\d.])\+\d{1,3}(?:[\s.-]?\d{2,4}){3,5}(?![\d.])/g) ?? []).map((t) => t.trim())
  );
  return { emails, telephones };
}

