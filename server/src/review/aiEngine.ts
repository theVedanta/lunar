import { createTwoFilesPatch } from "diff";

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
  ReviewRequestError,
  type ReviewDocumentParams,
} from "./types";
import { MCPClient } from "./mcpClient";
import { RULES } from "./rules";

function clampLine1Based(line: number, lineCount: number): number {
  const lc = Math.max(1, lineCount);
  return Math.min(Math.max(1, line), lc);
}

const severitySchema = z.union([
  z.literal(DiagnosticSeverity.Error),
  z.literal(DiagnosticSeverity.Warning),
  z.literal(DiagnosticSeverity.Information),
  z.literal(DiagnosticSeverity.Hint),
]);

export interface AIReviewEngineOptions {
  readonly model?: string;
  readonly maxIssues?: number;
  readonly apiKey?: string;
}

export class AIConfig extends Context.Tag("AIConfig")<
  AIConfig,
  {
    readonly model: string;
    readonly maxIssues: number;
    readonly apiKey: string | undefined;
  }
>() {}

export const AIReviewEngineLive: Layer.Layer<
  ReviewEngine,
  never,
  ReviewLogger | AIConfig | MCPClient
> = Layer.effect(
  ReviewEngine,
  Effect.gen(function* () {
    const logger = yield* ReviewLogger;
    const config = yield* AIConfig;
    const mcpClient = yield* MCPClient;

    const warnedMissingKeyRef = yield* Ref.make(false);

    let openAIProvider: ReturnType<typeof createOpenAI> | undefined;

    const reviewDocument = (
      params: ReviewDocumentParams,
    ): Effect.Effect<
      readonly ReviewIssue[],
      MissingApiKeyError | ReviewRequestError
    > =>
      Effect.gen(function* () {
        const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
        if (!apiKey) {
          const alreadyWarned = yield* Ref.get(warnedMissingKeyRef);
          if (!alreadyWarned) {
            yield* Ref.set(warnedMissingKeyRef, true);
            yield* logger.warn(
              "No API key found; set openAIApiKey in initializationOptions or the OPENAI_API_KEY env var",
            );
          }
          return yield* new MissingApiKeyError({ key: "OPENAI_API_KEY" });
        }

        openAIProvider ??= createOpenAI({ apiKey });

        const { uri } = params;
        const ruleIds = Array.from(
          new Set(RULES.rules.map((r) => r.id).filter(Boolean)),
        ) as [string, ...string[]];

        const modelIssueSchema = z
          .object({
            ruleId: z.enum(ruleIds),
            title: z.string().min(1).max(60).optional(),
            message: z.string().min(1).max(120),
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
            tags: z.array(z.string().min(1)).max(3).optional(),
          })
          .strict();

        const outputSchema = z
          .object({
            issues: z.array(modelIssueSchema).max(config.maxIssues),
          })
          .strict();

        const HEADER_LINES = 30;
        const lines = params.text.split(/\r\n|\r|\n/);
        const headerText = lines
          .slice(0, HEADER_LINES)
          .map((line, i) => `${String(i + 1).padStart(5)} | ${line}`)
          .join("\n");

        let fileSection: string;
        if (
          params.previousText !== undefined &&
          params.previousText !== params.text
        ) {
          const patch = createTwoFilesPatch(
            uri,
            uri,
            params.previousText,
            params.text,
            "previous",
            "current",
            { context: 5 },
          );
          fileSection =
            `File header (lines 1–${Math.min(HEADER_LINES, lines.length)}):\n` +
            "```\n" +
            `${headerText}\n` +
            "```\n" +
            "\n" +
            "Diff (unified, +added -removed, line numbers are current-file lines):\n" +
            "```diff\n" +
            `${patch}\n` +
            "```\n";
        } else {
          const numberedSource = lines
            .map((line, i) => `${String(i + 1).padStart(5)} | ${line}`)
            .join("\n");
          fileSection =
            "File listing (full, first review):\n" +
            "```\n" +
            `${numberedSource}\n` +
            "```\n";
        }

        const rulesForPrompt = JSON.stringify(RULES.rules, null, 2);
        const prompt =
          "You are a senior code reviewer. Return only the most critical issues.\n" +
          "\n" +
          `File URI: ${uri}\n` +
          "\n" +
          "Rules (use only these ruleId values):\n" +
          `${rulesForPrompt}\n` +
          "\n" +
          "Output rules — follow these strictly:\n" +
          `- Return at most ${config.maxIssues} issues. Fewer is better. Only flag serious problems.\n` +
          "- Skip style nits, minor naming suggestions, and anything a linter would catch.\n" +
          "- Only flag bugs, logic errors, security vulnerabilities, or significant maintainability problems.\n" +
          "- Each message must be a single concise sentence (max 120 chars). No multi-line text.\n" +
          "- Prefer severity 1 (Error) or 2 (Warning). Avoid 3/4 unless truly necessary.\n" +
          "- Set span to the exact offending lines only — do not span entire functions unless the whole function is the issue.\n" +
          "- Line numbers refer to the CURRENT file. In the diff, the +/- lines show what changed; use the @@ hunk headers to map to current line numbers.\n" +
          "- severity must be a number: 1=Error, 2=Warning, 3=Information, 4=Hint.\n" +
          "- If there are no serious issues, return an empty list.\n" +
          "- You may use MCP tools to read related files for additional context if needed.\n" +
          "\n" +
          `${fileSection}`;

        const tools = yield* Effect.tryPromise({
          try: () => mcpClient.tools(),
          catch: (err) => new ReviewRequestError({ uri, cause: err }),
        });

        const startedAt = Date.now();
        yield* logger.log(
          `request start uri=${uri} model=${config.model} (agentic mode)`,
        );

        const syncLog = (msg: string) => Effect.runSync(logger.log(msg));

        const res = yield* Effect.tryPromise({
          try: () =>
            generateText({
              model: openAIProvider!.chat(config.model),
              tools,
              output: Output.object({
                schema: outputSchema,
                name: "ReviewIssues",
                description:
                  "A list of serious code review issues for an editor diagnostics UI.",
              }),
              stopWhen: stepCountIs(2),
              system:
                "Return only valid JSON matching the schema. No markdown. Be terse.",
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

              onStepFinish: ({
                stepNumber,
                usage,
                finishReason,
                toolCalls,
                toolResults,
              }) => {
                const callSummary =
                  toolCalls.length > 0
                    ? toolCalls.map((tc) => tc.toolName).join(", ")
                    : "none";
                syncLog(
                  `[step ${stepNumber}] finish reason=${finishReason} tool_calls=[${callSummary}] tool_results=${toolResults.length} tokens_in=${usage.inputTokens} tokens_out=${usage.outputTokens}`,
                );
              },
            }),
          catch: (error) => {
            if (NoObjectGeneratedError.isInstance(error)) {
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

        const lineCount = Math.max(1, params.text.split(/\r\n|\r|\n/).length);

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

export const makeAIReviewEngineLayer = (
  options?: AIReviewEngineOptions,
): Layer.Layer<ReviewEngine, never, ReviewLogger | MCPClient> => {
  const configLayer = Layer.succeed(AIConfig, {
    model: options?.model ?? "gpt-4.1-mini",
    maxIssues: options?.maxIssues ?? 5,
    apiKey: options?.apiKey,
  });

  return AIReviewEngineLive.pipe(Layer.provide(configLayer));
};
