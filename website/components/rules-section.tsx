import { AlertCircle, AlertTriangle, Info, Lightbulb } from "lucide-react";

const severityLevels = [
  {
    level: "Error",
    icon: AlertCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
    description:
      "High-impact issue — security risk, broken contract, data loss potential",
  },
  {
    level: "Warning",
    icon: AlertTriangle,
    color: "text-warning",
    bg: "bg-amber-400/10",
    description:
      "Should be fixed — logic smell, missing error handling, confusing code",
  },
  {
    level: "Info",
    icon: Info,
    color: "text-info",
    bg: "bg-sky-400/10",
    description:
      "Worth considering — maintainability, testability, documentation gaps",
  },
  {
    level: "Hint",
    icon: Lightbulb,
    color: "text-foreground",
    bg: "bg-emerald-400/20",
    description: "Low-priority suggestion — naming, minor clarity improvement",
  },
];

const rules = [
  {
    code: "review/clarity",
    description: "Unclear intent, confusing control flow",
  },
  { code: "review/naming", description: "Misleading or overly generic names" },
  {
    code: "review/error-handling",
    description: "Swallowed exceptions, missing error paths",
  },
  {
    code: "review/security-footgun",
    description: "Injection risks, exposed secrets, unsafe operations",
  },
  {
    code: "review/api-contract",
    description: "Type mismatches, nullability violations, broken invariants",
  },
  {
    code: "review/complexity",
    description: "Deep nesting, functions that need decomposition",
  },
  {
    code: "review/perf-hotpath",
    description: "Redundant work in loops, unnecessary allocations or I/O",
  },
  {
    code: "review/maintainability",
    description: "Tight coupling, implicit dependencies, hidden state",
  },
  {
    code: "review/testing-gap",
    description: "Logic that is likely untested and hard to test",
  },
  {
    code: "review/docs-mismatch",
    description: "Comments that contradict the code, missing critical docs",
  },
];

export function RulesSection() {
  return (
    <section id="rules" className="border-t border-border py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
            Fixed ruleset. No hallucinations.
          </h2>
          <p className="text-lg text-muted-foreground">
            The AI reviews against a defined set of 10 rules. It cannot
            hallucinate rule IDs — you always know exactly what it's checking.
          </p>
        </div>

        {/* Severity Levels */}
        <div className="mx-auto mb-12 max-w-4xl">
          <h3 className="mb-6 text-center text-xl font-semibold text-foreground">
            Severity Levels
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {severityLevels.map((item) => (
              <div
                key={item.level}
                className={`rounded-lg border border-border ${item.bg} p-4`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                  <span className={`font-semibold ${item.color}`}>
                    {item.level}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Rules Table */}
        <div className="mx-auto max-w-3xl">
          <h3 className="mb-6 text-center text-xl font-semibold text-foreground">
            Review Rules
          </h3>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid grid-cols-[auto_1fr] border-b border-border bg-secondary/50 text-sm font-medium text-foreground">
              <div className="border-r border-border px-4 py-3">Rule</div>
              <div className="px-4 py-3">What It Flags</div>
            </div>
            {rules.map((rule, index) => (
              <div
                key={rule.code}
                className={`grid grid-cols-[auto_1fr] text-sm ${index !== rules.length - 1 ? "border-b border-border" : ""}`}
              >
                <div className="border-r border-border px-4 py-3">
                  <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-primary">
                    {rule.code}
                  </code>
                </div>
                <div className="px-4 py-3 text-muted-foreground">
                  {rule.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
