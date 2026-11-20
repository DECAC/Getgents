import fs from "fs";
import path from "path";

/**
 * La vitrine décrit le produit TEL QU'IL EST. Deux promesses ont déjà failli
 * être fausses : l'assistant ne répond pas « uniquement » d'après la page
 * (les précisions de l'auteur s'y ajoutent), et le détail de lecture n'est
 * visible que si le lecteur l'accepte.
 */
describe("vitrine Getgents Pages", () => {
  // Le texte affiché seulement : les commentaires citent justement les mots interdits.
  const source = fs
    .readFileSync(path.join(process.cwd(), "components/public/VitrinePages.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("ne promet pas un assistant limité à la page seule", () => {
    expect(source).not.toMatch(/uniquement|page seule|seulement d'après/i);
    expect(source).toContain("à partir de la page");
  });

  it("dit que le détail de lecture dépend de l'accord du lecteur", () => {
    expect(source).toMatch(/seulement si votre lecteur accepte/);
  });

  // 19/11 : une ouverture est anonyme, et la fenêtre « Partager vos données ? »
  // a disparu (la lecture se joint à une réponse). La vitrine les promettait encore.
  it("ne promet ni de savoir QUI a ouvert, ni un partage de lecture hors réponse", () => {
    expect(source).not.toMatch(/vous voyez quand elle/i);
    expect(source).not.toMatch(/a partagé sa lecture/i);
  });

  it("affiche les plafonds réels de l'offre, pas des chiffres recopiés", () => {
    expect(source).toContain("PLAFONDS_PAGES.pages");
    expect(source).toContain("PLAFONDS_PAGES.liensActifs");
    expect(source).toContain("PLAFONDS_PAGES.questionsParMois");
  });
});
