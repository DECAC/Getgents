import { MODELE_CHAT_PAR_DEFAUT, libelleModele, modeleActuel, modeleConversationEffectif } from "@/lib/modeleConversation";
import { isPlatformModel, resolveModelId } from "@/lib/allowedModels";
import { migrerModelesDraft } from "@/lib/builderDraftStorage";
import { documentsBudgetFor } from "@/lib/sessionContext";
import { extractGentConfigSignal } from "@/lib/gentConfigSignal";
import { modelePourPhase } from "@/lib/collabModels";
import type { GentDraft } from "@/lib/types/builder";

const ANCIEN = "anthropic/claude-sonnet-5";
const NOUVEAU = "anthropic/claude-sonnet-5.5";

describe("Sonnet 5 → Sonnet 5.5, le nouveau standard", () => {
  it("Sonnet 5.5 est le modèle par défaut, et la clé plateforme l'accepte", () => {
    expect(MODELE_CHAT_PAR_DEFAUT).toBe(NOUVEAU);
    expect(isPlatformModel(NOUVEAU)).toBe(true);
    expect(isPlatformModel(ANCIEN)).toBe(false);
  });

  it("un gent réglé sur Sonnet 5 passe à 5.5 — jamais à Kimi, le repli des inconnus", () => {
    expect(modeleActuel(ANCIEN)).toBe(NOUVEAU);
    expect(resolveModelId(ANCIEN)).toBe(NOUVEAU);
    expect(modeleConversationEffectif(ANCIEN)).toEqual({ id: NOUVEAU, libelle: "Claude Sonnet 5.5", parDefaut: false });
    expect(libelleModele(ANCIEN)).toBe("Claude Sonnet 5.5");
    expect(modelePourPhase("proposing", ANCIEN)).toBe(NOUVEAU);
    expect(documentsBudgetFor(ANCIEN)).toBe(documentsBudgetFor(NOUVEAU));
  });

  it("les autres modèles ne bougent pas", () => {
    expect(modeleActuel("google/gemini-2.5-flash")).toBe("google/gemini-2.5-flash");
    expect(modeleActuel(undefined)).toBeUndefined();
  });

  it("le studio migre le réglage du gent à la lecture", () => {
    const draft = {
      id: "d1",
      modelAssignments: [
        { capability: "chat", modelId: ANCIEN },
        { capability: "image", modelId: null },
      ],
    } as unknown as GentDraft;
    const migre = migrerModelesDraft(draft);
    expect(migre.modelAssignments).toEqual([
      { capability: "chat", modelId: NOUVEAU },
      { capability: "image", modelId: null },
    ]);
    // Rien à migrer : le même objet, pas de réécriture inutile.
    expect(migrerModelesDraft(migre)).toBe(migre);
  });

  it("l'assistant du builder qui propose encore Sonnet 5 obtient 5.5", () => {
    const { config } = extractGentConfigSignal(`<!--GENT_CONFIG: {"chatModelId":"${ANCIEN}"}-->`);
    expect(config?.chatModelId).toBe(NOUVEAU);
  });
});
