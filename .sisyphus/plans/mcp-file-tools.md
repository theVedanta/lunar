# Work Plan: MCP File System Tools for Review Engine

## Overview

**Goal**: Give Lunar's AI code review engine file system access via MCP, enabling it to read related files during review. Switch to fully agentic mode where the model uses tools to read files.

**Start Date**: 2026-03-10

---

## Technical Context

- **Current State**: `reviewDocument({ uri, text })` receives only current file text from LSP TextDocuments. Model produces structured ReviewIssues via `Output.object()` + Zod schema.
- **Target State**: Agentic mode with MCP file system tools + `Output.object()` structured output. Model reads files via tools, produces structured output.

**Key Dependencies**:
- `@ai-sdk/mcp@^1.0.0` — MCP client for Vercel AI SDK (v1.0.25 latest)
- `@modelcontextprotocol/server-filesystem` — Filesystem tools via npx
- GPT-5.2 model (upgrade from gpt-4o-mini)
- **MCP Transport**: `Experimental_StdioMCPTransport` from `@ai-sdk/mcp/mcp-stdio`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ LSP Server (server/src/server.ts)                           │
│   ├── InitializeParams.workspaceFolders → workspace root    │
│   ├── DiagnosticsPipeline → ReviewEngine.reviewDocument()   │
│   └── Effect Layer: ReviewEngine + MCPClient               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ MCP Filesystem Server (child process)                        │
│   Started on LSP init, long-lived                           │
│   Exposes: read_file, read_multiple_files, list_directory,   │
│            search_files, get_file_info                      │
│   (write tools filtered out)                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ generateText with Tools                                     │
│   model: openai('gpt-5.2')                                  │
│   tools: MCP file tools (filtered to read-only)              │
│   output: Output.object({ schema: ReviewIssues })           │
│   stopWhen: stepCountIs(5)  # 4 tool calls + 1 output     │
└─────────────────────────────────────────────────────────────┘
```

---

## Work Breakdown

### Phase 1: Dependency & Infrastructure

1. **Add `@ai-sdk/mcp` dependency**
   - File: `server/package.json`
   - Add: `"@ai-sdk/mcp": "^1.0.0"` (check latest version)
   - Run: `cd server && pnpm install`

2. **Create MCP Client service (Effect Tag)**
   - File: `server/src/review/mcpClient.ts` (new)
   - Exports:
     - `MCPClient` — Context.Tag for the MCP client service
     - `MCPClientService` interface with:
       - `tools: () => Promise<Record<string, Tool>>` — Get filtered read-only tools
       - `close: () => Promise<void>` — Cleanup
     - `makeMCPClientLayer` — Layer factory
   - Implementation:
     - Uses `Experimental_StdioMCPTransport` with `npx @modelcontextprotocol/server-filesystem <workspaceRoot>`
     - Filters tools to read-only subset: `read_file`, `read_multiple_files`, `list_directory`, `search_files`, `get_file_info`
     - Handles process lifecycle (spawn on init, kill on shutdown)

3. **Wire workspace folders through LSP**
   - File: `server/src/server.ts`
   - Pass workspace root to MCP client layer via InitializeParams
   - Access via: `connection.workspace.getWorkspaceFolders()` or params.workspaceFolders

### Phase 2: Modify Review Engine

4. **Update ReviewDocumentParams**
   - File: `server/src/review/types.ts`
   - Add optional `workspaceRoot?: string` field
   - Or create new `ReviewContext` interface passed alongside params

5. **Modify OpenAIReviewEngineLive**
   - File: `server/src/review/openaiEngine.ts`
   - Changes:
     - Add MCPClient dependency to layer
     - Change `generateText` call to include:
       - `tools: await mcpClient.tools()`
       - `output: Output.object({ schema: outputSchema, name: "ReviewIssues", ... })`
       - `stopWhen: stepCountIs(5)` — accounts for 4 tool calls + 1 structured output
     - Rewrite prompt for agentic mode (no file content in prompt)
     - Keep existing schema validation and issue mapping
   - Model: Change from `gpt-4o-mini` to `gpt-5.2`

6. **Update prompt for agentic mode**
   - Current: "File content:\n```\n{text}\n```"
   - New: "You have tools to read files. Review the file at URI: {uri}. Use read_file tool to read the content, then return review issues as structured JSON."
   - Keep the rules and constraints sections, remove file content injection

### Phase 3: Integration & Testing

7. **Update server.ts layer composition**
   - Add MCPClientLive to the layer graph
   - Ensure proper dependency ordering (MCPClient before ReviewEngine)
   - Add cleanup on connection shutdown

8. **Manual testing**
   - Run VS Code extension in dev host
   - Open various file types
   - Verify:
     - MCP server starts
     - Tools are available to model
     - Model reads files via tools
     - Structured output is produced
     - Diagnostics appear in editor

---

## Scope Boundaries

**INCLUDED**:
- MCP client service creation
- Tool filtering (read-only)
- Workspace root integration
- Agentic prompt rewrite
- Model upgrade to gpt-5.2
- Structured output + tools combo
- Long-lived MCP process management

**EXCLUDED**:
- Custom tool definitions (using MCP instead)
- Write tools (filtered out)
- Unit tests (manual testing only)
- Client extension changes
- Changes to DiagnosticsPipeline beyond params

---

## Acceptance Criteria

1. ✅ MCP filesystem server starts when LSP initializes
2. ✅ Model can read files via MCP tools during review
3. ✅ Only read-only tools available (write_file, create_directory, etc. filtered)
4. ✅ Model outputs structured ReviewIssues JSON
5. ✅ Latency acceptable for inline review (1s debounce + tool calls)
6. ✅ No regressions — diagnostics still appear for open files
7. ✅ Clean shutdown — MCP process killed when VS Code closes

---

## Files to Modify

| File | Change |
|------|--------|
| `server/package.json` | Add @ai-sdk/mcp dependency |
| `server/src/review/mcpClient.ts` | NEW — MCP client service |
| `server/src/review/types.ts` | Add workspaceRoot to params |
| `server/src/review/openaiEngine.ts` | Add tools, stopWhen, agentic prompt, model upgrade |
| `server/src/server.ts` | Wire MCP client, pass workspace root |

---

## Notes

- **Structured output + tools**: When using both, structured output generation counts as a step. With `stopWhen: stepCountIs(5)`, model gets 4 tool calls + 1 output step.
- **gpt-5.2**: Verify this model name works with `@ai-sdk/openai` v2. May need to use `openai('gpt-5.2')` or similar.
- **Workspace folders**: Use first workspace folder as root if multiple. If no workspace, use process.cwd() as fallback.
- **MCP process management**: Spawn with `spawn` from `child_process`. Store PID for cleanup. Handle stderr for debugging.
