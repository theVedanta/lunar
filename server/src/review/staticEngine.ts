import { Effect, Layer } from "effect";
import { DiagnosticSeverity } from "vscode-languageserver/node";

import { ReviewEngine, ReviewIssue } from "./types";

// ---------------------------------------------------------------------------
// Static review engine — Layer implementation
// ---------------------------------------------------------------------------

/**
 * Static review engine placeholder.
 *
 * This is intentionally dumb: it emits a couple of fixed issues so the rest of
 * the LSP pipeline can be exercised (conversion to Diagnostics, refresh, etc.).
 *
 * Assumptions:
 * - Line numbers are 1-based and inclusive.
 * - Issues are emitted for every document (for now).
 */
export const StaticReviewEngineLive: Layer.Layer<ReviewEngine> = Layer.succeed(
  ReviewEngine,
  {
    reviewDocument: (params) =>
      Effect.succeed([
        new ReviewIssue({
          uri: params.uri,
          ruleId: "static/line-1",
          title: "Static issue on line 1",
          message: "this is line 1",
          severity: DiagnosticSeverity.Error,
          span: { startLine: 1, endLine: 1 },
          category: "demo",
          tags: ["static"],
        }),
        new ReviewIssue({
          uri: params.uri,
          ruleId: "static/lines-3-4",
          title: "Static issue on lines 3-4",
          message: "these are 3 and 4",
          severity: DiagnosticSeverity.Warning,
          span: { startLine: 3, endLine: 4 },
          category: "demo",
          tags: ["static"],
        }),
      ]),
  },
);
