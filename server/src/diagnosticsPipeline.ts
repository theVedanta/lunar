import type { Connection, Diagnostic } from "vscode-languageserver/node";
import type { TextDocuments } from "vscode-languageserver/node";
import type { TextDocument } from "vscode-languageserver-textdocument";

import type { ReviewEngine } from "./review/types";
import { reviewIssuesToDiagnostics } from "./review/diagnostics";
import type { SettingsManager, ServerSettings } from "./settings";

export interface DiagnosticsPipeline {
  /**
   * Publishes diagnostics for a given document URI (if the document is open).
   * If the document is not known, this is a no-op.
   */
  publishForUri(uri: string): Promise<void>;

  /**
   * Publishes diagnostics for all currently-open documents managed by `documents`.
   */
  publishForAllOpenDocuments(): Promise<void>;
}

export interface CreateDiagnosticsPipelineParams {
  connection: Connection;
  documents: TextDocuments<TextDocument>;
  settings: SettingsManager;
  reviewEngine: ReviewEngine;

  /**
   * Optional filter: return false to skip publishing diagnostics for a URI.
   * Defaults to publishing for all open documents.
   */
  shouldDiagnoseUri?: (uri: string) => boolean;

  /**
   * Optional override for how to extract `maxNumberOfProblems` from settings.
   * Useful if settings shape changes in the future.
   */
  getMaxDiagnostics?: (settings: ServerSettings) => number | undefined;

  /**
   * Optional mapping hook to adjust diagnostics (e.g. add `source`, tweak `code`, etc.)
   * after conversion from review issues.
   */
  postProcessDiagnostics?: (params: {
    uri: string;
    diagnostics: Diagnostic[];
  }) => Diagnostic[];
}

/**
 * Wires together:
 * - document lifecycle events (content changes)
 * - settings changes (which should trigger refresh)
 * - review engine execution (producing review issues)
 * - conversion to LSP `Diagnostic`s
 * - publishing diagnostics to the client
 *
 * This intentionally does not register `connection.languages.diagnostics.on(...)`.
 * You can still do that separately if you want pull-based diagnostics as well.
 */
export function createDiagnosticsPipeline(
  params: CreateDiagnosticsPipelineParams,
): DiagnosticsPipeline {
  const {
    connection,
    documents,
    settings,
    reviewEngine,
    shouldDiagnoseUri = () => true,
    getMaxDiagnostics = (s) => s.maxNumberOfProblems,
    postProcessDiagnostics,
  } = params;

  async function computeDiagnosticsForOpenDocument(
    doc: TextDocument,
  ): Promise<Diagnostic[]> {
    const uri = doc.uri;

    // Settings can influence how many diagnostics we return (and later: which rules run, etc.).
    const docSettings = await settings.getDocumentSettings(uri);
    const maxDiagnostics = getMaxDiagnostics(docSettings);

    const issues = await reviewEngine.reviewDocument({
      uri,
      text: doc.getText(),
    });

    let diagnostics = reviewIssuesToDiagnostics(doc, issues, maxDiagnostics);

    if (postProcessDiagnostics) {
      diagnostics = postProcessDiagnostics({ uri, diagnostics });
    }

    return diagnostics;
  }

  async function publishForUri(uri: string): Promise<void> {
    if (!shouldDiagnoseUri(uri)) {
      return;
    }

    const doc = documents.get(uri);
    if (!doc) {
      // If the document isn't open/managed, we don't attempt to read from disk here.
      // You can add disk-backed analysis later if needed.
      return;
    }

    const diagnostics = await computeDiagnosticsForOpenDocument(doc);
    connection.sendDiagnostics({ uri, diagnostics });
  }

  async function publishForAllOpenDocuments(): Promise<void> {
    const tasks: Promise<void>[] = [];

    documents.all().forEach((doc) => {
      tasks.push(publishForUri(doc.uri));
    });

    await Promise.all(tasks);
  }

  // Push-based diagnostics: publish whenever content changes.
  // (Pull-based diagnostics via `connection.languages.diagnostics.on(...)` can still be used too.)
  documents.onDidChangeContent(async (change) => {
    await publishForUri(change.document.uri);
  });

  // Clean up cached per-document settings.
  documents.onDidClose((e) => {
    settings.onDidCloseDocument(e.document.uri);

    // Also clear diagnostics when the document is closed.
    connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
  });

  return {
    publishForUri,
    publishForAllOpenDocuments,
  };
}
