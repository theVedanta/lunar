import type { Connection, Diagnostic } from "vscode-languageserver/node";
import type { TextDocuments } from "vscode-languageserver/node";
import type { TextDocument } from "vscode-languageserver-textdocument";

import { AsyncDebouncer } from "@tanstack/pacer";

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
   * Debounce document diagnostics on content change.
   * Useful for expensive engines (e.g. remote AI review).
   */
  debounceWaitMs?: number;

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
    debounceWaitMs = 2500,
    shouldDiagnoseUri = () => true,
    getMaxDiagnostics = (s) => s.maxNumberOfProblems,
    postProcessDiagnostics,
  } = params;

  async function computeDiagnosticsForOpenDocument(
    doc: TextDocument,
  ): Promise<Diagnostic[]> {
    const uri = doc.uri;
    const version = doc.version;
    const startedAt = Date.now();

    connection.console.log(
      `[diagnostics] compute start uri=${uri} version=${version}`,
    );

    // Settings can influence how many diagnostics we return (and later: which rules run, etc.).
    const docSettings = await settings.getDocumentSettings(uri);
    const maxDiagnostics = getMaxDiagnostics(docSettings);

    const issues = await reviewEngine.reviewDocument({ uri, text: doc.getText() });

    connection.console.log(
      `[diagnostics] compute done uri=${uri} version=${version} issues=${issues.length} ms=${Date.now() - startedAt}`,
    );

    let diagnostics = reviewIssuesToDiagnostics(doc, issues, maxDiagnostics);

    if (postProcessDiagnostics) {
      diagnostics = postProcessDiagnostics({ uri, diagnostics });
    }

    return diagnostics;
  }

  async function publishForUriAtVersion(
    uri: string,
    version: number,
  ): Promise<void> {
    if (!shouldDiagnoseUri(uri)) {
      return;
    }

    const doc = documents.get(uri);
    if (!doc || doc.version !== version) {
      return;
    }

    const diagnostics = await computeDiagnosticsForOpenDocument(doc);

    // Avoid publishing stale results if the document changed while we were computing.
    const latest = documents.get(uri);
    if (!latest || latest.version !== version) {
      return;
    }

    connection.sendDiagnostics({ uri, diagnostics });
  }

  async function publishForUri(uri: string): Promise<void> {
    const doc = documents.get(uri);
    if (!doc) {
      // If the document isn't open/managed, we don't attempt to read from disk here.
      // You can add disk-backed analysis later if needed.
      return;
    }

    await publishForUriAtVersion(uri, doc.version);
  }

  type PublishFn = (version: number) => Promise<void>;
  const debouncers = new Map<string, AsyncDebouncer<PublishFn>>();

  function getDebouncer(uri: string): AsyncDebouncer<PublishFn> {
    const existing = debouncers.get(uri);
    if (existing) {
      return existing;
    }

    const d = new AsyncDebouncer<PublishFn>(
      async (version: number) => {
        await publishForUriAtVersion(uri, version);
      },
      {
        wait: debounceWaitMs,
        throwOnError: false,
        onError: (error) => {
          connection.console.error(
            `[diagnostics] debounced publish failed for ${uri}: ${String(error)}`,
          );
        },
      },
    );

    debouncers.set(uri, d);
    return d;
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
    const uri = change.document.uri;
    const version = change.document.version;

    const d = getDebouncer(uri);
    void d.maybeExecute(version);
  });

  // Clean up cached per-document settings.
  documents.onDidClose((e) => {
    settings.onDidCloseDocument(e.document.uri);

    const d = debouncers.get(e.document.uri);
    if (d) {
      d.cancel();
      d.abort();
      debouncers.delete(e.document.uri);
    }

    // Also clear diagnostics when the document is closed.
    connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
  });

  return {
    publishForUri,
    publishForAllOpenDocuments,
  };
}
