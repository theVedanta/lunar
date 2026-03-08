import { readFile } from "node:fs/promises";
import * as path from "node:path";

import { Context, Effect, Layer, Ref } from "effect";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { DiagnosticSeverity } from "vscode-languageserver/node";

import {
  ReviewEngine,
  ReviewIssue,
  ReviewLogger,
  MissingApiKeyError,
  RulesLoadError,
  ReviewRequestError,
  type ReviewDocumentParams,
} from "./types";

// ---------------------------------------------------------------------------
// Rules file types & helpers
// ---------------------------------------------------------------------------

interface RulesFile {
  version: number;
  rules: { id: string; name: string; description?: string }[];
}

function computeLineCount(text: string): number {
  return text.length === 0 ? 1 : text.split(/\r\n|\r|\n/).length;
}

function clampLine1Based(line: number, lineCount: number): number {
  const lc = Math.max(1, lineCount);
  return Math.min(Math.max(1, line), lc);
}

// ---------------------------------------------------------------------------
// Zod schemas (reused across calls)
// ---------------------------------------------------------------------------

const severitySchema = z.union([
  z.literal(DiagnosticSeverity.Error),
  z.literal(DiagnosticSeverity.Warning),
  z.literal(DiagnosticSeverity.Information),
  z.literal(DiagnosticSeverity.Hint),
]);

const rulesSchema = z
  .object({
    version: z.number().int().positive(),
    rules: z
      .array(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          description: z.string().min(1).optional(),
        }),
      )
      .min(1),
  })
  .strict();

// ---------------------------------------------------------------------------
// Internal cached-rules state
// ---------------------------------------------------------------------------

interface RulesCache {
  readonly value: RulesFile;
  readonly loadedAtMs: number;
  readonly source: string;
}

// ---------------------------------------------------------------------------
// loadRulesFile as an Effect
// ---------------------------------------------------------------------------

const loadRulesFile = (
  logger: Context.Tag.Service<typeof ReviewLogger>,
  cacheRef: Ref.Ref<RulesCache | null>,
): Effect.Effect<RulesFile, RulesLoadError> =>
  Effect.gen(function* () {
    const now = Date.now();
    const cached = yield* Ref.get(cacheRef);

    // Return cached value if fresh (< 2 seconds old)
    if (cached !== null && now - cached.loadedAtMs < 2000) {
      return cached.value;
    }

    const candidates = [
      path.join(__dirname, "rules.json"),
      path.resolve(__dirname, "../../src/review/rules.json"),
      path.resolve(process.cwd(), "server/src/review/rules.json"),
    ];

    // Try each candidate path
    for (const p of candidates) {
      const attempt = yield* Effect.tryPromise({
        try: async () => {
          const raw = await readFile(p, "utf8");
          return rulesSchema.parse(JSON.parse(raw) as unknown);
        },
        catch: (err) =>
          new RulesLoadError({
            message: `Failed to load ${p}: ${String(err)}`,
          }),
      }).pipe(
        // Swallow the error — convert to null so we can try the next candidate
        Effect.catchAll(() => Effect.succeed(null as RulesFile | null)),
      );

      if (attempt !== null) {
        const newCache: RulesCache = {
          value: attempt,
          loadedAtMs: now,
          source: p,
        };
        yield* Ref.set(cacheRef, newCache);
        return attempt;
      }
    }

    yield* logger.error(
      `failed to load rules.json from any candidate path: ${candidates.join(", ")}`,
    );
    yield* Ref.set(cacheRef, null);
    return yield* new RulesLoadError({
      message: "No rules.json found",
      candidates,
    });
  });

// ---------------------------------------------------------------------------
// OpenAI review engine options
// ---------------------------------------------------------------------------

export interface OpenAIReviewEngineOptions {
  readonly model?: string;
  readonly maxIssues?: number;
}

// ---------------------------------------------------------------------------
// OpenAIConfig service (small config tag)
// ---------------------------------------------------------------------------

export class OpenAIConfig extends Context.Tag("OpenAIConfig")<
  OpenAIConfig,
  {
    readonly model: string;
    readonly maxIssues: number;
  }
>() {}

// ---------------------------------------------------------------------------
// Layer: OpenAIReviewEngineLive
// ---------------------------------------------------------------------------

/**
 * Constructs a `ReviewEngine` layer backed by OpenAI.
 *
 * Dependencies: `ReviewLogger`, `OpenAIConfig`
 */
export const OpenAIReviewEngineLive: Layer.Layer<
  ReviewEngine,
  never,
  ReviewLogger | OpenAIConfig
> = Layer.effect(
  ReviewEngine,
  Effect.gen(function* () {
    const logger = yield* ReviewLogger;
    const config = yield* OpenAIConfig;

    // Mutable state managed via Effect Refs
    const rulesCacheRef = yield* Ref.make<RulesCache | null>(null);
    const warnedMissingKeyRef = yield* Ref.make(false);
    const loggedRulesSourceRef = yield* Ref.make<string | undefined>(undefined);

    // Lazily created OpenAI provider (kept in a closure)
    let openAIProvider: ReturnType<typeof createOpenAI> | undefined;

    const reviewDocument = (
      params: ReviewDocumentParams,
    ): Effect.Effect<
      readonly ReviewIssue[],
      MissingApiKeyError | RulesLoadError | ReviewRequestError
    > =>
      Effect.gen(function* () {
        // --- API key check ---
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          const alreadyWarned = yield* Ref.get(warnedMissingKeyRef);
          if (!alreadyWarned) {
            yield* Ref.set(warnedMissingKeyRef, true);
            yield* logger.warn(
              "OPENAI_API_KEY is not set; returning no issues",
            );
          }
          return yield* new MissingApiKeyError({ key: "OPENAI_API_KEY" });
        }

        openAIProvider ??= createOpenAI({ apiKey });

        const { uri, text } = params;
        const lineCount = computeLineCount(text);

        // --- Load rules ---
        const rulesFile = yield* loadRulesFile(logger, rulesCacheRef);

        // Log the rules source once (or when it changes)
        const cachedNow = yield* Ref.get(rulesCacheRef);
        const prevSource = yield* Ref.get(loggedRulesSourceRef);
        if (cachedNow && cachedNow.source !== prevSource) {
          yield* Ref.set(loggedRulesSourceRef, cachedNow.source);
          yield* logger.log(
            `rules source=${cachedNow.source} rules=${rulesFile.rules.length}`,
          );
        }

        // --- Build schemas & prompt ---
        const ruleIds = Array.from(
          new Set(rulesFile.rules.map((r) => r.id).filter(Boolean)),
        ) as [string, ...string[]];

        const modelIssueSchema = z
          .object({
            ruleId: z.enum(ruleIds),
            title: z.string().min(1).optional(),
            message: z.string().min(1),
            severity: severitySchema,
            span: z
              .object({
                startLine: z.number().int().min(1),
                endLine: z.number().int().min(1),
              })
              .strict()
              .refine((s) => s.endLine >= s.startLine, {
                message: "endLine must be >= startLine",
              }),
            category: z.string().min(1).optional(),
            tags: z.array(z.string().min(1)).max(10).optional(),
          })
          .strict();

        const outputSchema = z
          .object({
            issues: z.array(modelIssueSchema).max(config.maxIssues),
          })
          .strict();

        const rulesForPrompt = JSON.stringify(rulesFile.rules, null, 2);
        const prompt =
          "You are an AI code reviewer. Review the following file content and return issues as structured JSON.\n" +
          "\n" +
          "Constraints:\n" +
          `- Only use ruleId values from the provided rules list.\n` +
          `- Use 1-based line numbers (inclusive) for span.startLine and span.endLine.\n` +
          `- The file has ${lineCount} line(s); do not reference lines outside 1..${lineCount}.\n` +
          "- severity must be a number: 1=Error, 2=Warning, 3=Information, 4=Hint.\n" +
          `- Return at most ${config.maxIssues} issues. If there are no notable review issues, return an empty list.\n` +
          "- Focus on higher-level code review feedback (clarity, maintainability, safety), not trivial formatting or basic syntax.\n" +
          "\n" +
          "Allowed rules (id + name + description):\n" +
          `${rulesForPrompt}\n` +
          "\n" +
          "File URI:\n" +
          `${uri}\n` +
          "\n" +
          "File content:\n" +
          "```\n" +
          text +
          "\n```\n";

        // --- Call OpenAI ---
        const startedAt = Date.now();
        yield* logger.log(
          `request start uri=${uri} lines=${lineCount} chars=${text.length}`,
        );

        const res = yield* Effect.tryPromise({
          try: () =>
            generateText({
              model: openAIProvider!.chat(config.model),
              output: Output.object({
                schema: outputSchema,
                name: "ReviewIssues",
                description:
                  "A list of code review issues for an editor diagnostics UI.",
              }),
              system:
                "Return only valid JSON that matches the schema. Do not include markdown.",
              prompt,
            }),
          catch: (error) => {
            if (NoObjectGeneratedError.isInstance(error)) {
              // Log extra diagnostics but still surface as ReviewRequestError
              Effect.runSync(logger.log("NoObjectGeneratedError"));
              Effect.runSync(logger.log(`Cause: ${error.cause}`));
              Effect.runSync(logger.log(`Text: ${error.text}`));
              Effect.runSync(logger.log(`Response: ${error.response}`));
              Effect.runSync(logger.log(`Usage: ${error.usage}`));
            }
            return new ReviewRequestError({ uri, cause: error });
          },
        });

        const object = outputSchema.parse(res.output);
        const issues = object.issues;

        yield* logger.log(
          `request done uri=${uri} issues=${issues.length} ms=${Date.now() - startedAt}`,
        );

        // --- Map to ReviewIssue instances ---
        const out: ReviewIssue[] = [];
        for (const issue of issues) {
          const startLine = clampLine1Based(issue.span.startLine, lineCount);
          const endLine = clampLine1Based(issue.span.endLine, lineCount);
          const normalizedStart = Math.min(startLine, endLine);
          const normalizedEnd = Math.max(startLine, endLine);

          out.push(
            new ReviewIssue({
              uri,
              ruleId: issue.ruleId,
              title: issue.title,
              message: issue.message,
              severity: issue.severity,
              span: { startLine: normalizedStart, endLine: normalizedEnd },
              category: issue.category,
              tags: issue.tags,
            }),
          );
        }

        return out;
      });

    return { reviewDocument };
  }),
);

// ---------------------------------------------------------------------------
// Convenience: build a fully-provided Layer from options
// ---------------------------------------------------------------------------

/**
 * Creates a self-contained `ReviewEngine` layer that requires only
 * `ReviewLogger` in its environment.
 *
 * This is the main entry point for callers that just want a working
 * OpenAI-backed engine without manually wiring up `OpenAIConfig`.
 */
export const makeOpenAIReviewEngineLayer = (
  options?: OpenAIReviewEngineOptions,
): Layer.Layer<ReviewEngine, never, ReviewLogger> => {
  const configLayer = Layer.succeed(OpenAIConfig, {
    model: options?.model ?? "gpt-4o-mini",
    maxIssues: options?.maxIssues ?? 20,
  });

  return OpenAIReviewEngineLive.pipe(Layer.provide(configLayer));
};
