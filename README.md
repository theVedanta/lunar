# Lunar

AI-powered code review surfaced as LSP diagnostics — inline, in your editor, as you write.

Lunar runs a code review on every file you open, using GPT-4o-mini to flag real issues (clarity, security, error handling, complexity, and more) as standard editor diagnostics. Same squiggly lines, same Problems panel, same workflow — just with an AI reviewer looking over your shoulder.

---

## Why

Most code review happens too late. By the time a PR is open, context is lost and fixes are expensive.

Lunar moves review to the moment of writing. Issues appear inline as you type, at the line they occur, with severity levels that match how serious they actually are. It works for humans reviewing their own code and for AI agents that can read LSP output and act on it immediately.

---

## How It Works

```
You type  →  1s debounce  →  GPT-4o-mini reviews the file  →  diagnostics appear inline
```

The extension watches every file you open. After a 1-second pause in typing, it sends the file to the AI for review. Results come back as standard LSP `Diagnostic` objects — errors, warnings, hints — mapped to the exact lines they apply to.

A stale-result guard ensures that if the document changes while the model is thinking, the outdated results are dropped silently.

---

## Severity Levels

| Level | What It Means |
|---|---|
| Error | High-impact issue — security risk, broken contract, data loss potential |
| Warning | Should be fixed — logic smell, missing error handling, confusing code |
| Info | Worth considering — maintainability, testability, documentation gaps |
| Hint | Low-priority suggestion — naming, minor clarity improvement |

---

## Review Rules

The AI reviews against a fixed ruleset. It cannot hallucinate rule IDs.

| Rule | What It Flags |
|---|---|
| `review/clarity` | Unclear intent, confusing control flow |
| `review/naming` | Misleading or overly generic names |
| `review/error-handling` | Swallowed exceptions, missing error paths |
| `review/security-footgun` | Injection risks, exposed secrets, unsafe operations |
| `review/api-contract` | Type mismatches, nullability violations, broken invariants |
| `review/complexity` | Deep nesting, functions that need decomposition |
| `review/perf-hotpath` | Redundant work in loops, unnecessary allocations or I/O |
| `review/maintainability` | Tight coupling, implicit dependencies, hidden state |
| `review/testing-gap` | Logic that is likely untested and hard to test |
| `review/docs-mismatch` | Comments that contradict the code, missing critical docs |

---

## Setup

**Requirements:** Node.js 18+, VS Code, an OpenAI API key.

```bash
# Install dependencies
npm install

# Add your API key
echo "OPENAI_API_KEY=sk-..." > .env
```

**Run in VS Code:**

1. Press `Ctrl+Shift+B` to start the TypeScript compiler in watch mode.
2. Open the Run and Debug panel (`Ctrl+Shift+D`).
3. Select **Launch Client** and press `F5`.
4. Open any file in the Extension Development Host — diagnostics will appear automatically.

---

## Project Structure

```
.
├── client/src/
│   └── extension.ts          # VS Code client — boots the server via IPC
└── server/src/
    ├── server.ts             # LSP server entry point
    ├── settings.ts           # Per-document settings
    ├── diagnosticsPipeline.ts# Debouncer, staleness guard, diagnostic dispatch
    └── review/
        ├── types.ts          # ReviewIssue and ReviewEngine interfaces
        ├── openaiEngine.ts   # AI-backed review engine (GPT-4o-mini + Zod)
        ├── staticEngine.ts   # Stub engine for testing
        ├── diagnostics.ts    # ReviewIssue → LSP Diagnostic conversion
        └── rules.json        # The ruleset
```

---

## For AI Agents

Lunar speaks standard LSP. Any agent with access to LSP diagnostics can:

- Read issues from the Problems panel or via `textDocument/publishDiagnostics`
- Act on `source: "lunar"` diagnostics to distinguish them from compiler errors
- Use `code` (e.g. `review/security-footgun`) to prioritize which issues to fix
- Fix issues in the file and watch them clear automatically on the next review pass

This makes Lunar useful as a feedback loop for agentic coding workflows: write code, get review issues, fix them, repeat — all without leaving the editor or opening a PR.

---

## Configuration

| Setting | Default | Description |
|---|---|---|
| `languageServerExample.maxNumberOfProblems` | `100` | Max diagnostics shown per file |
| `languageServerExample.trace.server` | `"off"` | LSP message tracing for debugging |

---

## Stack

- [Vercel AI SDK](https://sdk.vercel.ai) — structured output from GPT-4o-mini
- [Zod](https://zod.dev) — schema validation for both rules and model output
- [@tanstack/pacer](https://tanstack.com/pacer) — per-document async debouncing
- [vscode-languageserver](https://github.com/microsoft/vscode-languageserver-node) — LSP server implementation
