import * as dotenv from "dotenv";
import * as path from "path";

// __dirname is server/out/ at runtime; walk up to find .env in server/ or project root
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

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

import { createSettingsManager } from "./settings";
import { createDiagnosticsPipeline } from "./diagnosticsPipeline";
import { createOpenAIReviewEngine } from "./review/openaiEngine";

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,

      // Push-only diagnostics (via `connection.sendDiagnostics(...)`).
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
    // Register for all configuration changes.
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

  connection.console.log("[ai-review] Server initialized.");
});

/**
 * Settings management (per-document when supported, otherwise global).
 * This is kept separate so we can expand settings as the review engine grows.
 */
const settings = createSettingsManager({
  connection,
  hasConfigurationCapability,
  section: "languageServerExample",
});

/**
 * Review engine (OpenAI-backed). Keeping this as an interface makes it easy to swap out implementations.
 */
const reviewEngine = createOpenAIReviewEngine({
  model: "gpt-4o-mini",
  logger: {
    log: (message) => connection.console.log(message),
    warn: (message) => connection.console.warn(message),
    error: (message) => connection.console.error(message),
  },
});

/**
 * Push-based diagnostics pipeline:
 * - runs the review engine on content changes
 * - converts review issues -> LSP diagnostics
 * - publishes results
 *
 * This server uses push diagnostics only.
 */
const diagnosticsPipeline = createDiagnosticsPipeline({
  connection,
  documents,
  settings,
  reviewEngine,
  debounceWaitMs: 1000,
});

// Configuration changes may affect diagnostics; settings manager will request a refresh.
connection.onDidChangeConfiguration((change) => {
  settings.onDidChangeConfiguration(change);

  // Since we also publish diagnostics on change events, we proactively republish for
  // all open documents here so the UI updates immediately.
  void diagnosticsPipeline.publishForAllOpenDocuments();
});

connection.onDidChangeWatchedFiles((_change) => {
  connection.console.log("We received a file change event");
});

// Make the text document manager listen on the connection for open/change/close.
documents.listen(connection);

// Listen on the connection.
connection.listen();
