/**
 * Sous-titre de l'en-tête d'un gent.
 *
 * `gent` et `name` portent souvent la MÊME chaîne : le créateur nomme son gent
 * une fois, et les deux champs la reçoivent. L'en-tête affichait alors deux
 * fois le même texte, l'un sous l'autre — un doublon qui occupe la place d'une
 * information et fait douter du soin porté au reste.
 *
 * On ne montre donc le second que s'il APPREND quelque chose. La comparaison
 * ignore la casse, les accents, la ponctuation d'espacement : « Talk to
 * Charles » et « talk to charles » sont le même titre pour un lecteur.
 *
 * Module PUR.
 */

function reduire(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

/** `null` quand le sous-titre ne dirait rien de plus que le titre. */
export function sousTitreDuGent(
  titre: string | null | undefined,
  sousTitre: string | null | undefined
): string | null {
  const s = typeof sousTitre === "string" ? sousTitre.trim() : "";
  if (!s) return null;
  const t = typeof titre === "string" ? titre.trim() : "";
  if (!t) return s;
  return reduire(t) === reduire(s) ? null : s;
}
