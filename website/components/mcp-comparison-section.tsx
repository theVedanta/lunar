import { CheckCircle2, GitPullRequest, MessagesSquare, TimerReset, Workflow } from "lucide-react";

const comparisonRows = [
  {
    icon: Workflow,
    category: "How review starts",
    lunar: "Push-based. Review runs automatically when you open or edit a file.",
    mcp: "Pull-based. You usually invoke a review tool or ask an agent for feedback.",
  },
  {
    icon: MessagesSquare,
    category: "Where feedback shows up",
    lunar: "Inside the editor as standard LSP diagnostics — inline, line-specific, and in the Problems panel.",
    mcp: "Often in chat, tool output, or another review surface outside the normal diagnostics flow.",
  },
  {
    icon: TimerReset,
    category: "Feedback loop",
    lunar: "Optimized for low-latency, moment-of-writing feedback while context is still fresh.",
    mcp: "Usually better for checkpoint reviews after a chunk of work or once an agent finishes a pass.",
  },
  {
    icon: CheckCircle2,
    category: "How agents consume findings",
    lunar: "Structured as standard diagnostics with severity, source, and stable rule codes.",
    mcp: "May require custom parsing or additional orchestration depending on the tool output format.",
  },
  {
    icon: GitPullRequest,
    category: "Best use case",
    lunar: "Single-file, incremental review while writing code.",
    mcp: "PR-level, diff-level, or broader repo-aware review on demand.",
  },
];

export function MCPComparisonSection() {
  return (
    <section className="border-t border-border py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Comparison
          </div>
          <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Where Lunar fits versus generic code-review MCPs
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Lunar is not trying to replace deep PR review or repo-wide analysis. It solves a
            different problem: fast, local, editor-native review while you are still writing code.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-5xl space-y-4">
          {comparisonRows.map((row) => {
            const Icon = row.icon;

            return (
              <div
                key={row.category}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{row.category}</h3>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                      Lunar
                    </p>
                    <p className="text-sm leading-6 text-foreground">{row.lunar}</p>
                  </div>

                  <div className="rounded-xl border border-border bg-secondary/30 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Generic review MCP
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground">{row.mcp}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mx-auto mt-12 max-w-4xl rounded-2xl border border-border bg-secondary/20 p-6 md:p-8">
          <h3 className="text-xl font-semibold text-foreground md:text-2xl">
            The simplest way to think about it
          </h3>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            A generic code-review MCP is usually a tool you call. Lunar is a reviewer embedded into
            the editor’s diagnostic loop. That means the value is not just that AI review exists —
            it is that review appears inline, immediately, and in the exact workflow developers and
            coding agents already use to fix issues.
          </p>
        </div>
      </div>
    </section>
  );
}
