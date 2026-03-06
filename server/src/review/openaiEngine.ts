import { readFile } from "node:fs/promises";
import * as path from "node:path";

import { generateText, NoObjectGeneratedError, Output } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { DiagnosticSeverity } from "vscode-languageserver/node";

import type { ReviewEngine, ReviewIssue } from "./types";

export interface ReviewLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

interface RulesFile {
  version: number;
  rules: { id: string; name: string; description?: string }[];
};

function computeLineCount(text: string): number {
  // Split in a way that counts the last line even if it ends with a newline.
  return text.length === 0 ? 1 : text.split(/\r\n|\r|\n/).length;
}

function clampLine1Based(line: number, lineCount: number): number {
  const lc = Math.max(1, lineCount);
  return Math.min(Math.max(1, line), lc);
}

async function loadRulesFile(logger: ReviewLogger): Promise<RulesFile | null> {
  const now = Date.now();
  if (cachedRules !== undefined) {
    if (cachedRules === null || now - cachedRules.loadedAtMs < 2000) {
      return cachedRules?.value ?? null;
    }
  }

  const candidates = [
    // If assets are copied next to compiled JS, this is the primary location.
    path.join(__dirname, "rules.json"),

    // In dev, when running from `server/out/review`, this points back to the TS source asset.
    path.resolve(__dirname, "../../src/review/rules.json"),

    // Fallback when running with repo cwd.
    path.resolve(process.cwd(), "server/src/review/rules.json"),
  ];

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

  for (const p of candidates) {
    try {
      const raw = await readFile(p, "utf8");
      const value = rulesSchema.parse(JSON.parse(raw) as unknown);
      cachedRules = { value, loadedAtMs: now, source: p };
      return value;
    } catch {
      // try next candidate
    }
  }

  logger.error(
    `failed to load rules.json from any candidate path: ${candidates.join(", ")}`,
  );
  cachedRules = null;
  return null;
}

let cachedRules:
  | {
      value: RulesFile;
      loadedAtMs: number;
      source: string;
    }
  | null
  | undefined;

let warnedMissingApiKey = false;
let loggedRulesSource: string | undefined;

const severitySchema = z.union([
  z.literal(DiagnosticSeverity.Error),
  z.literal(DiagnosticSeverity.Warning),
  z.literal(DiagnosticSeverity.Information),
  z.literal(DiagnosticSeverity.Hint),
]);

export interface OpenAIReviewEngineOptions {
  model?: string;
  maxIssues?: number;
  logger: ReviewLogger;
}

export function createOpenAIReviewEngine(
  options: OpenAIReviewEngineOptions,
): ReviewEngine {
  const { model = "gpt-4o-mini", maxIssues = 20, logger } = options;

  let openAIProvider: ReturnType<typeof createOpenAI> | undefined;

  return {
    async reviewDocument(params: {
      uri: string;
      text: string;
    }): Promise<ReviewIssue[]> {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        if (!warnedMissingApiKey) {
          warnedMissingApiKey = true;
          logger.warn(
            "OPENAI_API_KEY is not set; returning no issues",
          );
        }
        return [];
      }

      openAIProvider ??= createOpenAI({ apiKey });

      const { uri, text } = params;
      const lineCount = computeLineCount(text);
      const rulesFile = await loadRulesFile(logger);

      if (!rulesFile) {
        return [];
      }

      if (cachedRules && cachedRules.source !== loggedRulesSource) {
        loggedRulesSource = cachedRules.source;
        logger.log(
          `rules source=${cachedRules.source} rules=${rulesFile.rules.length}`,
        );
      }
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
          issues: z.array(modelIssueSchema).max(maxIssues),
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
        `- Return at most ${maxIssues} issues. If there are no notable review issues, return an empty list.\n` +
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

      const startedAt = Date.now();
      logger.log(
        `request start uri=${uri} lines=${lineCount} chars=${text.length}`,
      );

      try {
        const res = await generateText({
          model: openAIProvider.chat(model),
          output: Output.object({
            schema: outputSchema,
            name: "ReviewIssues",
            description:
              "A list of code review issues for an editor diagnostics UI.",
          }),
          system:
            "Return only valid JSON that matches the schema. Do not include markdown.",
          prompt,
        });

        const object = outputSchema.parse(res.output);

        const issues = object.issues;
        logger.log(
          `request done uri=${uri} issues=${issues.length} ms=${Date.now() - startedAt}`,
        );

        const out: ReviewIssue[] = [];

        for (const issue of issues) {
          const startLine = clampLine1Based(issue.span.startLine, lineCount);
          const endLine = clampLine1Based(issue.span.endLine, lineCount);
          const normalizedStart = Math.min(startLine, endLine);
          const normalizedEnd = Math.max(startLine, endLine);

          out.push({
            uri,
            ruleId: issue.ruleId,
            title: issue.title,
            message: issue.message,
            severity: issue.severity,
            span: { startLine: normalizedStart, endLine: normalizedEnd },
            category: issue.category,
            tags: issue.tags,
          });
        }

        return out;
      } catch (error) {
        logger.error(
          `request failed uri=${uri} error=${String(error)}`,
        );
          if (NoObjectGeneratedError.isInstance(error)) {
            logger.log('NoObjectGeneratedError');
            logger.log(`Cause: ${error.cause}`);
            logger.log(`Text: ${error.text}`);
            logger.log(`Response: ${error.response}`);
            logger.log(`Usage: ${error.usage}`);
          }
        return [];
      }
    },
  };
}
