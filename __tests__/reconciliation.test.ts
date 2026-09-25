import { reconcilier } from "@/lib/reconciliation";

describe("gent présent ici, absent du serveur", () => {
  const local = { a: 1, fantome: 2, neuf: 3 };
  const distant = { a: 1 };

  it("déjà connu du serveur : supprimé ailleurs, écarté", () => {
    expect(reconcilier(local, distant, new Set(["a", "fantome"]))).toEqual({ aEnvoyer: ["neuf"], ecartes: ["fantome"] });
  });

  it("cache d'avant la règle (aucune liste) : rien n'est renvoyé", () => {
    expect(reconcilier(local, distant, null)).toEqual({ aEnvoyer: [], ecartes: ["fantome", "neuf"] });
  });

  it("présent des deux côtés : rien à décider", () => {
    expect(reconcilier({ a: 1 }, { a: 1 }, new Set())).toEqual({ aEnvoyer: [], ecartes: [] });
  });
});

describe("synchronisation du studio : un gent supprimé ne revient plus", () => {
  const stockage = new Map<string, string>();
  const envois: string[] = [];
  let distant: Record<string, unknown> = {};

  beforeAll(() => {
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => stockage.get(k) ?? null,
        setItem: (k: string, v: string) => void stockage.set(k, v),
        removeItem: (k: string) => void stockage.delete(k),
      },
      dispatchEvent: () => true,
      addEventListener: () => {},
    };
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class {};
    global.fetch = jest.fn(async (url: string, init?: { method?: string }) => {
      if (init?.method === "PUT") {
        envois.push(decodeURIComponent(String(url).split("/").pop() ?? ""));
        return { ok: true, status: 200, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => ({ drafts: distant }) };
    }) as unknown as typeof fetch;
  });
  afterAll(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  const brouillon = (id: string) => ({ id, name: id, updatedAt: "2026-09-25" });

  it("un vieux cache (Radar Emploi) n'est pas renvoyé ; un gent créé ici l'est", async () => {
    jest.useFakeTimers();
    const mod = await import("@/lib/builderDraftStorage");
    // Cache d'avant la règle : démonstrations et gent supprimé ailleurs.
    mod.writeStoredDrafts({ "radar-emploi": brouillon("radar-emploi"), "draft-1": brouillon("draft-1") } as never);
    distant = { "draft-1": brouillon("draft-1") };
    let fusion = await mod.syncDraftsFromRemote();
    expect(Object.keys(fusion as object)).toEqual(["draft-1"]);
    expect(Object.keys(mod.readStoredDrafts())).toEqual(["draft-1"]);
    expect(mod.dernierBrouillonsEcartes()).toEqual(["radar-emploi"]);

    // Un gent créé ici, pas encore arrivé au serveur : il part.
    mod.writeStoredDrafts({ ...mod.readStoredDrafts(), "draft-2": brouillon("draft-2") } as never);
    fusion = await mod.syncDraftsFromRemote();
    expect(Object.keys(fusion as object).sort()).toEqual(["draft-1", "draft-2"]);
    jest.advanceTimersByTime(2000);
    expect(envois).toEqual(["draft-2"]);

    // Supprimé sur une autre machine après avoir été connu : oublié ici.
    distant = { "draft-2": brouillon("draft-2") };
    fusion = await mod.syncDraftsFromRemote();
    expect(Object.keys(fusion as object)).toEqual(["draft-2"]);
    jest.advanceTimersByTime(2000);
    expect(envois).toEqual(["draft-2"]);
    jest.useRealTimers();
  });
});
