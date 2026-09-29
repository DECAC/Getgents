import { authInjoignable, fetchAvecDelai } from "@/lib/delaiFetch";

/** Un serveur muet : ne répond jamais, n'abandonne que sur signal. */
const muet = ((_: unknown, init?: { signal?: AbortSignal }) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
  })) as unknown as typeof fetch;

describe("fetch borné (Supabase muet)", () => {
  it("abandonne au bout du délai au lieu d'attendre sans fin", async () => {
    const debut = Date.now();
    await expect(fetchAvecDelai(50, muet)("https://x")).rejects.toThrow("aborted");
    expect(Date.now() - debut).toBeLessThan(1000);
  });

  it("laisse passer une réponse à temps", async () => {
    const rapide = (async () => ({ ok: true })) as unknown as typeof fetch;
    await expect(fetchAvecDelai(50, rapide)("https://x")).resolves.toEqual({ ok: true });
  });

  it("respecte le signal de l'appelant", async () => {
    const c = new AbortController();
    const p = fetchAvecDelai(10_000, muet)("https://x", { signal: c.signal });
    c.abort();
    await expect(p).rejects.toThrow("aborted");
  });

  it("distingue « injoignable » de « pas de session »", () => {
    expect(authInjoignable({ name: "AuthRetryableFetchError" })).toBe(true);
    expect(authInjoignable({ name: "AuthSessionMissingError" })).toBe(false);
    expect(authInjoignable(null)).toBe(false);
  });
});
