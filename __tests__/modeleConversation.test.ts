import { MODELE_CHAT_PAR_DEFAUT, modeleConversationEffectif } from "@/lib/modeleConversation";
import { isPlatformModel } from "@/lib/allowedModels";
import { buildEspaceReport } from "@/lib/testReport";
import type { Espace } from "@/lib/types";

describe("modèle de conversation effectif", () => {
  it("un modèle choisi est celui qui répond", () => {
    expect(modeleConversationEffectif("google/gemini-2.5-flash")).toEqual({
      id: "google/gemini-2.5-flash",
      libelle: "Gemini 2.5 Flash",
      parDefaut: false,
    });
  });

  it("sans choix, c'est le défaut — et il est signalé comme tel", () => {
    const m = modeleConversationEffectif(null);
    expect(m.id).toBe(MODELE_CHAT_PAR_DEFAUT);
    expect(m.parDefaut).toBe(true);
  });

  it("le défaut est accepté par la clé de la plateforme : il ne serait pas remplacé en silence", () => {
    expect(isPlatformModel(MODELE_CHAT_PAR_DEFAUT)).toBe(true);
  });

  it("le rapport dit quand le modèle est celui par défaut", () => {
    const espace = {
      name: "G", gent: "G", statusLabel: "Actif", memory: "", conversations: [], artefacts: [],
    } as unknown as Espace;
    expect(buildEspaceReport(espace)).toContain("(par défaut — aucun choisi)");
  });
});
