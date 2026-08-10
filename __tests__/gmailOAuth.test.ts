import { decodeOAuthState, encodeOAuthState } from "@/lib/server/gmail";

describe("gmail OAuth state", () => {
  it("encode et decode un gentId", () => {
    const state = encodeOAuthState("voyage-v5");
    const parsed = decodeOAuthState(state);
    expect(parsed?.gentId).toBe("voyage-v5");
  });

  it("rejette un state expiré", () => {
    const expired = Buffer.from(JSON.stringify({ gentId: "x", exp: Date.now() - 1000 }), "utf8").toString(
      "base64url"
    );
    expect(decodeOAuthState(expired)).toBeNull();
  });
});
