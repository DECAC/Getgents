/**
 * Le champ `icon` d'un artefact porte DEUX choses selon son origine : un
 * emoji (artefacts produits à l'usage, via ARTEFACT_KIND_META) ou un SVG
 * inline (artefacts de départ, cf. ICON_REPORT dans lib/mock-data/espaces.ts).
 *
 * La modale l'injectait donc en HTML brut, sans assainissement : le document
 * `espace` étant écrit tel quel en base par PUT /api/gents/[id], sans
 * validation de forme, un `<img src=x onerror=…>` glissé dans ce champ
 * s'exécutait chez qui ouvrait la modale. Le rendre en texte, à l'inverse,
 * afficherait le SVG en clair.
 *
 * D'où cette distinction, isolée ici pour être testable.
 */
export function isMarkupIcon(icon: string | undefined): boolean {
  return !!icon && icon.trimStart().startsWith("<");
}
