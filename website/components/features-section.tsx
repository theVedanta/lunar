import { Zap, Bot, AlertTriangle, Shield, FileCode, RefreshCw } from "lucide-react"

const features = [
  {
    icon: Zap,
    title: "1-Second Debounce",
    description: "After a 1-second pause in typing, Lunar sends your file to GPT-4o-mini for review. Results appear instantly.",
  },
  {
    icon: Bot,
    title: "AI Agent Ready",
    description: "Agents can read source: \"lunar\" diagnostics via textDocument/publishDiagnostics and fix issues automatically.",
  },
  {
    icon: AlertTriangle,
    title: "Four Severity Levels",
    description: "Error for security risks, Warning for logic smells, Info for maintainability, Hint for naming suggestions.",
  },
  {
    icon: Shield,
    title: "Fixed Ruleset",
    description: "10 rules covering clarity, naming, error handling, security, API contracts, complexity, and more. No hallucinated rule IDs.",
  },
  {
    icon: FileCode,
    title: "Standard LSP",
    description: "Works with any LSP-compatible editor. Same squiggly lines, same Problems panel you already know.",
  },
  {
    icon: RefreshCw,
    title: "Stale Result Guard",
    description: "If the document changes while the model is thinking, outdated results are dropped silently. Always fresh feedback.",
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="border-t border-border bg-secondary/20 py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
            Review at the moment of writing
          </h2>
          <p className="text-lg text-muted-foreground">
            Most code review happens too late. By the time a PR is open, context is lost and fixes are expensive. Lunar moves review to the moment of writing.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-card/80"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 font-semibold text-foreground">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
