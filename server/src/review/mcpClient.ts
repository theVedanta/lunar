import { Context, Effect, Layer } from "effect";
import { createMCPClient, type MCPClient as AiMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";

// ---------------------------------------------------------------------------
// Read-only tool allowlist
// ---------------------------------------------------------------------------

const READ_ONLY_TOOLS = new Set([
  "read_file",
  "read_multiple_files",
  "list_directory",
  "search_files",
  "get_file_info",
]);

// ---------------------------------------------------------------------------
// MCPClient service interface & Tag
// ---------------------------------------------------------------------------

// Re-export the tools type alias so callers can reference it
export type MCPToolSet = Awaited<ReturnType<AiMCPClient["tools"]>>;

export interface MCPClientService {
  /**
   * Returns a filtered record of read-only MCP tools.
   * Lazily fetched on first call, then cached.
   */
  readonly tools: () => Promise<MCPToolSet>;

  /** Tear down the MCP client and child process. */
  readonly close: () => Promise<void>;
}

export class MCPClient extends Context.Tag("MCPClient")<
  MCPClient,
  MCPClientService
>() {}

// ---------------------------------------------------------------------------
// Layer factory
// ---------------------------------------------------------------------------

/**
 * Creates a `MCPClient` layer that spawns `@modelcontextprotocol/server-filesystem`
 * via npx as a child process using StdioMCPTransport.
 *
 * @param workspaceRoot - The root directory the MCP filesystem server is
 *   allowed to read. Falls back to `process.cwd()` if not provided.
 */
export const makeMCPClientLayer = (
  workspaceRoot?: string,
): Layer.Layer<MCPClient> =>
  Layer.effect(
    MCPClient,
    Effect.gen(function* () {
      const root = workspaceRoot ?? process.cwd();

      const client = yield* Effect.tryPromise({
        try: () =>
          createMCPClient({
            transport: new Experimental_StdioMCPTransport({
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-filesystem", root],
            }),
          }),
        catch: (err) =>
          new Error(`Failed to initialize MCP client: ${String(err)}`),
      }).pipe(Effect.catchAll((err) => Effect.die(err)));

      // Cache the tools after first fetch
      let cachedTools: MCPToolSet | undefined;

      const tools = async (): Promise<MCPToolSet> => {
        if (cachedTools) {
          return cachedTools;
        }

        const allTools = await client.tools();

        // Filter to read-only subset
        const filtered: MCPToolSet = {};
        for (const [name, tool] of Object.entries(allTools)) {
          if (READ_ONLY_TOOLS.has(name)) {
            filtered[name] = tool;
          }
        }

        cachedTools = filtered;
        return filtered;
      };

      const close = async (): Promise<void> => {
        await client.close();
      };

      return { tools, close };
    }),
  );
