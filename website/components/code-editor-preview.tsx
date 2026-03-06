"use client"

import { useState, useEffect } from "react"
import { AlertCircle, AlertTriangle, Info, X, ChevronDown, ChevronRight } from "lucide-react"

type IssueSeverity = "error" | "warning" | "info"

interface Issue {
  line: number
  severity: IssueSeverity
  message: string
  code: string
}

const codeLines = [
  { num: 1, content: 'import { useState } from "react"', indent: 0 },
  { num: 2, content: "", indent: 0 },
  { num: 3, content: "export function UserProfile({ user }) {", indent: 0 },
  { num: 4, content: "  const [loading, setLoading] = useState(false)", indent: 0 },
  { num: 5, content: "  const [data, setData] = useState(null)", indent: 0 },
  { num: 6, content: "", indent: 0 },
  { num: 7, content: "  async function fetchData() {", indent: 0 },
  { num: 8, content: "    setLoading(true)", indent: 0 },
  { num: 9, content: '    const res = await fetch("/api/user/" + user.id)', indent: 0 },
  { num: 10, content: "    const json = await res.json()", indent: 0 },
  { num: 11, content: "    setData(json)", indent: 0 },
  { num: 12, content: "    setLoading(false)", indent: 0 },
  { num: 13, content: "  }", indent: 0 },
  { num: 14, content: "", indent: 0 },
  { num: 15, content: "  return (", indent: 0 },
  { num: 16, content: "    <div>", indent: 0 },
  { num: 17, content: "      {loading ? <p>Loading...</p> : <p>{data?.name}</p>}", indent: 0 },
  { num: 18, content: "    </div>", indent: 0 },
  { num: 19, content: "  )", indent: 0 },
  { num: 20, content: "}", indent: 0 },
]

const issues: Issue[] = [
  {
    line: 3,
    severity: "warning",
    message: "Props destructuring without type annotation. Consider adding TypeScript interface for better type safety.",
    code: "review/api-contract",
  },
  {
    line: 9,
    severity: "error",
    message: "User input directly concatenated into URL. Potential injection risk if user.id contains special characters.",
    code: "review/security-footgun",
  },
  {
    line: 7,
    severity: "warning",
    message: "Function fetchData is defined but never called. Missing useEffect to trigger data fetching.",
    code: "review/error-handling",
  },
  {
    line: 10,
    severity: "info",
    message: "Response status not checked before parsing JSON. Consider handling non-2xx responses.",
    code: "review/error-handling",
  },
]

const severityConfig = {
  error: {
    icon: AlertCircle,
    bgClass: "bg-destructive/10",
    borderClass: "border-l-destructive",
    textClass: "text-destructive",
    label: "Error",
  },
  warning: {
    icon: AlertTriangle,
    bgClass: "bg-warning/10",
    borderClass: "border-l-warning",
    textClass: "text-warning",
    label: "Warning",
  },
  info: {
    icon: Info,
    bgClass: "bg-info/10",
    borderClass: "border-l-info",
    textClass: "text-info",
    label: "Info",
  },
}

export function CodeEditorPreview() {
  const [visibleIssues, setVisibleIssues] = useState<Issue[]>([])
  const [hoveredLine, setHoveredLine] = useState<number | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(true)

  useEffect(() => {
    const timers: NodeJS.Timeout[] = []
    issues.forEach((issue, index) => {
      const timer = setTimeout(() => {
        setVisibleIssues((prev) => [...prev, issue])
      }, 800 + index * 600)
      timers.push(timer)
    })
    return () => timers.forEach(clearTimeout)
  }, [])

  const getLineIssues = (lineNum: number) => {
    return visibleIssues.filter((issue) => issue.line === lineNum)
  }

  const getHighestSeverity = (lineIssues: Issue[]): IssueSeverity | null => {
    if (lineIssues.some((i) => i.severity === "error")) return "error"
    if (lineIssues.some((i) => i.severity === "warning")) return "warning"
    if (lineIssues.some((i) => i.severity === "info")) return "info"
    return null
  }

  const errorCount = visibleIssues.filter((i) => i.severity === "error").length
  const warningCount = visibleIssues.filter((i) => i.severity === "warning").length
  const infoCount = visibleIssues.filter((i) => i.severity === "info").length

  return (
    <div className="mx-auto max-w-4xl">
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-2xl shadow-primary/5">
        {/* Editor title bar */}
        <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-destructive/60"></div>
              <div className="h-3 w-3 rounded-full bg-warning/60"></div>
              <div className="h-3 w-3 rounded-full bg-success/60"></div>
            </div>
            <span className="ml-2 font-mono text-xs text-muted-foreground">UserProfile.tsx</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded bg-secondary px-1.5 py-0.5">TypeScript React</span>
          </div>
        </div>

        {/* Code area */}
        <div className="relative max-h-[400px] overflow-auto bg-background">
          <div className="font-mono text-sm">
            {codeLines.map((line) => {
              const lineIssues = getLineIssues(line.num)
              const severity = getHighestSeverity(lineIssues)
              const config = severity ? severityConfig[severity] : null
              const isHovered = hoveredLine === line.num

              return (
                <div
                  key={line.num}
                  className={`group relative flex ${config?.bgClass || ""} transition-colors`}
                  onMouseEnter={() => lineIssues.length > 0 && setHoveredLine(line.num)}
                  onMouseLeave={() => setHoveredLine(null)}
                >
                  {/* Line number */}
                  <div className="flex w-12 shrink-0 select-none items-center justify-end border-r border-border bg-secondary/30 pr-3 text-right text-muted-foreground">
                    {line.num}
                  </div>

                  {/* Issue indicator */}
                  <div className="flex w-6 shrink-0 items-center justify-center">
                    {config && (
                      <config.icon className={`h-3.5 w-3.5 ${config.textClass} animate-in fade-in`} />
                    )}
                  </div>

                  {/* Code content */}
                  <div className="flex-1 py-0.5 pr-4">
                    <pre className="whitespace-pre">
                      <code className={severity ? `border-l-2 ${config?.borderClass} pl-2` : "pl-3"}>
                        {highlightSyntax(line.content)}
                      </code>
                    </pre>
                  </div>

                  {/* Hover tooltip */}
                  {isHovered && lineIssues.length > 0 && (
                    <div className="absolute left-16 top-full z-20 mt-1 w-80 animate-in fade-in slide-in-from-top-1">
                      <div className="rounded-md border border-border bg-popover p-0 shadow-lg">
                        {lineIssues.map((issue, idx) => {
                          const issueConfig = severityConfig[issue.severity]
                          return (
                            <div
                              key={idx}
                              className={`flex items-start gap-2 border-b border-border p-3 last:border-b-0 ${issueConfig.bgClass}`}
                            >
                              <issueConfig.icon className={`mt-0.5 h-4 w-4 shrink-0 ${issueConfig.textClass}`} />
                              <div className="flex-1">
                                <p className="text-sm text-foreground">{issue.message}</p>
                                <p className="mt-1 font-mono text-xs text-muted-foreground">{issue.code}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Problems panel */}
        <div className="border-t border-border bg-secondary/30">
          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className="flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-secondary/50"
          >
            <div className="flex items-center gap-4">
              {isPanelOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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
            <X className="h-4 w-4 text-muted-foreground" />
          </button>

          {isPanelOpen && visibleIssues.length > 0 && (
            <div className="max-h-40 overflow-auto border-t border-border">
              {visibleIssues.map((issue, idx) => {
                const config = severityConfig[issue.severity]
                return (
                  <div
                    key={idx}
                    className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm hover:bg-secondary/50"
                  >
                    <config.icon className={`h-4 w-4 shrink-0 ${config.textClass}`} />
                    <span className="flex-1 truncate text-foreground">{issue.message}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      [lunar] UserProfile.tsx:{issue.line}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function highlightSyntax(code: string) {
  if (!code) return <span>&nbsp;</span>

  const keywords = ["import", "export", "function", "const", "return", "async", "await", "from"]
  const types = ["useState", "null", "false", "true"]

  const parts = code.split(/(\s+|[{}()<>.,;:=+\-*/"|'])/g)

  return parts.map((part, i) => {
    if (keywords.includes(part)) {
      return (
        <span key={i} className="text-pink-400">
          {part}
        </span>
      )
    }
    if (types.includes(part)) {
      return (
        <span key={i} className="text-cyan-400">
          {part}
        </span>
      )
    }
    if (part.startsWith('"') || part.startsWith("'")) {
      return (
        <span key={i} className="text-green-400">
          {part}
        </span>
      )
    }
    if (part === "user" || part === "data" || part === "loading" || part === "json" || part === "res") {
      return (
        <span key={i} className="text-orange-300">
          {part}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}
