import { draftToEspace, mergeVisionneuseArtefact, localIsFresher } from "@/lib/publishedGents";
import type { Espace } from "@/lib/types";
import { espaceForPublicLink } from "@/lib/espaceApiPayload";
import { buildGentSystemPrompt } from "@/lib/gentRuntimePrompt";
import type { GentDraft } from "@/lib/types/builder";
import type { DocumentViewerSpec } from "@/lib/types";

/**
 * Un gent « visionneuse » doit pouvoir répondre sur le document que son lecteur
 * a sous les yeux — y compris quand il est DIFFUSÉ par lien. Les fichiers de
 * session appartiennent à l'utilisateur et sont retirés des espaces partagés :
 * le document du créateur passe donc par le prompt système.
 */
const PAGE_CHARS = 2_800;

function pages(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Contenu de la page ${i + 1}. `.repeat(Math.ceil(PAGE_CHARS / 26)));
}

function spec(pageCount: number): DocumentViewerSpec {
  return {
    sourceName: "livre-blanc.docx",
    sourceKind: "docx",
    pageCount,
    pages: pages(pageCount),
    toc: [{ id: "t0", title: "Introduction", level: 1, page: 0 }],
    truncated: false,
  };
}

function draft(document: DocumentViewerSpec, chatModelId = "anthropic/claude-sonnet-5"): GentDraft {
  return {
    id: "visionneuse-test",
    name: "Lecteur de livre blanc",
    icon: "📖",
    objective: "Accompagner la lecture",
    systemPrompt: "Tu accompagnes la lecture du livre blanc.",
    status: "draft",
    updatedAt: "à l'instant",
    modelAssignments: [{ capability: "chat", modelId: chatModelId }],
    knowledgeSources: [],
    connectors: [],
    builderConversation: [],
    visionneuse: { enabled: true, instructions: "Reste factuel.", document },
  } as unknown as GentDraft;
}

describe("gent visionneuse — accès du modèle au document", () => {
  it("injecte le texte intégral d'un document de 100 pages dans le prompt système", () => {
    const espace = draftToEspace(draft(spec(100)));
    expect(espace.systemPrompt).toContain("TEXTE INTÉGRAL DU DOCUMENT");
    expect(espace.systemPrompt).toContain("Contenu de la page 1.");
    expect(espace.systemPrompt).toContain("Contenu de la page 100.");
    expect(espace.systemPrompt).not.toContain("Le document continue au-delà");
  });

  it("pagine le texte pour que le gent situe ses réponses comme le lecteur", () => {
    const espace = draftToEspace(draft(spec(5)));
    expect(espace.systemPrompt).toContain("[Page 1]");
    expect(espace.systemPrompt).toContain("[Page 5]");
  });

  it("survit à la diffusion par lien de partage", () => {
    const espace = draftToEspace(draft(spec(100)));
    const shared = espaceForPublicLink(espace);
    // Le visiteur ne reçoit pas le prompt (il reste serveur), mais le prompt
    // assemblé côté serveur pour SA conversation doit contenir le document.
    const prompt = buildGentSystemPrompt(espace, { variant: "sharedLink" });
    expect(prompt).toContain("Contenu de la page 100.");
    // …et il reçoit bien le document à lire dans sa visionneuse.
    expect(shared.artefacts.find((a) => a.id === "visionneuse-doc")?.document?.pageCount).toBe(100);
  });

  it("ne double pas le document dans les fichiers de session (poids de requête)", () => {
    const espace = draftToEspace(draft(spec(100)));
    const listed = espace.files.find((f) => f.id === "visionneuse-doc-file");
    expect(listed?.name).toBe("livre-blanc.docx");
    expect(listed?.text).toBeUndefined();
  });

  it("attache le document à un gent DÉJÀ existant, sans effacer le travail de l'utilisateur", () => {
    // Le bug rapporté : sur un gent existant, republier conservait la liste
    // d'artefacts d'avant et jetait le document fraîchement configuré — la
    // visionneuse n'avait alors rien à ouvrir en Preview.
    const fresh = draftToEspace(draft(spec(10))).artefacts;
    const dejaLa = [
      { id: "artef-1", title: "Rapport de l'utilisateur", type: "Rapport", icon: "📄", date: "hier" },
    ];

    const merged = mergeVisionneuseArtefact(dejaLa, fresh);
    expect(merged.find((a) => a.id === "visionneuse-doc")?.document?.pageCount).toBe(10);
    expect(merged.find((a) => a.id === "artef-1")).toBeDefined();
  });

  it("remplace un document périmé plutôt que d'en empiler deux", () => {
    const ancien = draftToEspace(draft(spec(5))).artefacts;
    const nouveau = draftToEspace(draft(spec(42))).artefacts;

    const merged = mergeVisionneuseArtefact(ancien, nouveau);
    expect(merged.filter((a) => a.id === "visionneuse-doc")).toHaveLength(1);
    expect(merged[0].document?.pageCount).toBe(42);
  });

  it("retire le document quand le type visionneuse est désactivé", () => {
    const avec = draftToEspace(draft(spec(5))).artefacts;
    const merged = mergeVisionneuseArtefact(avec, [] /* plus de visionneuse */);
    expect(merged.find((a) => a.id === "visionneuse-doc")).toBeUndefined();
  });

  it("annonce franchement la coupe quand le document dépasse la fenêtre du modèle", () => {
    // 300 pages ≈ 840 000 caractères : au-delà de tout budget du catalogue.
    const espace = draftToEspace(draft(spec(300), "mistralai/mistral-large"));
    expect(espace.systemPrompt).toContain("Contenu de la page 1.");
    expect(espace.systemPrompt).toContain("Le document continue au-delà");
    expect(espace.systemPrompt).toContain("dis-le franchement");
  });
});

/**
 * Le bug rapporté : sur un gent DÉJÀ EXISTANT, le document attaché n'était pas
 * pris en compte et restait intestable en Preview. Deuxième cause (après la
 * fusion des artefacts) : l'hydratation de l'espace départageait le cache local
 * et le serveur au compteur `version`, or ce compteur est calculé depuis le
 * cache local seul — il repart donc à 1 là où ce cache est froid, et le serveur
 * l'emportait en ramenant la configuration d'avant.
 */
describe("fraîcheur de la version de travail (Preview)", () => {
  const espace = (patch: Partial<Espace>): Espace => ({ version: 1, ...patch } as Espace);

  it("garde l'écriture locale quand le push vers le serveur n'a pas encore abouti", () => {
    const local = espace({ workingUpdatedAt: "2026-08-11T10:00:05.000Z", version: 1 });
    const remote = espace({ workingUpdatedAt: "2026-08-11T10:00:00.000Z", version: 7 });
    // Le compteur seul aurait fait gagner le serveur (7 > 1) et effacé le
    // document tout juste attaché.
    expect(localIsFresher(local, remote)).toBe(true);
  });

  it("laisse le serveur gagner quand il porte une écriture plus récente", () => {
    const local = espace({ workingUpdatedAt: "2026-08-11T09:00:00.000Z" });
    const remote = espace({ workingUpdatedAt: "2026-08-11T11:00:00.000Z" });
    expect(localIsFresher(local, remote)).toBe(false);
  });

  it("retombe sur le compteur pour les espaces d'avant l'horodatage", () => {
    expect(localIsFresher(espace({ version: 4 }), espace({ version: 2 }))).toBe(true);
    expect(localIsFresher(espace({ version: 2 }), espace({ version: 4 }))).toBe(false);
  });

  it("ne prétend rien quand il n'y a pas d'espace local", () => {
    expect(localIsFresher(undefined, espace({ version: 3 }))).toBe(false);
  });
});
