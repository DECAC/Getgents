import {
  applyToolCallDelta,
  flattenToolRoundForRetry,
  isOrphanToolCallOutputError,
  shouldAttachWebPlugin,
  toOpenAIToolCalls,
  userFacingToolLoopError,
  type StreamedToolCall,
} from "@/lib/openRouterToolLoop";

describe("applyToolCallDelta", () => {
  it("assemble id, nom et arguments fragmentés", () => {
    const acc: StreamedToolCall[] = [];
    applyToolCallDelta(acc, [{ index: 0, id: "call_abc", type: "function", function: { name: "gmail_search", arguments: "" } }]);
    applyToolCallDelta(acc, [{ index: 0, function: { arguments: '{"query":"booking"}' } }]);
    expect(toOpenAIToolCalls(acc)).toEqual([
      {
        id: "call_abc",
        type: "function",
        function: { name: "gmail_search", arguments: '{"query":"booking"}' },
      },
    ]);
  });

  it("utilise l'index 0 si le fournisseur omet index", () => {
    const acc: StreamedToolCall[] = [];
    applyToolCallDelta(acc, [{ id: "call_x", function: { name: "gmail_search", arguments: "{}" } }]);
    expect(toOpenAIToolCalls(acc)[0].id).toBe("call_x");
  });
});

describe("toOpenAIToolCalls", () => {
  it("ajoute type function et arguments vides valides", () => {
    const calls = toOpenAIToolCalls([{ id: "call_1", function: { name: "gmail_search", arguments: "" } }]);
    expect(calls[0].type).toBe("function");
    expect(calls[0].function.arguments).toBe("{}");
  });

  it("ignore les slots incomplets", () => {
    expect(toOpenAIToolCalls([{ function: { arguments: "{" } }])).toEqual([]);
  });
});

describe("shouldAttachWebPlugin", () => {
  it("désactive la recherche web dès qu'un résultat d'outil est dans l'historique", () => {
    expect(shouldAttachWebPlugin(true, [{ role: "user", content: "bonjour" }])).toBe(true);
    expect(
      shouldAttachWebPlugin(true, [
        { role: "assistant", content: null, tool_calls: [] },
        { role: "tool", tool_call_id: "call_1", content: "[]" },
      ])
    ).toBe(false);
    expect(shouldAttachWebPlugin(false, [])).toBe(false);
  });
});

describe("orphan tool-call errors", () => {
  it("détecte l'erreur Azure vue en conversation", () => {
    const raw =
      'Provider returned error (fournisseur : Azure) { "error": { "message": "No tool call found for function call output with call_id call_OOP758uvvgFObosw35BfPz2b." } }';
    expect(isOrphanToolCallOutputError(raw)).toBe(true);
    expect(userFacingToolLoopError(raw)).not.toContain("call_OOP");
  });

  it("laisse les autres erreurs API telles quelles", () => {
    expect(userFacingToolLoopError("rate limit")).toBe("Erreur API : rate limit");
  });
});

describe("flattenToolRoundForRetry", () => {
  it("présente les résultats pour que le modèle puisse répondre sans protocole d'outils", () => {
    const text = flattenToolRoundForRetry(
      [{ function: { name: "gmail_search" } }],
      ['{"messages":[{"subject":"Booking.com"}]}']
    );
    expect(text).toContain("gmail_search");
    expect(text).toContain("Booking.com");
    expect(text).toContain("sans rappeler");
  });
});
