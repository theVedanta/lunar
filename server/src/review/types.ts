import type { DiagnosticSeverity } from "vscode-languageserver/node";

/**
 * A stable identifier for a rule in your review engine.
 * Useful for grouping, suppressions, and telemetry later.
 */
export type ReviewRuleId = string;

/**
 * Minimal representation of a span in a document expressed in 1-based line numbers.
 * This aligns with how humans talk about "line 1..4" in code reviews, while we can
 * later convert to LSP's 0-based `Range`.
 */
export interface ReviewLineSpan {
  /** 1-based, inclusive */
  startLine: number;
  /** 1-based, inclusive */
  endLine: number;
}

/**
 * A single issue produced by the review engine for a specific document.
 *
 * Notes:
 * - We keep this independent from LSP `Diagnostic` so the engine can evolve
 *   (store more metadata, change output format, run outside an editor, etc.).
 * - We keep line-based spans for now because it's the simplest "review comment"
 *   model (line or paragraph). We can add character spans later.
 */
export interface ReviewIssue {
  /** The document URI this issue applies to. */
  uri: string;

  /** Stable rule identifier, e.g. "naming/no-uppercase-acronyms". */
  ruleId: ReviewRuleId;

  /** Human-readable title or short name for the rule. */
  title?: string;

  /** Human-readable message to show to the user. */
  message: string;

  /** LSP diagnostic severity. */
  severity: DiagnosticSeverity;

  /** Location for the issue. */
  span: ReviewLineSpan;

  /** Optional category (style, correctness, performance, security, etc.). */
  category?: string;

  /** Optional tag list for future filtering/grouping. */
  tags?: string[];
}

/**
 * Represents a "review engine" capable of analyzing a single document and emitting issues.
 * We'll later add project/workspace-level review as well.
 */
export interface ReviewEngine {
  reviewDocument(params: { uri: string; text: string }): Promise<ReviewIssue[]>;
}
