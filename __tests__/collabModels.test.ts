import {
  MODELE_COLLECTE,
  MODELE_SALON_DEFAUT,
  maxTokensPourPhase,
  modelePourPhase,
} from "@/lib/collabModels";
import { isPlatformModel } from "@/lib/allowedModels";

describe("modelePourPhase", () => {
  it("allège la phase de collecte", () => {
    // La phase longue et pauvre en décisions ne mérite pas le modèle des
    // propositions : mesuré à 12,6-16,7 s par tick, soit 82-91 % du total.
    expect(modelePourPhase("collecting", "anthropic/claude-sonnet-5")).toBe(MODELE_COLLECTE);
  });

  it("rend au créateur son modèle là où ça décide", () => {
    // Propositions et synthèse : c'est là que la qualité se voit, et c'est le
    // créateur qui a choisi.
    expect(modelePourPhase("proposing", "anthropic/claude-sonnet-5")).toBe(
      "anthropic/claude-sonnet-5"
    );
    expect(modelePourPhase("done", "openai/gpt-4.1")).toBe("openai/gpt-4.1");
  });

  it("a un repli quand le gent n'a pas de modèle", () => {
    expect(modelePourPhase("proposing", null)).toBe(MODELE_SALON_DEFAUT);
    expect(modelePourPhase("proposing", "   ")).toBe(MODELE_SALON_DEFAUT);
  });

  it("ne propose que des modèles que la clé plateforme accepte de payer", () => {
    // Un identifiant hors catalogue serait silencieusement remplacé par
    // resolveModelId, et le découpage n'aurait servi à rien sans qu'on le voie.
    expect(isPlatformModel(MODELE_SALON_DEFAUT)).toBe(true);
    if (MODELE_COLLECTE !== null) expect(isPlatformModel(MODELE_COLLECTE)).toBe(true);
  });
});

describe("maxTokensPourPhase", () => {
  it("laisse de la place là où le texte est long", () => {
    // Trois options détaillées à rédiger : on ne rogne pas.
    expect(maxTokensPourPhase("proposing")).toBe(4096);
  });

  it("borne la collecte, où les actions sont courtes", () => {
    expect(maxTokensPourPhase("collecting")).toBeLessThan(maxTokensPourPhase("proposing"));
  });
});
