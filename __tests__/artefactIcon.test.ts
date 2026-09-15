import { isMarkupIcon } from "@/lib/artefactIcon";

/**
 * Le champ `icon` a deux natures selon l'origine de l'artefact — emoji ou
 * SVG inline. Les confondre coûte cher dans les deux sens : l'injecter
 * toujours en HTML ouvre un XSS stocké, le rendre toujours en texte affiche
 * le SVG en clair au milieu de la modale.
 */
describe("nature de l'icône d'artefact", () => {
  it("reconnaît un SVG inline", () => {
    expect(isMarkupIcon('<svg viewBox="0 0 24 24"><path d="M9 11l2 2"/></svg>')).toBe(true);
    expect(isMarkupIcon('  <svg viewBox="0 0 24 24"/>')).toBe(true);
  });

  it("traite un emoji comme du texte", () => {
    for (const emoji of ["📄", "✅", "📊", "🗺️", "👤"]) {
      expect(isMarkupIcon(emoji)).toBe(false);
    }
  });

  it("ne se laisse pas piéger par l'absence de valeur", () => {
    expect(isMarkupIcon("")).toBe(false);
    expect(isMarkupIcon(undefined)).toBe(false);
  });

  it("classe comme balisage tout ce qui en a la forme", () => {
    // Ces valeurs doivent partir à l'assainissement, pas être affichées.
    expect(isMarkupIcon('<img src=x onerror="alert(1)">')).toBe(true);
    expect(isMarkupIcon("<script>alert(1)</script>")).toBe(true);
  });
});
