// Client MCP minimal, transport "Streamable HTTP" uniquement (celui exposé
// par mcp.data.gouv.fr) : chaque requête est un POST JSON-RPC, la réponse
// arrive soit en JSON simple, soit en flux SSE qu'on lit en entier.
// Utilisable uniquement côté serveur (route API) — jamais dans le navigateur.

const MCP_PROTOCOL_VERSION = "2025-03-26";
const REQUEST_TIMEOUT_MS = 30_000;

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface JsonRpcResponse {
  id?: number | string;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

export class McpClient {
  private nextId = 1;
  private sessionId: string | null = null;

  constructor(
    public readonly name: string,
    private readonly url: string
  ) {}

  private async rpc(method: string, params?: Record<string, unknown>, notify = false): Promise<JsonRpcResponse> {
    const id = notify ? undefined : this.nextId++;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;

    const res = await fetch(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", ...(id !== undefined ? { id } : {}), method, params }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const newSession = res.headers.get("mcp-session-id");
    if (newSession) this.sessionId = newSession;

    if (notify) return {};
    if (!res.ok) {
      throw new Error(`MCP ${this.name} : HTTP ${res.status} sur ${method}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) {
      // Réponse SSE : on lit tout et on récupère le message JSON-RPC qui
      // correspond à notre id (le serveur peut intercaler des notifications).
      const body = await res.text();
      let match: JsonRpcResponse | null = null;
      for (const line of body.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        try {
          const parsed = JSON.parse(trimmed.slice(5).trim()) as JsonRpcResponse;
          if (parsed.id === id) match = parsed;
        } catch {
          // fragment non-JSON — ignoré
        }
      }
      if (!match) throw new Error(`MCP ${this.name} : pas de réponse pour ${method}`);
      if (match.error) throw new Error(`MCP ${this.name} : ${match.error.message}`);
      return match;
    }

    const parsed = (await res.json()) as JsonRpcResponse;
    if (parsed.error) throw new Error(`MCP ${this.name} : ${parsed.error.message}`);
    return parsed;
  }

  async connect(): Promise<void> {
    await this.rpc("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "getgents", version: "0.1.0" },
    });
    await this.rpc("notifications/initialized", {}, true);
  }

  async listTools(): Promise<McpTool[]> {
    const res = await this.rpc("tools/list", {});
    const tools = (res.result?.tools ?? []) as McpTool[];
    return tools.filter((t) => typeof t.name === "string");
  }

  /** Appelle un outil et renvoie le contenu texte concaténé du résultat. */
  async callTool(name: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
    const res = await this.rpc("tools/call", { name, arguments: args });
    const result = res.result ?? {};
    const content = (result.content ?? []) as { type?: string; text?: string }[];
    const text = content
      .filter((c) => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text)
      .join("\n");
    return { text: text || JSON.stringify(result), isError: result.isError === true };
  }
}
