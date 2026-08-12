import {
  computeImageModuleHeight,
  MODULE_CARD_BODY_PADDING,
  MODULE_CARD_CAPTION_HEIGHT,
  MODULE_CARD_HEAD_HEIGHT,
} from "@/lib/moduleImageLayout";

describe("computeImageModuleHeight", () => {
  it("adapte la hauteur au ratio de l'image", () => {
    const cardWidth = 400;
    const height = computeImageModuleHeight(cardWidth, 800, 800, false);
    const contentWidth = cardWidth - MODULE_CARD_BODY_PADDING;
    expect(height).toBe(
      MODULE_CARD_HEAD_HEIGHT + MODULE_CARD_BODY_PADDING + contentWidth
    );
  });

  it("ajoute de la hauteur pour une légende", () => {
    const withCaption = computeImageModuleHeight(400, 400, 200, true);
    const without = computeImageModuleHeight(400, 400, 200, false);
    expect(withCaption - without).toBe(MODULE_CARD_CAPTION_HEIGHT);
  });
});
