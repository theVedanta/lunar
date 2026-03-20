"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Info,
  X,
} from "lucide-react";

type IssueSeverity = "error" | "warning" | "info";

interface Issue {
  id: string;
  line: number;
  severity: IssueSeverity;
  title: string;
  message: string;
  code: string;
  hint?: string;
}

const codeLines = [
  { num: 1, content: "type RequestContext = {", indent: 0 },
  {
    num: 2,
    content:
      "  request: { query: { accountId: string; invoiceId: string }; headers: Record<string, string> }",
    indent: 0,
  },
  {
    num: 3,
    content: "  session: { account: { id: string }; user: { id: string } }",
    indent: 0,
  },
  { num: 4, content: "}", indent: 0 },
  { num: 5, content: "", indent: 0 },
  {
    num: 6,
    content: "export async function loadInvoice(ctx: RequestContext) {",
    indent: 0,
  },
  { num: 7, content: "  const { request, session } = ctx", indent: 0 },
  { num: 8, content: "  const accountId = session.account.id", indent: 0 },
  { num: 9, content: "  const accountID = request.query.accountId", indent: 0 },
  {
    num: 10,
    content: "  const invoiceId = request.query.invoiceId",
    indent: 0,
  },
  {
    num: 11,
    content:
      '  const endpoint = process.env.INTERNAL_API + "/v1/accounts/" + accountID + "/invoices/" + invoiceId',
    indent: 0,
  },
  {
    num: 12,
    content:
      "  const auditUrl = `https://${request.headers.host}/audit?next=${endpoint}`",
    indent: 0,
  },
  { num: 13, content: "", indent: 0 },
  { num: 14, content: "  if (accountId !== accountID) {", indent: 0 },
  {
    num: 15,
    content: '    console.warn("account mismatch", { accountId, accountID })',
    indent: 0,
  },
  { num: 16, content: "  }", indent: 0 },
  { num: 17, content: "", indent: 0 },
  {
    num: 18,
    content:
      '  const response = await fetch(endpoint, { headers: { "x-actor-id": session.user.id } })',
    indent: 0,
  },
  { num: 19, content: "  const invoice = await response.json()", indent: 0 },
  {
    num: 20,
    content:
      "  if (invoice.accountId === accountID) return { ok: true, invoice, auditUrl }",
    indent: 0,
  },
  {
    num: 21,
    content: '  return { ok: false, reason: "invoice_account_mismatch" }',
    indent: 0,
  },
  { num: 22, content: "", indent: 0 },
  {
    num: 23,
    content: "  trackAuditEvent({",
    indent: 0,
  },
  {
    num: 24,
    content: "    actorId: session.user.id,",
    indent: 0,
  },
  {
    num: 25,
    content: '    action: "invoice.load",',
    indent: 0,
  },
  {
    num: 26,
    content: "    timestamp: session.timestamp,",
    indent: 0,
  },
  {
    num: 27,
    content: "  })",
    indent: 0,
  },
  { num: 28, content: "}", indent: 0 },
];

const issues: Issue[] = [
  {
    id: "logic-auth-id-drift",
    line: 20,
    severity: "error",
    title: "Authorization check uses untrusted identifier",
    message:
      "Comparison uses `accountID` from query params instead of authenticated `accountId`. A crafted request can pass checks for the wrong tenant.",
    code: "review/auth-context-drift",
    hint: "Compare `invoice.accountId` against `accountId` from session context.",
  },
  {
    id: "security-path-concat",
    line: 11,
    severity: "error",
    title: "Sensitive URL built via raw concatenation",
    message:
      "IDs are injected directly into an internal API path. Unencoded delimiters or crafted values can alter request semantics and target unintended resources.",
    code: "review/url-construction-risk",
    hint: "Use URL/URLSearchParams and encode path segments explicitly.",
  },
  {
    id: "security-host-header-trust",
    line: 12,
    severity: "warning",
    title: "Host header trusted for security-sensitive URL",
    message:
      "Using `request.headers.host` to construct `auditUrl` can enable open-redirect style abuse if host is spoofable through proxies/misconfigurations.",
    code: "review/untrusted-host-usage",
    hint: "Derive origin from trusted config, not request headers.",
  },
  {
    id: "logic-mismatch-handling",
    line: 14,
    severity: "warning",
    title: "Mismatch detected but execution still proceeds",
    message:
      "Code logs account mismatch and continues to fetch and return data. This weakens the intended tenant boundary check.",
    code: "review/incomplete-guard",
    hint: "Fail fast on mismatch before network calls.",
  },
  {
    id: "resilience-response-guard",
    line: 19,
    severity: "info",
    title: "JSON parse without status guard",
    message:
      "The response body is parsed before checking `response.ok`. Error pages or partial failures can lead to misleading downstream logic.",
    code: "review/response-contract",
    hint: "Validate `ok` and payload shape before using invoice data.",
  },
];

const severityConfig = {
  error: {
    icon: AlertCircle,
    bgClass: "bg-destructive/10",
    borderClass: "border-l-destructive",
    textClass: "text-destructive",
    badgeClass: "bg-destructive/15 text-destructive border-destructive/30",
    label: "Error",
  },
  warning: {
    icon: AlertTriangle,
    bgClass: "bg-warning/10",
    borderClass: "border-l-warning",
    textClass: "text-warning",
    badgeClass: "bg-warning/15 text-warning border-warning/30",
    label: "Warning",
  },
  info: {
    icon: Info,
    bgClass: "bg-info/10",
    borderClass: "border-l-info",
    textClass: "text-info",
    badgeClass: "bg-info/15 text-info border-info/30",
    label: "Info",
  },
};

export function CodeEditorPreview() {
  const [visibleIssues, setVisibleIssues] = useState<Issue[]>([]);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    issues.forEach((issue, index) => {
      const timer = setTimeout(
        () => {
          setVisibleIssues((prev) => [...prev, issue]);
        },
        500 + index * 420,
      );
      timers.push(timer);
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  const errorCount = useMemo(
    () => visibleIssues.filter((i) => i.severity === "error").length,
    [visibleIssues],
  );
  const warningCount = useMemo(
    () => visibleIssues.filter((i) => i.severity === "warning").length,
    [visibleIssues],
  );
  const infoCount = useMemo(
    () => visibleIssues.filter((i) => i.severity === "info").length,
    [visibleIssues],
  );

  const getLineIssues = (lineNum: number) =>
    visibleIssues.filter((issue) => issue.line === lineNum);

  const getHighestSeverity = (lineIssues: Issue[]): IssueSeverity | null => {
    if (lineIssues.some((i) => i.severity === "error")) {
      return "error";
    }
    if (lineIssues.some((i) => i.severity === "warning")) {
      return "warning";
    }
    if (lineIssues.some((i) => i.severity === "info")) {
      return "info";
    }
    return null;
  };

  return (
    <div className="mx-auto mb-20 w-full max-w-5xl">
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/20">
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-destructive/70" />
              <div className="h-3 w-3 rounded-full bg-warning/70" />
              <div className="h-3 w-3 rounded-full bg-success/70" />
            </div>
            <span className="ml-2 font-mono text-xs text-zinc-400">
              billing/handlers/loadInvoice.ts
            </span>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-300">
              TypeScript
            </span>
            <span className="rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[11px] text-violet-300">
              semantic diagnostics
            </span>
          </div>
        </div>

        <div className="relative max-h-[460px] overflow-auto bg-zinc-900">
          <div className="font-mono text-[12px] leading-3.5 md:text-[11px]">
            {codeLines.map((line) => {
              const lineIssues = getLineIssues(line.num);
              const severity = getHighestSeverity(lineIssues);
              const config = severity ? severityConfig[severity] : null;
              const isHovered = hoveredLine === line.num;

              return (
                <div
                  key={line.num}
                  className={`group relative flex ${config?.bgClass ?? ""} transition-colors`}
                  onMouseEnter={() =>
                    lineIssues.length > 0 && setHoveredLine(line.num)
                  }
                  onMouseLeave={() => setHoveredLine(null)}
                >
                  <div className="flex w-14 shrink-0 select-none items-center justify-end border-r border-zinc-800 bg-zinc-950/70 pr-3 text-right text-[11px] text-zinc-500">
                    {line.num}
                  </div>

                  <div className="flex w-7 shrink-0 items-center justify-center">
                    {config && (
                      <config.icon
                        className={`h-3.5 w-3.5 ${config.textClass} animate-in fade-in`}
                      />
                    )}
                  </div>

                  <div className="flex-1 py-0.5 pr-4">
                    <pre className="whitespace-pre">
                      <code
                        className={
                          severity
                            ? `border-l-2 ${config?.borderClass} pl-2`
                            : "pl-3"
                        }
                      >
                        {highlightSyntax(line.content)}
                      </code>
                    </pre>
                  </div>

                  {isHovered && lineIssues.length > 0 && (
                    <div className="absolute left-20 top-full z-20 mt-1 w-[min(30rem,calc(100vw-4rem))] animate-in fade-in slide-in-from-top-1">
                      <div className="overflow-hidden rounded-md border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/30">
                        {lineIssues.map((issue) => {
                          const issueConfig = severityConfig[issue.severity];
                          return (
                            <div
                              key={issue.id}
                              className={`border-b border-border p-3 last:border-b-0 ${issueConfig.bgClass}`}
                            >
                              <div className="mb-1 flex items-center gap-2">
                                <span
                                  className={`rounded border px-1.5 py-0.5 text-[11px] ${issueConfig.badgeClass}`}
                                >
                                  {issueConfig.label}
                                </span>
                                <span className="text-sm font-medium text-zinc-100">
                                  {issue.title}
                                </span>
                              </div>
                              <p className="text-sm text-zinc-200">
                                {issue.message}
                              </p>
                              <p className="mt-1 font-mono text-xs text-zinc-400">
                                {issue.code}
                              </p>
                              {issue.hint ? (
                                <p className="mt-2 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                                  Suggested direction: {issue.hint}
                                </p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-zinc-800 bg-zinc-900/95">
          <button
            onClick={() => setIsPanelOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800/80"
          >
            <div className="flex items-center gap-4">
              {isPanelOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span className="font-medium">Problems</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-3 w-3" /> {errorCount}
                </span>
                <span className="flex items-center gap-1 text-warning">
                  <AlertTriangle className="h-3 w-3" /> {warningCount}
                </span>
                <span className="flex items-center gap-1 text-info">
                  <Info className="h-3 w-3" /> {infoCount}
                </span>
              </div>
            </div>
            <X className="h-4 w-4 text-zinc-500" />
          </button>

          {isPanelOpen && visibleIssues.length > 0 && (
            <div className="max-h-44 overflow-auto border-t border-zinc-800">
              {visibleIssues.map((issue) => {
                const config = severityConfig[issue.severity];
                return (
                  <div
                    key={issue.id}
                    className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm hover:bg-zinc-800/80"
                  >
                    <config.icon
                      className={`h-4 w-4 shrink-0 ${config.textClass}`}
                    />
                    <span className="line-clamp-1 flex-1 text-zinc-100">
                      {issue.title}
                    </span>
                    <span className="font-mono text-xs text-zinc-400">
                      [lunar] loadInvoice.ts:{issue.line}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function highlightSyntax(code: string) {
  if (!code) {
    return <span>&nbsp;</span>;
  }

  const tokens = tokenizeCode(code);

  return tokens.map((token, index) => {
    if (/^\s+$/.test(token.value)) {
      return <span key={index}>{token.value}</span>;
    }

    switch (token.type) {
      case "keyword":
        return (
          <span key={index} className="text-fuchsia-300">
            {token.value}
          </span>
        );
      case "type":
        return (
          <span key={index} className="text-sky-300">
            {token.value}
          </span>
        );
      case "builtin":
        return (
          <span key={index} className="text-sky-300">
            {token.value}
          </span>
        );
      case "string":
        return (
          <span key={index} className="text-emerald-300">
            {token.value}
          </span>
        );
      case "number":
        return (
          <span key={index} className="text-violet-300">
            {token.value}
          </span>
        );
      case "property":
        return (
          <span key={index} className="text-blue-300">
            {token.value}
          </span>
        );
      case "identifier":
        if (IDENTIFIER_HIGHLIGHTS.has(token.value)) {
          return (
            <span key={index} className="text-amber-200">
              {token.value}
            </span>
          );
        }
        return (
          <span key={index} className="text-zinc-50">
            {token.value}
          </span>
        );
      case "operator":
        return (
          <span key={index} className="text-zinc-300">
            {token.value}
          </span>
        );
      case "punctuation":
        return (
          <span key={index} className="text-zinc-500">
            {token.value}
          </span>
        );
      default:
        return <span key={index}>{token.value}</span>;
    }
  });
}

type TokenType =
  | "keyword"
  | "type"
  | "builtin"
  | "string"
  | "number"
  | "property"
  | "identifier"
  | "operator"
  | "punctuation"
  | "whitespace";

interface Token {
  type: TokenType;
  value: string;
}

const KEYWORDS = new Set([
  "type",
  "export",
  "async",
  "function",
  "const",
  "if",
  "return",
  "await",
  "true",
  "false",
]);

const TYPES = new Set(["RequestContext", "Record", "string"]);
const BUILTINS = new Set(["fetch", "console", "warn", "process"]);
const IDENTIFIER_HIGHLIGHTS = new Set([
  "accountId",
  "accountID",
  "invoiceId",
  "endpoint",
  "auditUrl",
  "request",
  "session",
  "response",
  "invoice",
  "ctx",
  "trackAuditEvent",
]);
const OPERATORS = new Set(["=", "+", "!==", "===", "&&", "||", "!", "?", ":"]);
const PUNCTUATION = new Set([
  "{",
  "}",
  "(",
  ")",
  "[",
  "]",
  ".",
  ",",
  ";",
  "<",
  ">",
]);

function tokenizeCode(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < code.length) {
    const current = code[i];

    if (/\s/.test(current)) {
      let value = current;
      i += 1;
      while (i < code.length && /\s/.test(code[i])) {
        value += code[i];
        i += 1;
      }
      tokens.push({ type: "whitespace", value });
      continue;
    }

    if (current === '"' || current === "'" || current === "`") {
      const { value, nextIndex } = readString(code, i);
      tokens.push({ type: "string", value });
      i = nextIndex;
      continue;
    }

    const threeChar = code.slice(i, i + 3);
    const twoChar = code.slice(i, i + 2);

    if (OPERATORS.has(threeChar)) {
      tokens.push({ type: "operator", value: threeChar });
      i += 3;
      continue;
    }

    if (OPERATORS.has(twoChar)) {
      tokens.push({ type: "operator", value: twoChar });
      i += 2;
      continue;
    }

    if (OPERATORS.has(current)) {
      tokens.push({ type: "operator", value: current });
      i += 1;
      continue;
    }

    if (PUNCTUATION.has(current)) {
      tokens.push({ type: "punctuation", value: current });
      i += 1;
      continue;
    }

    if (/[0-9]/.test(current)) {
      let value = current;
      i += 1;
      while (i < code.length && /[0-9]/.test(code[i])) {
        value += code[i];
        i += 1;
      }
      tokens.push({ type: "number", value });
      continue;
    }

    if (/[A-Za-z_$]/.test(current)) {
      let value = current;
      i += 1;
      while (i < code.length && /[A-Za-z0-9_$]/.test(code[i])) {
        value += code[i];
        i += 1;
      }

      const previousNonWhitespace = findPreviousNonWhitespaceToken(tokens);

      if (KEYWORDS.has(value)) {
        tokens.push({ type: "keyword", value });
        continue;
      }

      if (TYPES.has(value)) {
        tokens.push({ type: "type", value });
        continue;
      }

      if (BUILTINS.has(value)) {
        tokens.push({ type: "builtin", value });
        continue;
      }

      if (previousNonWhitespace?.value === ".") {
        tokens.push({ type: "property", value });
        continue;
      }

      tokens.push({ type: "identifier", value });
      continue;
    }

    tokens.push({ type: "punctuation", value: current });
    i += 1;
  }

  return tokens;
}

function readString(code: string, startIndex: number) {
  const quote = code[startIndex];
  let value = quote;
  let i = startIndex + 1;

  while (i < code.length) {
    const current = code[i];
    value += current;

    if (current === "\\" && i + 1 < code.length) {
      i += 1;
      value += code[i];
    } else if (current === quote) {
      i += 1;
      break;
    }

    i += 1;
  }

  return { value, nextIndex: i };
}

function findPreviousNonWhitespaceToken(tokens: Token[]) {
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    if (tokens[i].type !== "whitespace") {
      return tokens[i];
    }
  }

  return null;
}
