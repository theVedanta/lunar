import { Context, Effect, Layer } from "effect";
import type { Connection, Diagnostic } from "vscode-languageserver/node";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { TextDocuments } from "vscode-languageserver/node";
import type { TextDocument } from "vscode-languageserver-textdocument";

import { AsyncDebouncer } from "@tanstack/pacer";

import {
  ReviewEngine,
  ReviewLogger,
  type MissingApiKeyError,
  type RulesLoadError,
  type ReviewRequestError,
} from "./review/types";
import { reviewIssuesToDiagnostics } from "./review/diagnostics";
import { SettingsManager, type ServerSettings } from "./settings";

// ---------------------------------------------------------------------------
// Sentinel diagnostic — published while AI review is in progress so that any
// LSP client (including AI coding agents) sees a non-empty diagnostics list
// and knows the file has not yet been fully analysed.  Once the real review
// finishes the sentinel is atomically replaced with actual issues (or cleared).
// ---------------------------------------------------------------------------

const SENTINEL_DIAGNOSTIC: Diagnostic = {
  range: {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 1 },
  },
  severity: DiagnosticSeverity.Information,
  source: "lunar",
  code: "lunar/analyzing",
  message: "AI Code Review: analyzing…",
};

// ---------------------------------------------------------------------------
// DiagnosticsPipeline service interface
// ---------------------------------------------------------------------------

/**
 * The `DiagnosticsPipeline` service manages the lifecycle of computing and
 * publishing LSP diagnostics for open documents.
 *
 * Consumers access it via `yield* DiagnosticsPipeline`.
 */
export class DiagnosticsPipeline extends Context.Tag("DiagnosticsPipeline")<
  DiagnosticsPipeline,
  {
    /**
     * Publishes diagnostics for a given document URI (if the document is open).
     * If the document is not known, this is a no-op.
     */
    readonly publishForUri: (uri: string) => Effect.Effect<void>;

    /**
     * Publishes diagnostics for all currently-open documents managed by
     * `documents`.
     */
    readonly publishForAllOpenDocuments: () => Effect.Effect<void>;
  }
>() {}

// ---------------------------------------------------------------------------
// Layer construction parameters
// ---------------------------------------------------------------------------

export interface DiagnosticsPipelineConfig {
  readonly connection: Connection;
  readonly documents: TextDocuments<TextDocument>;

  /**
   * Debounce document diagnostics on content change.
   * Useful for expensive engines (e.g. remote AI review).
   */
  readonly debounceWaitMs?: number;

  /**
   * Optional filter: return false to skip publishing diagnostics for a URI.
   * Defaults to publishing for all open documents.
   */
  readonly shouldDiagnoseUri?: (uri: string) => boolean;

  /**
   * Optional override for how to extract `maxNumberOfProblems` from settings.
   * Useful if settings shape changes in the future.
   */
  readonly getMaxDiagnostics?: (settings: ServerSettings) => number | undefined;

  /**
   * Optional mapping hook to adjust diagnostics (e.g. add `source`, tweak
   * `code`, etc.) after conversion from review issues.
   */
  readonly postProcessDiagnostics?: (params: {
    uri: string;
    diagnostics: Diagnostic[];
  }) => Diagnostic[];
}

// ---------------------------------------------------------------------------
// Layer: DiagnosticsPipelineLive
// ---------------------------------------------------------------------------

/**
 * Builds a live `DiagnosticsPipeline` layer.
 *
 * Dependencies (via Effect context):
 *   - `ReviewEngine`
 *   - `SettingsManager`
 *   - `ReviewLogger`
 *
 * Runtime values (`Connection`, `TextDocuments`, options) are passed via the
 * config parameter because they originate from the LSP initialization
 * handshake and don't fit neatly into the Effect layer graph.
 */
export const makeDiagnosticsPipelineLayer = (
  config: DiagnosticsPipelineConfig,
): Layer.Layer<
  DiagnosticsPipeline,
  never,
  ReviewEngine | SettingsManager | ReviewLogger
> => {
  const {
    connection,
    documents,
    debounceWaitMs = 2500,
    shouldDiagnoseUri = () => true,
    getMaxDiagnostics = (s) => s.maxNumberOfProblems,
    postProcessDiagnostics,
  } = config;

  return Layer.effect(
    DiagnosticsPipeline,
    Effect.gen(function* () {
      const reviewEngine = yield* ReviewEngine;
      const settings = yield* SettingsManager;
      const logger = yield* ReviewLogger;

      // Tracks the last text successfully passed to the review engine per URI.
      // Used to compute a diff on subsequent reviews.
      const lastReviewedText = new Map<string, string>();

      // -----------------------------------------------------------------
      // Core: compute diagnostics for a single open document
      // -----------------------------------------------------------------

      const computeDiagnosticsForOpenDocument = (
        doc: TextDocument,
      ): Effect.Effect<
        Diagnostic[],
        MissingApiKeyError | RulesLoadError | ReviewRequestError
      > =>
        Effect.gen(function* () {
          const uri = doc.uri;
          const version = doc.version;
          const startedAt = Date.now();

          yield* logger.log(
            `[diagnostics] compute start uri=${uri} version=${version}`,
          );

          const docSettings = yield* settings.getDocumentSettings(uri);
          const maxDiagnostics = getMaxDiagnostics(docSettings);

          const issues = yield* reviewEngine.reviewDocument({
            uri,
            text: doc.getText(),
            previousText: lastReviewedText.get(uri),
          });

          lastReviewedText.set(uri, doc.getText());

          yield* logger.log(
            `[diagnostics] compute done uri=${uri} version=${version} issues=${issues.length} ms=${Date.now() - startedAt}`,
          );

          let diagnostics = reviewIssuesToDiagnostics(
            doc,
            issues,
            maxDiagnostics,
          );

          if (postProcessDiagnostics) {
            diagnostics = postProcessDiagnostics({ uri, diagnostics });
          }

          return diagnostics;
        });

      // -----------------------------------------------------------------
      // Publish at a specific document version (stale-check guard)
      // -----------------------------------------------------------------

      const publishForUriAtVersion = (
        uri: string,
        version: number,
      ): Effect.Effect<void> =>
        Effect.gen(function* () {
          if (!shouldDiagnoseUri(uri)) {
            return;
          }

          const doc = documents.get(uri);
          if (!doc || doc.version !== version) {
            return;
          }

          // Publish the sentinel immediately so any LSP client polling
          // diagnostics sees a non-clean state while the AI review runs.
          connection.sendDiagnostics({
            uri,
            diagnostics: [SENTINEL_DIAGNOSTIC],
          });

          // Run the review engine. If it fails (missing API key, rules load
          // error, request error) we log and swallow — the user simply sees
          // no diagnostics rather than a crash.
          const diagnosticsOrNone = yield* computeDiagnosticsForOpenDocument(
            doc,
          ).pipe(
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                yield* logger.error(
                  `[diagnostics] compute failed uri=${uri} error=${error._tag}`,
                );
                return [] as Diagnostic[];
              }),
            ),
          );

          // Avoid publishing stale results if the document changed while we
          // were computing.  Also clear the sentinel — if the version is now
          // stale a fresh run will emit its own sentinel shortly.
          const latest = documents.get(uri);
          if (!latest || latest.version !== version) {
            connection.sendDiagnostics({ uri, diagnostics: [] });
            return;
          }

          connection.sendDiagnostics({ uri, diagnostics: diagnosticsOrNone });
        });

      // -----------------------------------------------------------------
      // Public: publishForUri
      // -----------------------------------------------------------------

      const publishForUri = (uri: string): Effect.Effect<void> =>
        Effect.gen(function* () {
          const doc = documents.get(uri);
          if (!doc) {
            return;
          }
          yield* publishForUriAtVersion(uri, doc.version);
        });

      // -----------------------------------------------------------------
      // Debouncer management
      // -----------------------------------------------------------------

      type PublishFn = (version: number) => Promise<void>;
      const debouncers = new Map<string, AsyncDebouncer<PublishFn>>();

      const getDebouncer = (uri: string): AsyncDebouncer<PublishFn> => {
        const existing = debouncers.get(uri);
        if (existing) {
          return existing;
        }

        const clearSentinel = () =>
          connection.sendDiagnostics({ uri, diagnostics: [] });

        const d = new AsyncDebouncer<PublishFn>(
          async (version: number) => {
            // Bridge back into Effect runtime for the actual work
            await Effect.runPromise(
              publishForUriAtVersion(uri, version).pipe(
                Effect.catchAllDefect((defect) =>
                  Effect.gen(function* () {
                    yield* logger.error(
                      `[diagnostics] unexpected defect for ${uri}: ${String(defect)}`,
                    );
                    clearSentinel();
                  }),
                ),
              ),
            );
          },
          {
            wait: debounceWaitMs,
            throwOnError: false,
            onError: (error) => {
              connection.console.error(
                `[diagnostics] debounced publish failed for ${uri}: ${String(error)}`,
              );
              clearSentinel();
            },
          },
        );

        debouncers.set(uri, d);
        return d;
      };

      // -----------------------------------------------------------------
      // Public: publishForAllOpenDocuments
      // -----------------------------------------------------------------

      const publishForAllOpenDocuments = (): Effect.Effect<void> =>
        Effect.gen(function* () {
          const tasks = documents.all().map((doc) => publishForUri(doc.uri));
          yield* Effect.all(tasks, { concurrency: "unbounded", discard: true });
        });

      // -----------------------------------------------------------------
      // Wire document lifecycle events
      // -----------------------------------------------------------------

      // Push-based diagnostics: publish whenever content changes.
      documents.onDidChangeContent((change) => {
        const uri = change.document.uri;
        const version = change.document.version;
        const d = getDebouncer(uri);
        void d.maybeExecute(version);
      });

      // Cleanup when a document is closed.
      documents.onDidClose((e) => {
        // Let the settings manager know.
        Effect.runSync(settings.onDidCloseDocument(e.document.uri));
        lastReviewedText.delete(e.document.uri);

        const d = debouncers.get(e.document.uri);
        if (d) {
          d.cancel();
          d.abort();
          debouncers.delete(e.document.uri);
        }

        // Clear diagnostics for the closed document.
        connection.sendDiagnostics({
          uri: e.document.uri,
          diagnostics: [],
        });
      });

      // -----------------------------------------------------------------
      // Return service implementation
      // -----------------------------------------------------------------

      return {
        publishForUri,
        publishForAllOpenDocuments,
      };
    }),
  );
};
