import { readFile } from "node:fs/promises";
import * as path from "node:path";

import { Context, Effect, Layer, Ref } from "effect";
import { generateText, NoObjectGeneratedError, Output, stepCountIs } from "ai";
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
import { MCPClient } from "./mcpClient";

// ---------------------------------------------------------------------------
// Rules file types & helpers
// ---------------------------------------------------------------------------

interface RulesFile {
  version: number;
  rules: { id: string; name: string; description?: string }[];
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
 * Constructs a `ReviewEngine` layer backed by OpenAI in agentic mode.
 *
 * The model uses MCP filesystem tools to read files during review, then
 * produces structured ReviewIssues via Output.object().
 *
 * Dependencies: `ReviewLogger`, `OpenAIConfig`, `MCPClient`
 */
export const OpenAIReviewEngineLive: Layer.Layer<
  ReviewEngine,
  never,
  ReviewLogger | OpenAIConfig | MCPClient
> = Layer.effect(
  ReviewEngine,
  Effect.gen(function* () {
    const logger = yield* ReviewLogger;
    const config = yield* OpenAIConfig;
    const mcpClient = yield* MCPClient;

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

        const { uri } = params;

        // Convert file:// URI to filesystem path for the MCP tool
        const filePath = uri.startsWith("file://")
          ? decodeURIComponent(uri.slice("file://".length))
          : uri;

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
          "You are an AI code reviewer with access to filesystem tools.\n" +
          "\n" +
          "Your task:\n" +
          `1. Use the read_file tool to read the file at path: ${filePath}\n` +
          "2. Optionally use list_directory, read_multiple_files, or search_files to read related files for additional context.\n" +
          "3. Return review issues as structured JSON.\n" +
          "\n" +
          "Constraints:\n" +
          `- Only use ruleId values from the provided rules list.\n` +
          "- Use 1-based line numbers (inclusive) for span.startLine and span.endLine.\n" +
          "- severity must be a number: 1=Error, 2=Warning, 3=Information, 4=Hint.\n" +
          `- Return at most ${config.maxIssues} issues. If there are no notable review issues, return an empty list.\n` +
          "- Focus on higher-level code review feedback (clarity, maintainability, safety), not trivial formatting or basic syntax.\n" +
          "\n" +
          "Allowed rules (id + name + description):\n" +
          `${rulesForPrompt}\n` +
          "\n" +
          "File URI:\n" +
          `${uri}\n`;

        // --- Fetch MCP tools ---
        const tools = yield* Effect.tryPromise({
          try: () => mcpClient.tools(),
          catch: (err) => new ReviewRequestError({ uri, cause: err }),
        });

        // --- Call OpenAI in agentic mode ---
        const startedAt = Date.now();
        yield* logger.log(
          `request start uri=${uri} model=${config.model} (agentic mode)`,
        );

        // Capture logger for use inside sync callbacks
        const syncLog = (msg: string) =>
          Effect.runSync(logger.log(msg));

        const res = yield* Effect.tryPromise({
          try: () =>
            generateText({
              model: openAIProvider!.chat(config.model),
              tools,
              output: Output.object({
                schema: outputSchema,
                name: "ReviewIssues",
                description:
                  "A list of code review issues for an editor diagnostics UI.",
              }),
              // 4 tool call steps + 1 structured output step
              stopWhen: stepCountIs(5),
              system:
                "Return only valid JSON that matches the schema. Do not include markdown.",
              prompt,

              experimental_onStepStart: ({ stepNumber, tools: stepTools }) => {
                const toolNames = stepTools
                  ? Object.keys(stepTools).join(", ")
                  : "none";
                syncLog(
                  `[step ${stepNumber}] start tools_available=[${toolNames}]`,
                );
              },

              experimental_onToolCallStart: ({ stepNumber, toolCall }) => {
                const args = JSON.stringify(toolCall.input);
                const preview =
                  args.length > 200 ? args.slice(0, 200) + "\u2026" : args;
                syncLog(
                  `[step ${stepNumber ?? "?"}] tool_call tool=${toolCall.toolName} args=${preview}`,
                );
              },

              experimental_onToolCallFinish: (event) => {
                if (event.success) {
                  const out = JSON.stringify(event.output);
                  const preview =
                    out.length > 200 ? out.slice(0, 200) + "\u2026" : out;
                  syncLog(
                    `[step ${event.stepNumber ?? "?"}] tool_result tool=${event.toolCall.toolName} ms=${event.durationMs} result=${preview}`,
                  );
                } else {
                  syncLog(
                    `[step ${event.stepNumber ?? "?"}] tool_error tool=${event.toolCall.toolName} ms=${event.durationMs} error=${String(event.error)}`,
                  );
                }
              },

              onStepFinish: ({ stepNumber, usage, finishReason, toolCalls, toolResults }) => {
                const callSummary = toolCalls.length > 0
                  ? toolCalls.map((tc) => tc.toolName).join(", ")
                  : "none";
                syncLog(
                  `[step ${stepNumber}] finish reason=${finishReason} tool_calls=[${callSummary}] tool_results=${toolResults.length} tokens_in=${usage.inputTokens} tokens_out=${usage.outputTokens}`,
                );
              },
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

        // --- Determine line count from params.text for clamping ---
        const lineCount = Math.max(
          1,
          params.text.split(/\r\n|\r|\n/).length,
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
 * `ReviewLogger` and `MCPClient` in its environment.
 *
 * This is the main entry point for callers that just want a working
 * OpenAI-backed engine without manually wiring up `OpenAIConfig`.
 */
export const makeOpenAIReviewEngineLayer = (
  options?: OpenAIReviewEngineOptions,
): Layer.Layer<ReviewEngine, never, ReviewLogger | MCPClient> => {
  const configLayer = Layer.succeed(OpenAIConfig, {
    model: options?.model ?? "gpt-5.2",
    maxIssues: options?.maxIssues ?? 20,
  });

  return OpenAIReviewEngineLive.pipe(Layer.provide(configLayer));
};
