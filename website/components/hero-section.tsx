import { Button } from "@/components/ui/button";
import { WaitlistSignup } from "@/components/waitlist-signup";
import { CodeEditorPreview } from "@/components/code-editor-preview";
import { ArrowRight, Github, Sparkles } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.12),transparent_42%),radial-gradient(circle_at_80%_10%,hsl(var(--primary)/0.08),transparent_36%)]" />

      <div className="container mx-auto px-4 pb-14 pt-12 md:pb-20 md:pt-16">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-8 max-w-3xl text-center md:mb-10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              AI review inside standard LSP diagnostics
            </div>

            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-6xl">
              Catch reasoning bugs
              <span className="text-primary">
                {" "}
                while code is still in motion
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground md:text-xl">
              Lunar surfaces subtle, high-impact issues directly in your editor
              — things like confusing similarly named variables or risky URL
              construction — not just basic lint noise.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" className="w-full sm:w-auto" asChild>
                <a href="#waitlist">
                  Join the waitlist
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
                asChild
              >
                <a
                  href="https://github.com/theVedanta/lunar"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="mr-2 h-4 w-4" />
                  View on GitHub
                </a>
              </Button>
            </div>
          </div>

          <CodeEditorPreview />

          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <div className="rounded-xl border border-border bg-card p-5 md:p-6">
                <h2 className="text-lg font-semibold text-foreground md:text-xl">
                  What this example is showing
                </h2>
                <p className="mt-2 text-sm text-muted-foreground md:text-base">
                  The diagnostics focus on semantic intent and security posture:
                  suspicious variable usage, dangerous URL concatenation, and
                  missing guards around async behavior.
                </p>

                <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
                  <li className="rounded-md border border-border bg-secondary/30 px-3 py-2">
                    <span className="font-medium text-foreground">
                      Similar-name confusion:
                    </span>{" "}
                    flags when a variable like <code>userId</code> is expected
                    but <code>user.id</code> is used in a sensitive path.
                  </li>
                  <li className="rounded-md border border-border bg-secondary/30 px-3 py-2">
                    <span className="font-medium text-foreground">
                      Risky URL construction:
                    </span>{" "}
                    catches direct string concatenation into request URLs that
                    can become injection footguns.
                  </li>
                  <li className="rounded-md border border-border bg-secondary/30 px-3 py-2">
                    <span className="font-medium text-foreground">
                      Logic-aware feedback:
                    </span>{" "}
                    points out brittle control flow and missing response checks
                    before they become runtime incidents.
                  </li>
                </ul>
              </div>
            </div>

            <div id="waitlist" className="lg:sticky lg:top-24">
              <WaitlistSignup />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
