import { normaliserCatalogue } from "@/lib/openRouterCatalog";


describe("classement par capacite — audio en entree", () => {
  const un = (archi: Record<string, unknown>, id = "x/y") =>
    normaliserCatalogue({ data: [{ id, name: id, architecture: archi }] })[0];

  it("range en conversation un modele qui ACCEPTE l'audio sans etre transcripteur", () => {
    // Regression : Gemini 2.5 Flash tombait en « transcription vocale » et
    // devenait introuvable dans la categorie Conversation.
    const m = un({
      modality: "text+image+audio->text",
      input_modalities: ["text", "image", "audio"],
      output_modalities: ["text"],
    });
    expect(m.capability).toBe("chat");
  });

  it("range en transcription un modele qui ne prend QUE de l'audio", () => {
    const m = un({ modality: "audio->text", input_modalities: ["audio"], output_modalities: ["text"] });
    expect(m.capability).toBe("stt");
  });

  it("deduit les entrees de la modalite quand input_modalities manque", () => {
    expect(un({ modality: "text+audio->text" }).capability).toBe("chat");
    expect(un({ modality: "audio->text" }).capability).toBe("stt");
  });

  it("la sortie prime : image et audio produits restent image et tts", () => {
    expect(un({ modality: "text+audio->image", output_modalities: ["image"] }).capability).toBe("image");
    expect(un({ modality: "text->audio", output_modalities: ["audio"] }).capability).toBe("tts");
  });

  it("un modele texte simple reste en conversation", () => {
    expect(un({ modality: "text->text", output_modalities: ["text"] }).capability).toBe("chat");
  });

  it("sans architecture du tout, on retombe sur conversation", () => {
    expect(un({}).capability).toBe("chat");
  });
});
