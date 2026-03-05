import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  DidChangeConfigurationNotification,
  DocumentDiagnosticReportKind,
  type DocumentDiagnosticReport,
  type InitializeParams,
  type InitializeResult,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";

import { createSettingsManager } from "./settings";
import { createDiagnosticsPipeline } from "./diagnosticsPipeline";
import { createStaticReviewEngine } from "./review/staticEngine";

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

      // We don't use completion in this project right now, but keeping the capability
      // enabled is fine if you plan to add it back later.
      completionProvider: {
        resolveProvider: true,
      },

      // Pull diagnostics support (via `connection.languages.diagnostics.on(...)`).
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
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
 * Review engine (currently static). Later this becomes the real code-review engine.
 * Keeping this as an interface makes it easy to swap out implementations.
 */
const reviewEngine = createStaticReviewEngine();

/**
 * Push-based diagnostics pipeline:
 * - runs the review engine on content changes
 * - converts review issues -> LSP diagnostics
 * - publishes results
 *
 * Note: We *also* implement pull-based diagnostics below via
 * `connection.languages.diagnostics.on(...)`. Having both is fine while iterating.
 */
const diagnosticsPipeline = createDiagnosticsPipeline({
  connection,
  documents,
  settings,
  reviewEngine,
});

// Configuration changes may affect diagnostics; settings manager will request a refresh.
connection.onDidChangeConfiguration((change) => {
  settings.onDidChangeConfiguration(change);

  // Since we also publish diagnostics on change events, we proactively republish for
  // all open documents here so the UI updates immediately.
  void diagnosticsPipeline.publishForAllOpenDocuments();
});

/**
 * Pull diagnostics endpoint (LSP 3.17+).
 * VS Code can ask the server for diagnostics for a given document without us pushing.
 */
connection.languages.diagnostics.on(async (params) => {
  const document = documents.get(params.textDocument.uri);

  if (!document) {
    return {
      kind: DocumentDiagnosticReportKind.Full,
      items: [],
    } satisfies DocumentDiagnosticReport;
  }

  // Ensure latest diagnostics are published (push channel), but also return a result
  // for the pull request. This keeps both paths consistent.
  const issues = await reviewEngine.reviewDocument({
    uri: document.uri,
    text: document.getText(),
  });

  const docSettings = await settings.getDocumentSettings(document.uri);

  // We reuse the conversion helpers via the pipeline indirectly by republishing.
  // For the pull response, we compute quickly by publishing then returning the same
  // computed diagnostics via a small local conversion (pipeline also does this).
  //
  // If you prefer zero duplication later, expose `computeDiagnostics` from the pipeline.
  const { reviewIssuesToDiagnostics } = await import("./review/diagnostics");
  const diagnostics = reviewIssuesToDiagnostics(
    document,
    issues,
    docSettings.maxNumberOfProblems,
  );

  return {
    kind: DocumentDiagnosticReportKind.Full,
    items: diagnostics,
  } satisfies DocumentDiagnosticReport;
});

connection.onDidChangeWatchedFiles((_change) => {
  connection.console.log("We received a file change event");
});

// Make the text document manager listen on the connection for open/change/close.
documents.listen(connection);

// Listen on the connection.
connection.listen();
