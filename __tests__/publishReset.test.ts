import type { Espace, EspacesMap, PinnedArtefact } from "@/lib/types";

// La règle de remise à zéro et la précédence de version sont reproduites ici à
// l'identique de BuilderContext / publishedGents : ce sont elles qui décident
// d'effacer un rendu généré ou d'écraser une publication, donc elles méritent
// d'être verrouillées par des tests.

function pinnedConfigChanged(fresh: PinnedArtefact, existing?: PinnedArtefact): boolean {
  if (!existing) return true;
  if (fresh.mission.trim() !== existing.mission.trim()) return true;
  if (fresh.title.trim() !== existing.title.trim()) return true;
  const shape = (p: PinnedArtefact) => p.inputs.map((i) => `${i.id}|${i.kind}|${i.label}`).join("~");
  return shape(fresh) !== shape(existing);
}

function base(patch: Partial<PinnedArtefact> = {}): PinnedArtefact {
  return {
    enabled: true,
    title: "Vos prochains postes probables",
    mission: "Génère un tableau de bord de trajectoire.",
    inputs: [
      { id: "cv", label: "CV du candidat", kind: "file" },
      { id: "poste", label: "Poste et entreprise", kind: "text" },
    ],
    ...patch,
  };
}

describe("remise à zéro de l'artefact figé à la republication", () => {
  it("détecte l'ajout d'une entrée (cas « connection »)", () => {
    const fresh = base({
      inputs: [...base().inputs, { id: "connection", label: "Connexions LinkedIn", kind: "file" }],
    });
    expect(pinnedConfigChanged(fresh, base())).toBe(true);
  });

  it("détecte une mission modifiée", () => {
    expect(pinnedConfigChanged(base({ mission: "Nouvelle mission" }), base())).toBe(true);
  });

  it("détecte un libellé d'entrée modifié", () => {
    const fresh = base({ inputs: [{ id: "cv", label: "Votre CV (PDF)", kind: "file" }, base().inputs[1]] });
    expect(pinnedConfigChanged(fresh, base())).toBe(true);
  });

  it("ne remet pas à zéro quand rien n'a changé", () => {
    expect(pinnedConfigChanged(base(), base())).toBe(false);
  });

  it("ignore les valeurs saisies par l'utilisateur", () => {
    const withValues = base({
      inputs: base().inputs.map((i) => ({ ...i, value: "saisie de l'utilisateur" })),
    });
    expect(pinnedConfigChanged(withValues, base())).toBe(false);
  });

  it("considère une première publication comme un changement", () => {
    expect(pinnedConfigChanged(base(), undefined)).toBe(true);
  });
});

// Précédence de version appliquée par syncPublishedGentsFromRemote.
function mergeByVersion(local: EspacesMap, remote: EspacesMap): { merged: EspacesMap; stale: string[] } {
  const merged: EspacesMap = { ...local };
  const stale: string[] = [];
  for (const [id, remoteEspace] of Object.entries(remote)) {
    const localEspace = local[id];
    if (localEspace && (localEspace.version ?? 1) > (remoteEspace.version ?? 1)) {
      stale.push(id);
      continue;
    }
    merged[id] = remoteEspace;
  }
  return { merged, stale };
}

const espace = (version: number, marker: string) => ({ version, name: marker }) as unknown as Espace;

describe("précédence de version à la synchronisation", () => {
  it("ne laisse pas le serveur écraser une publication plus récente", () => {
    const { merged, stale } = mergeByVersion({ g: espace(4, "nouveau") }, { g: espace(3, "ancien") });
    expect(merged.g.name).toBe("nouveau");
    expect(stale).toEqual(["g"]);
  });

  it("laisse le serveur faire autorité à version égale ou supérieure", () => {
    expect(mergeByVersion({ g: espace(3, "local") }, { g: espace(3, "serveur") }).merged.g.name).toBe("serveur");
    expect(mergeByVersion({ g: espace(3, "local") }, { g: espace(5, "serveur") }).merged.g.name).toBe("serveur");
  });

  it("conserve les gents absents du serveur", () => {
    const { merged } = mergeByVersion({ local: espace(1, "hors ligne") }, {});
    expect(merged.local.name).toBe("hors ligne");
  });
});
