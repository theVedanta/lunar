import { Button } from "@/components/ui/button";
import { WaitlistSignup } from "@/components/waitlist-signup";
import { ArrowRight, Github } from "lucide-react";

export function HeroSection() {
  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
            </span>
            Launching soon
          </div>

          <h1 className="mb-6 max-w-3xl text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
            AI code review as{" "}
            <span className="text-primary">LSP diagnostics</span>
          </h1>

          <p className="max-w-2xl text-pretty text-lg text-muted-foreground md:text-xl">
            Lunar reviews code as you write and surfaces issues inline in your
            editor as standard diagnostics. Same squiggles, same Problems panel,
            same workflow — just with AI-powered review built directly into the
            loop.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:justify-start">
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

          <div className="mt-10 grid max-w-2xl gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">Always-on</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Review runs automatically on file open and edit.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">
                Editor-native
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Findings show up inline as standard LSP diagnostics.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">
                Fast feedback
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Catch issues while code is still fresh in your head.
              </p>
            </div>
          </div>
        </div>

        <div id="waitlist" className="lg:sticky lg:top-24">
          <WaitlistSignup />
        </div>
      </div>
    </section>
  );
}
