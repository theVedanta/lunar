import type { Diagnostic, Range } from "vscode-languageserver/node";
import type { TextDocument } from "vscode-languageserver-textdocument";

import { Effect } from "effect";

import { ReviewIssue } from "./types";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function clampLine(line0Based: number, lineCount: number): number {
  if (lineCount <= 0) {
    return 0;
  }
  return Math.min(Math.max(line0Based, 0), lineCount - 1);
}

/**
 * Builds an LSP `Range` that covers whole lines from `startLine`..`endLine` (1-based, inclusive).
 *
 * The resulting range starts at `{ line: startLine-1, character: 0 }` and ends at the start of
 * the line *after* `endLine` (character 0). This is a common way to represent "whole line(s)"
 * diagnostics in LSP.
 *
 * If `endLine` is the last line, the end range becomes `{ line: lineCount, character: 0 }`.
 */
export function rangeForWholeLines(
  textDocument: TextDocument,
  startLine1Based: number,
  endLine1Based: number,
): Range {
  const lineCount = textDocument.lineCount;

  const startLine0 = clampLine(startLine1Based - 1, lineCount);
  const endLine0 = clampLine(endLine1Based - 1, lineCount);

  const start = { line: startLine0, character: 0 };

  // End is exclusive: go to the start of the line after `endLine0` to cover whole lines.
  // It is valid for `end.line === lineCount` (one past the last line).
  const endLineExclusive = Math.min(endLine0 + 1, Math.max(lineCount, 1));
  const end = { line: endLineExclusive, character: 0 };

  return { start, end };
}

/**
 * Convert a single `ReviewIssue` into an LSP `Diagnostic`.
 *
 * This is a pure function — no side-effects, no service requirements.
 */
export function reviewIssueToDiagnostic(
  textDocument: TextDocument,
  issue: ReviewIssue,
): Diagnostic {
  return {
    severity: issue.severity,
    range: rangeForWholeLines(
      textDocument,
      issue.span.startLine,
      issue.span.endLine,
    ),
    message: issue.message,
    source: "lunar",
    code: issue.ruleId,
  };
}

/**
 * Convert multiple issues into LSP diagnostics for a given document.
 * If `maxDiagnostics` is provided, the output is truncated to that size.
 *
 * Pure function — no dependencies required.
 */
export function reviewIssuesToDiagnostics(
  textDocument: TextDocument,
  issues: readonly ReviewIssue[],
  maxDiagnostics?: number,
): Diagnostic[] {
  const out: Diagnostic[] = [];

  for (const issue of issues) {
    if (maxDiagnostics !== undefined && out.length >= maxDiagnostics) {
      break;
    }
    out.push(reviewIssueToDiagnostic(textDocument, issue));
  }

  return out;
}

// ---------------------------------------------------------------------------
// Effect-aware helpers
// ---------------------------------------------------------------------------

/**
 * Effect-wrapped variant of `reviewIssuesToDiagnostics`.
 *
 * Wraps the pure conversion in `Effect.sync` so it can be composed inside
 * generator-based Effect pipelines without breaking out of the effect world.
 */
export const reviewIssuesToDiagnosticsEffect = (
  textDocument: TextDocument,
  issues: readonly ReviewIssue[],
  maxDiagnostics?: number,
): Effect.Effect<Diagnostic[]> =>
  Effect.sync(() =>
    reviewIssuesToDiagnostics(textDocument, issues, maxDiagnostics),
  );
