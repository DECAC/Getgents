import {
  extractImageSignal,
  IMAGE_PROMPT_INSTRUCTION,
  WEB_IMAGE_PROMPT_INSTRUCTION,
} from "@/lib/imageSignal";

describe("extractImageSignal", () => {
  it("extrait une proposition de génération", () => {
    const raw =
      'Voici une idée.\n<!--IMAGE: {"kind":"generate","title":"Maison","prompt":"a cozy stone house"}-->';
    const { text, image } = extractImageSignal(raw);
    expect(text).toBe("Voici une idée.");
    expect(image).toEqual({
      kind: "generate",
      title: "Maison",
      prompt: "a cozy stone house",
      caption: undefined,
    });
  });

  it("extrait une photo web https uniquement", () => {
    const ok = extractImageSignal(
      'Photo.\n<!--IMAGE: {"kind":"web","title":"Port","url":"https://exemple.fr/a.jpg","caption":"Le port"}-->'
    );
    expect(ok.image).toEqual({
      kind: "web",
      title: "Port",
      url: "https://exemple.fr/a.jpg",
      caption: "Le port",
    });

    const http = extractImageSignal(
      '<!--IMAGE: {"kind":"web","title":"X","url":"http://exemple.fr/a.jpg"}-->'
    );
    expect(http.image).toBeNull();
  });

  it("accepte l'ancien format {prompt} comme generate", () => {
    const { image } = extractImageSignal('<!--IMAGE: {"prompt":"sunset over hills"}-->');
    expect(image?.kind).toBe("generate");
    expect(image?.prompt).toBe("sunset over hills");
    expect(image?.title).toBe("Illustration");
  });

  it("ignore un bloc malformé", () => {
    const { text, image } = extractImageSignal("Texte <!--IMAGE: {pas du json}-->");
    expect(image).toBeNull();
    expect(text).toContain("Texte");
  });
});

describe("consignes", () => {
  it("rappellent l'autorisation utilisateur", () => {
    expect(IMAGE_PROMPT_INSTRUCTION).toMatch(/autoriser/i);
    expect(WEB_IMAGE_PROMPT_INSTRUCTION).toMatch(/autoriser/i);
  });
});
