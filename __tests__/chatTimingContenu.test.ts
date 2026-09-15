import { porteDuContenu, porteUnSigne } from "@/lib/chatTiming";

describe("porteDuContenu", () => {
  const sse = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;

  it("ignore un evenement de statut", () => {
    expect(porteDuContenu(sse({ status_event: { phase: "preparing", label: "Préparation…" } }))).toBe(false);
  });

  it("ignore un ping anti-coupure", () => {
    expect(porteDuContenu(sse({ status_event: { phase: "thinking", label: "Traitement en cours…" } }))).toBe(false);
  });

  it("ignore un evenement d'outil, meme s'il contient le mot content", () => {
    expect(porteDuContenu(sse({ tool_event: { name: "recherche_web", content: "resultat" } }))).toBe(false);
  });

  it("ignore un delta de role sans texte", () => {
    expect(porteDuContenu(sse({ choices: [{ delta: { role: "assistant", content: "" } }] }))).toBe(false);
  });

  it("ignore un delta de raisonnement", () => {
    expect(porteDuContenu(sse({ choices: [{ delta: { reasoning: "je reflechis" } }] }))).toBe(false);
  });

  it("reconnait le premier mot", () => {
    expect(porteDuContenu(sse({ choices: [{ delta: { content: "Bonjour" } }] }))).toBe(true);
  });

  it("ignore [DONE] et les lignes vides", () => {
    expect(porteDuContenu("data: [DONE]\n\n")).toBe(false);
    expect(porteDuContenu("\n\n")).toBe(false);
  });

  it("ne leve pas sur un fragment coupe en plein objet", () => {
    expect(porteDuContenu('data: {"choices":[{"delta":{"cont')).toBe(false);
  });

  it("trouve le texte quand plusieurs evenements arrivent dans le meme fragment", () => {
    const f = sse({ status_event: { phase: "thinking" } }) + sse({ choices: [{ delta: { content: "Salut" } }] });
    expect(porteDuContenu(f)).toBe(true);
  });
});

describe("porteUnSigne — le silence REEL", () => {
  const sse = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;

  it("un raisonnement diffuse est un signe de vie", () => {
    // Il s'affiche (« Raisonnement du modele ») : l'ecran n'est plus muet.
    expect(porteUnSigne(sse({ choices: [{ delta: { reasoning: "je reflechis" } }] }))).toBe(true);
    expect(porteUnSigne(sse({ choices: [{ delta: { reasoning_content: "idem" } }] }))).toBe(true);
  });

  it("mais ce n'est PAS la reponse", () => {
    expect(porteDuContenu(sse({ choices: [{ delta: { reasoning: "je reflechis" } }] }))).toBe(false);
  });

  it("le contenu est un signe, evidemment", () => {
    expect(porteUnSigne(sse({ choices: [{ delta: { content: "Bonjour" } }] }))).toBe(true);
  });

  it("un statut de plateforme n'en est pas un — il part avant tout appel", () => {
    expect(porteUnSigne(sse({ status_event: { phase: "preparing" } }))).toBe(false);
  });

  it("un raisonnement vide ne compte pas", () => {
    expect(porteUnSigne(sse({ choices: [{ delta: { reasoning: "" } }] }))).toBe(false);
  });
});
