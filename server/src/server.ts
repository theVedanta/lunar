import * as dotenv from "dotenv";
import * as path from "node:path";

// __dirname is server/out/ at runtime; walk up to find .env in server/ or project root
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

import { Effect, Layer } from "effect";

import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  DidChangeConfigurationNotification,
  type InitializeParams,
  type InitializeResult,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";

import { SettingsManager, makeSettingsManagerLayer } from "./settings";
import {
  DiagnosticsPipeline,
  makeDiagnosticsPipelineLayer,
} from "./diagnosticsPipeline";
import { ReviewLogger, ReviewEngine } from "./review/types";
import { makeAIReviewEngineLayer } from "./review/aiEngine";
import { MCPClient, makeMCPClientLayer } from "./review/mcpClient";

// ---------------------------------------------------------------------------
// LSP boilerplate (unchanged — these are runtime values, not services)
// ---------------------------------------------------------------------------

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

// Workspace root resolved from InitializeParams; used to scope MCP filesystem access.
let workspaceRoot: string | undefined;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  // Resolve workspace root from the first workspace folder or rootUri/rootPath
  const firstFolder = params.workspaceFolders?.[0];
  if (firstFolder) {
    // workspaceFolders URIs are file:// URIs
    const uri = firstFolder.uri;
    workspaceRoot = uri.startsWith("file://")
      ? decodeURIComponent(uri.slice("file://".length))
      : uri;
  } else if (params.rootUri) {
    const uri = params.rootUri;
    workspaceRoot = uri.startsWith("file://")
      ? decodeURIComponent(uri.slice("file://".length))
      : uri;
  } else if (params.rootPath) {
    workspaceRoot = params.rootPath;
  }

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
    },
  };

  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: { supported: true },
    };
  }

  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined,
    );
  }

  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log("Workspace folder change event received.");
    });
  }

  connection.console.log("Server initialized.");
  connection.console.log(
    `[LUNAR] workspace root: ${workspaceRoot ?? process.cwd()}`,
  );

  // ------------------------------------------------------------------
  // Build the full Effect layer graph and boot the pipeline
  // ------------------------------------------------------------------

  // ReviewLogger — wired to the LSP connection console
  const ReviewLoggerLive: Layer.Layer<ReviewLogger> = Layer.succeed(
    ReviewLogger,
    {
      log: (message: string) =>
        Effect.sync(() => connection.console.log("[LUNAR] " + message)),
      warn: (message: string) =>
        Effect.sync(() => connection.console.warn("[LUNAR] " + message)),
      error: (message: string) =>
        Effect.sync(() => connection.console.error("[LUNAR] " + message)),
    },
  );

  // MCPClient — long-lived filesystem MCP server child process
  const MCPClientLive: Layer.Layer<MCPClient> =
    makeMCPClientLayer(workspaceRoot);

  // ReviewEngine (OpenAI-backed, agentic mode with MCP tools)
  const ReviewEngineLive: Layer.Layer<
    ReviewEngine,
    never,
    ReviewLogger | MCPClient
  > = makeAIReviewEngineLayer({ model: "gpt-4.1-mini" });

  // SettingsManager
  const SettingsManagerLive: Layer.Layer<SettingsManager> =
    makeSettingsManagerLayer({
      connection,
      hasConfigurationCapability,
      section: "languageServerExample",
    });

  // DiagnosticsPipeline
  const DiagnosticsPipelineLive: Layer.Layer<
    DiagnosticsPipeline,
    never,
    ReviewEngine | SettingsManager | ReviewLogger
  > = makeDiagnosticsPipelineLayer({
    connection,
    documents,
    debounceWaitMs: 1000,
  });

  // ReviewEngine needs ReviewLogger + MCPClient
  const ReviewEngineFull: Layer.Layer<ReviewEngine> = ReviewEngineLive.pipe(
    Layer.provide(Layer.mergeAll(ReviewLoggerLive, MCPClientLive)),
  );

  // Compose all layers into a single self-contained layer
  const AppLayer: Layer.Layer<
    DiagnosticsPipeline | SettingsManager | ReviewLogger | MCPClient
  > = Layer.mergeAll(
    DiagnosticsPipelineLive,
    SettingsManagerLive,
    ReviewLoggerLive,
    MCPClientLive,
  ).pipe(
    Layer.provide(
      Layer.mergeAll(ReviewEngineFull, SettingsManagerLive, ReviewLoggerLive),
    ),
  );

  // Build a runtime from our composed layer and use it for all subsequent
  // Effect execution.
  const runtimeEffect = Effect.gen(function* () {
    // Obtaining the services here forces the layers to be constructed (and
    // therefore the document-lifecycle event handlers to be registered).
    const pipeline = yield* DiagnosticsPipeline;
    const settings = yield* SettingsManager;
    const mcp = yield* MCPClient;

    return { pipeline, settings, mcp };
  }).pipe(Effect.provide(AppLayer));

  Effect.runPromise(runtimeEffect).then(
    ({ pipeline, settings, mcp }) => {
      // Configuration changes may affect diagnostics — republish for all
      // open documents.
      connection.onDidChangeConfiguration((change) => {
        Effect.runSync(settings.onDidChangeConfiguration(change));
        Effect.runPromise(pipeline.publishForAllOpenDocuments()).catch(
          (err) => {
            connection.console.error(
              `[LUNAR] publishForAllOpenDocuments failed: ${String(err)}`,
            );
          },
        );
      });

      connection.onDidChangeWatchedFiles((_change) => {
        connection.console.log("We received a file change event");
      });

      // Clean up MCP process on shutdown
      connection.onShutdown(() => {
        void mcp.close().catch((err) => {
          connection.console.error(
            `[LUNAR] MCP client close failed: ${String(err)}`,
          );
        });
      });
    },
    (err) => {
      connection.console.error(
        `[LUNAR] Fatal: failed to build Effect runtime: ${String(err)}`,
      );
    },
  );
});

// Make the text document manager listen on the connection for open/change/close.
documents.listen(connection);

// Listen on the connection.
connection.listen();
