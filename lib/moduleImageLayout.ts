/** Hauteurs fixes approximatives du chrome d'une carte module (px). */
export const MODULE_CARD_HEAD_HEIGHT = 49;
export const MODULE_CARD_BODY_PADDING = 28;
export const MODULE_CARD_CAPTION_HEIGHT = 32;

export const MODULE_IMAGE_MIN_HEIGHT = 160;
export const MODULE_IMAGE_MAX_HEIGHT = 960;

/**
 * Calcule la hauteur totale d'une carte module pour afficher une image
 * entièrement, sans scroll interne, à la largeur courante de la carte.
 */
export function computeImageModuleHeight(
  cardWidth: number,
  naturalWidth: number,
  naturalHeight: number,
  hasCaption: boolean
): number {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return MODULE_IMAGE_MIN_HEIGHT + MODULE_CARD_HEAD_HEIGHT + MODULE_CARD_BODY_PADDING;
  }

  const contentWidth = Math.max(80, cardWidth - MODULE_CARD_BODY_PADDING);
  const imageDisplayHeight = Math.round(contentWidth * (naturalHeight / naturalWidth));
  const caption = hasCaption ? MODULE_CARD_CAPTION_HEIGHT : 0;
  const total =
    MODULE_CARD_HEAD_HEIGHT + MODULE_CARD_BODY_PADDING + imageDisplayHeight + caption;

  return Math.min(MODULE_IMAGE_MAX_HEIGHT, Math.max(MODULE_IMAGE_MIN_HEIGHT + MODULE_CARD_HEAD_HEIGHT, total));
}
