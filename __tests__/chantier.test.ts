import {
  consigneChantier,
  dossierChantier,
  estPartieDuDossier,
  IDS_DOSSIER,
  mergeDossierChantier,
  PROMPT_CHANTIER_DEFAUT,
} from "@/lib/chantier";
import { parseDashboard } from "@/lib/dashboardArtefact";
import { contexteArtefacts, versBlocs } from "@/lib/operationsBlocs";
import { brouillonNeuf, ONGLET_DU_FORMAT, FORMATS_GENT } from "@/lib/builderDraftStorage";
import { draftToEspace } from "@/lib/publishedGents";
import { espaceForPublicLink } from "@/lib/espaceApiPayload";
import { buildGentSystemPrompt } from "@/lib/gentRuntimePrompt";
import { composerVersionPersonnelle, fusionnerUsage } from "@/lib/versionPersonnelle";
import type { Artefact, Espace } from "@/lib/types";

const note: Artefact = { id: "note-1", title: "Ma note", type: "Note", icon: "📝", date: "hier" };

describe("le dossier de chantier vierge", () => {
  const dossier = dossierChantier();

  it("a ses cinq parties, dans l'ordre des onglets, aux identifiants stables", () => {
    expect(dossier.map((a) => a.id)).toEqual([
      IDS_DOSSIER.ensemble,
      IDS_DOSSIER.bien,
      IDS_DOSSIER.artisans,
      IDS_DOSSIER.devis,
      IDS_DOSSIER.planning,
    ]);
    expect(dossier.map((a) => a.title)).toEqual(["Vue d'ensemble", "Chantier", "Artisans", "Devis", "Planning"]);
    expect(dossier.every(estPartieDuDossier)).toBe(true);
  });

  it("passe tel quel le vocabulaire fermé : aucun bloc n'est jeté en silence", () => {
    // `parseDashboard` refuse un bloc vide. Un squelette dont un bloc tombe
    // afficherait une partie amputée, sans que rien ne le signale.
    for (const partie of dossier) {
      const relu = parseDashboard(partie.dashboard);
      expect(relu).not.toBeNull();
      expect(relu!.blocks).toHaveLength(partie.dashboard!.blocks.length);
      expect(versBlocs(partie)?.blocks).toHaveLength(partie.dashboard!.blocks.length);
    }
  });

  it("dit dans chaque partie par où commencer", () => {
    for (const partie of dossier) {
      const commencer = partie.dashboard!.blocks.find((b) => b.type === "callout");
      expect(commencer && "title" in commencer && commencer.title).toBe("Pour commencer");
    }
  });

  it("est neuf à chaque appel : remplir un dossier ne remplit pas le suivant", () => {
    const a = dossierChantier();
    (a[0].dashboard!.blocks as unknown[]).length = 0;
    expect(dossierChantier()[0].dashboard!.blocks.length).toBeGreaterThan(0);
  });

  it("est visible de l'assistant, avec ses identifiants, pour qu'il puisse le retoucher", () => {
    const ctx = contexteArtefacts(dossier);
    for (const id of Object.values(IDS_DOSSIER)) expect(ctx).toContain(`"${id}"`);
  });
});

describe("le dossier n'est posé qu'une fois", () => {
  it("s'ajoute en tête quand aucune partie n'existe", () => {
    const r = mergeDossierChantier([note], true);
    expect(r.map((a) => a.id)).toEqual([...Object.values(IDS_DOSSIER), "note-1"]);
  });

  it("n'écrase JAMAIS un dossier commencé", () => {
    const rempli = { ...dossierChantier()[2], title: "Artisans", date: "mis à jour hier" };
    rempli.dashboard = { blocks: [{ id: "x", type: "text", body: "Rivière Plomberie, retenu le 23/09." }] };
    const r = mergeDossierChantier([rempli, note], true);
    expect(r).toEqual([rempli, note]);
  });

  it("ne fait pas revenir une partie supprimée exprès", () => {
    const sansDevis = dossierChantier().filter((a) => a.id !== IDS_DOSSIER.devis);
    expect(mergeDossierChantier(sansDevis, true).map((a) => a.id)).not.toContain(IDS_DOSSIER.devis);
  });

  it("ne touche à rien sur un gent qui n'est pas un chantier", () => {
    expect(mergeDossierChantier([note], false)).toEqual([note]);
  });
});

describe("le type de gent « Le chantier »", () => {
  const draft = brouillonNeuf("draft-chantier", "chantier");
  const espace = draftToEspace(draft);

  it("se crée nommé, activé, avec ses instructions d'expert et la recherche web", () => {
    expect(FORMATS_GENT).toContain("chantier");
    expect(draft.name).toBe("Mon chantier");
    expect(draft.icon).toBe("🏗️");
    expect(draft.chantier?.enabled).toBe(true);
    expect(draft.webSearch).toBe(true);
    expect(draft.systemPrompt).toBe(PROMPT_CHANTIER_DEFAUT);
    expect(ONGLET_DU_FORMAT.chantier).toBe("prompt");
    // Une phrase du créateur ne remplace pas l'emblème.
    expect(brouillonNeuf("d2", "chantier", "Rénovation de mon T3 à Lyon").icon).toBe("🏗️");
  });

  it("s'ouvre avec son dossier : l'espace porte les cinq parties dès la création", () => {
    expect(espace.chantier).toEqual({ enabled: true });
    expect(espace.artefacts.filter(estPartieDuDossier)).toHaveLength(5);
  });

  it("garde son dossier quand on commence un nouvel échange", () => {
    // « Nouvel échange » ajoute un fil ; les artefacts ne vivent pas dans les fils.
    const avecFils: Espace = {
      ...espace,
      conversations: [{ id: "neuf", startedAt: "maintenant", messages: [] }, ...espace.conversations],
      activeConversationId: "neuf",
    };
    expect(avecFils.artefacts).toBe(espace.artefacts);
  });

  it("l'espace personnel garde le dossier REMPLI, pas le squelette de la version diffusée", () => {
    const rempli = dossierChantier().map((a) =>
      a.id === IDS_DOSSIER.devis ? { ...a, date: "mis à jour", dashboard: { blocks: [{ id: "d", type: "text" as const, body: "Devis plomberie : 11 902 € TTC." }] } } : a
    );
    const travail: Espace = { ...espace, artefacts: [...rempli, note] };
    const personnel = composerVersionPersonnelle(draftToEspace(draft), travail);
    expect(personnel.artefacts).toEqual(travail.artefacts);
    expect(fusionnerUsage(draftToEspace(draft), travail).artefacts).toEqual(travail.artefacts);
  });

  it("un visiteur reçoit le dossier VIERGE, jamais celui du créateur", () => {
    const rempli = dossierChantier().map((a) => ({ ...a, date: "secret", dashboard: { blocks: [{ id: "s", type: "text" as const, body: "12 rue Duguesclin" }] } }));
    const visiteur = espaceForPublicLink({ ...espace, artefacts: [...rempli, note] });
    expect(visiteur.chantier).toEqual({ enabled: true });
    expect(JSON.stringify(visiteur.artefacts)).not.toContain("12 rue Duguesclin");
    expect(visiteur.artefacts.map((a) => a.id)).toEqual(Object.values(IDS_DOSSIER));
  });

  it("la consigne de forme est jointe au gent chantier, et à lui seul", () => {
    const repere = "DOSSIER DE CHANTIER";
    expect(consigneChantier()).toContain(repere);
    expect(buildGentSystemPrompt(espace, { variant: "espace" })).toContain(repere);
    expect(buildGentSystemPrompt(espace, { variant: "sharedLink" })).toContain(repere);
    expect(buildGentSystemPrompt(espace, { variant: "superGent" })).not.toContain(repere);
    expect(buildGentSystemPrompt(draftToEspace(brouillonNeuf("d3", "conversationnel")), { variant: "espace" })).not.toContain(repere);
  });

  it("le prompt d'expert pose ses deux garde-fous", () => {
    expect(PROMPT_CHANTIER_DEFAUT).toMatch(/n'inventes jamais/);
    expect(PROMPT_CHANTIER_DEFAUT).toMatch(/c'est toujours moi qui valide/);
  });
});
