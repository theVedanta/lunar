import { Context, Data, Effect } from "effect";
import type { DiagnosticSeverity } from "vscode-languageserver/node";

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

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
  readonly startLine: number;
  /** 1-based, inclusive */
  readonly endLine: number;
}

/**
 * A single issue produced by the review engine for a specific document.
 *
 * Modelled as an Effect `Data.Class` so that instances are structurally
 * compared by value and integrate well with the rest of the Effect ecosystem.
 */
export class ReviewIssue extends Data.Class<{
  /** The document URI this issue applies to. */
  readonly uri: string;

  /** Stable rule identifier, e.g. "naming/no-uppercase-acronyms". */
  readonly ruleId: ReviewRuleId;

  /** Human-readable title or short name for the rule. */
  readonly title?: string | undefined;

  /** Human-readable message to show to the user. */
  readonly message: string;

  /** LSP diagnostic severity. */
  readonly severity: DiagnosticSeverity;

  /** Location for the issue. */
  readonly span: ReviewLineSpan;

  /** Optional category (style, correctness, performance, security, etc.). */
  readonly category?: string | undefined;

  /** Optional tag list for future filtering/grouping. */
  readonly tags?: readonly string[] | undefined;
}> {}

// ---------------------------------------------------------------------------
// Tagged errors
// ---------------------------------------------------------------------------

/** Raised when a required API key (e.g. OPENAI_API_KEY) is missing. */
export class MissingApiKeyError extends Data.TaggedError("MissingApiKeyError")<{
  readonly key: string;
}> {}

/** Raised when loading the rules file fails. */
export class RulesLoadError extends Data.TaggedError("RulesLoadError")<{
  readonly message: string;
  readonly candidates?: readonly string[] | undefined;
}> {}

/** Raised when the upstream AI/review provider returns an error. */
export class ReviewRequestError extends Data.TaggedError("ReviewRequestError")<{
  readonly uri: string;
  readonly cause: unknown;
}> {}

// ---------------------------------------------------------------------------
// Service interfaces (Context.Tag)
// ---------------------------------------------------------------------------

export interface ReviewDocumentParams {
  readonly uri: string;
  readonly text: string;
}

/**
 * The core review engine service.
 *
 * Implementations can be backed by a static stub, OpenAI, or any other
 * provider. Consumers access it via `yield* ReviewEngine`.
 *
 * The error channel is typed to the union of errors the engine may raise so
 * that callers can decide how to handle each case (or let them propagate).
 */
export class ReviewEngine extends Context.Tag("ReviewEngine")<
  ReviewEngine,
  {
    readonly reviewDocument: (
      params: ReviewDocumentParams,
    ) => Effect.Effect<
      readonly ReviewIssue[],
      MissingApiKeyError | RulesLoadError | ReviewRequestError
    >;
  }
>() {}

// ---------------------------------------------------------------------------
// Logger service
// ---------------------------------------------------------------------------

/**
 * A simple logger service used throughout the review subsystem.
 * This is intentionally kept separate from Effect's built-in logging so that
 * it can be wired directly to `connection.console.*` in the LSP host.
 */
export class ReviewLogger extends Context.Tag("ReviewLogger")<
  ReviewLogger,
  {
    readonly log: (message: string) => Effect.Effect<void>;
    readonly warn: (message: string) => Effect.Effect<void>;
    readonly error: (message: string) => Effect.Effect<void>;
  }
>() {}
