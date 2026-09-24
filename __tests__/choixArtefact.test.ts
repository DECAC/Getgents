import {
  consigneArtefacts,
  extractArtefactPossible,
  ARTEFACT_POSSIBLE_MARQUEUR,
  MESSAGE_EN_ARTEFACT,
  MESSAGE_REPONSE_TEXTE,
} from "@/lib/artefactSignal";
import { avecPreferenceArtefact, preferenceArtefact } from "@/lib/historiqueModele";
import { validerMesureArtefact } from "@/lib/telemetrieArtefact";
import type { ConversationMessage } from "@/lib/types";

const user = (text: string): ConversationMessage => ({ role: "user", text });
const agent = (text: string): ConversationMessage => ({ role: "agent", text });

describe("réponse ou artefact : le choix revient à l'utilisateur", () => {
  it("la consigne interdit de rédiger deux fois le même contenu", () => {
    const c = consigneArtefacts();
    expect(c).toContain("se limite à UNE phrase");
    expect(c).toContain(ARTEFACT_POSSIBLE_MARQUEUR);
  });

  it("repère et retire le marqueur « artefact possible »", () => {
    expect(extractArtefactPossible(`Voici les étapes.\n${ARTEFACT_POSSIBLE_MARQUEUR}`)).toEqual({
      text: "Voici les étapes.",
      possible: true,
    });
    expect(extractArtefactPossible("Bonjour !")).toEqual({ text: "Bonjour !", possible: false });
  });

  it("le clic est mesuré comme une demande", () => {
    expect(validerMesureArtefact({ evenement: "demande", mode: "lien" })).toEqual({ evenement: "demande", mode: "lien" });
  });
});

describe("préférence « artefact d'abord »", () => {
  it("naît de deux demandes dans la conversation", () => {
    expect(preferenceArtefact([user(MESSAGE_EN_ARTEFACT), agent("Voici."), user("Et ensuite ?")])).toBe(false);
    expect(preferenceArtefact([user(MESSAGE_EN_ARTEFACT), agent("Voici."), user(MESSAGE_EN_ARTEFACT)])).toBe(true);
  });

  it("s'éteint quand l'utilisateur redemande une réponse dans le fil", () => {
    expect(
      preferenceArtefact([user(MESSAGE_EN_ARTEFACT), user(MESSAGE_EN_ARTEFACT), user(MESSAGE_REPONSE_TEXTE)])
    ).toBe(false);
  });

  it("est jointe au dernier message de l'utilisateur, seulement si active", () => {
    const h = [
      { role: "user" as const, content: "Bonjour" },
      { role: "user" as const, content: "Son parcours ?" },
    ];
    expect(avecPreferenceArtefact(h, false)).toBe(h);
    const avec = avecPreferenceArtefact(h, true);
    expect(avec[0].content).toBe("Bonjour");
    expect(avec[1].content.startsWith("[PRÉFÉRENCE]")).toBe(true);
    expect(avec[1].content.endsWith("Son parcours ?")).toBe(true);
  });
});
