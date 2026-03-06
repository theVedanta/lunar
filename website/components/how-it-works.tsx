const steps = [
  {
    step: "01",
    title: "Install and configure",
    description: "Clone the repo, add your OpenAI API key, and launch the extension in VS Code.",
    code: "npm install\necho \"OPENAI_API_KEY=sk-...\" > .env\n\n# Press Ctrl+Shift+B to compile\n# Then F5 to launch",
  },
  {
    step: "02",
    title: "You type",
    description: "Write code as you normally would. Lunar watches every file you open in the background.",
    code: "async function fetchData() {\n  const res = await fetch(url + id)\n  const json = await res.json()\n  return json\n}",
  },
  {
    step: "03",
    title: "1s debounce, then review",
    description: "After a 1-second pause, Lunar sends the file to GPT-4o-mini. Results come back as standard LSP Diagnostics.",
    code: "// review/security-footgun\n// User input in URL - injection risk\n\n// review/error-handling  \n// Response status not checked",
  },
  {
    step: "04",
    title: "Fix or let agents fix",
    description: "Read the diagnostics yourself, or let AI agents filter by source: \"lunar\" and fix automatically.",
    code: '// Agent workflow:\nread textDocument/publishDiagnostics\nfilter source === "lunar"\napply fixes\nwatch issues clear on next pass',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">How it works</h2>
          <p className="text-lg text-muted-foreground">
            Get started in minutes. No complex configuration required.
          </p>
        </div>

        <div className="mx-auto max-w-4xl space-y-8">
          {steps.map((item, index) => (
            <div
              key={item.step}
              className={`flex flex-col gap-6 md:flex-row ${index % 2 === 1 ? "md:flex-row-reverse" : ""}`}
            >
              <div className="flex-1">
                <div className="mb-2 font-mono text-sm text-primary">{item.step}</div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
              <div className="flex-1">
                <div className="overflow-hidden rounded-lg border border-border bg-secondary/50">
                  <div className="border-b border-border bg-secondary/50 px-3 py-2">
                    <div className="flex gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30"></div>
                      <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30"></div>
                      <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30"></div>
                    </div>
                  </div>
                  <pre className="overflow-x-auto p-4 font-mono text-sm text-foreground">
                    <code>{item.code}</code>
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
