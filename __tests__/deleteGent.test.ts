import { confirmDeleteGentsMessage, deleteGentEverywhere } from "@/lib/deleteGent";
import { deletePublishedGent } from "@/lib/publishedGents";
import { deleteRemoteDraft } from "@/lib/builderDraftStorage";

jest.mock("@/lib/publishedGents", () => ({ deletePublishedGent: jest.fn() }));
jest.mock("@/lib/builderDraftStorage", () => ({ deleteRemoteDraft: jest.fn() }));

const mockedPublished = deletePublishedGent as jest.Mock;
const mockedDraft = deleteRemoteDraft as jest.Mock;

describe("suppression d'un gent partout où il peut exister", () => {
  beforeEach(() => {
    mockedPublished.mockReset();
    mockedDraft.mockReset();
  });

  it("réussit quand le brouillon et le gent publié sont supprimés", async () => {
    mockedDraft.mockResolvedValue({ ok: true });
    mockedPublished.mockResolvedValue({ ok: true });
    const result = await deleteGentEverywhere("g1");
    expect(result).toEqual({ ok: true });
    expect(mockedDraft).toHaveBeenCalledWith("g1");
    expect(mockedPublished).toHaveBeenCalledWith("g1");
  });

  it("réussit même si seul le gent publié existait (draft absent = no-op réussi)", async () => {
    mockedDraft.mockResolvedValue({ ok: true });
    mockedPublished.mockResolvedValue({ ok: true });
    expect(await deleteGentEverywhere("orphelin")).toEqual({ ok: true });
  });

  it("remonte l'échec du brouillon", async () => {
    mockedDraft.mockResolvedValue({ ok: false, error: "boom-draft" });
    mockedPublished.mockResolvedValue({ ok: true });
    expect(await deleteGentEverywhere("g1")).toEqual({ ok: false, error: "boom-draft" });
  });

  it("remonte l'échec du gent publié quand le brouillon a réussi", async () => {
    mockedDraft.mockResolvedValue({ ok: true });
    mockedPublished.mockResolvedValue({ ok: false, error: "boom-published" });
    expect(await deleteGentEverywhere("g1")).toEqual({ ok: false, error: "boom-published" });
  });

  it("lance les deux suppressions en parallèle, pas en séquence", async () => {
    const order: string[] = [];
    mockedDraft.mockImplementation(async () => {
      order.push("draft-start");
      await new Promise((r) => setTimeout(r, 5));
      order.push("draft-end");
      return { ok: true };
    });
    mockedPublished.mockImplementation(async () => {
      order.push("published-start");
      return { ok: true };
    });
    await deleteGentEverywhere("g1");
    // Le second appel démarre avant que le premier (plus lent) ne se termine.
    expect(order.indexOf("published-start")).toBeLessThan(order.indexOf("draft-end"));
  });
});

describe("message de confirmation de suppression", () => {
  it("nomme un seul gent", () => {
    expect(confirmDeleteGentsMessage(["Compagnon IA"])).toContain("« Compagnon IA »");
    expect(confirmDeleteGentsMessage(["Compagnon IA"])).not.toContain("gents (");
  });

  it("compte plusieurs gents et liste les premiers noms", () => {
    const msg = confirmDeleteGentsMessage(["A", "B", "C"]);
    expect(msg).toContain("3 gents");
    expect(msg).toContain("« A »");
    expect(msg).toContain("« C »");
  });
});
