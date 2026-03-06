import { Button } from "@/components/ui/button"
import { ArrowRight, Github } from "lucide-react"

export function HeroSection() {
  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm text-primary">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
          </span>
          Powered by GPT-4o-mini
        </div>

        <h1 className="mb-6 text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
          AI code review as{" "}
          <span className="text-primary">LSP diagnostics</span>
        </h1>

        <p className="mx-auto mb-8 max-w-2xl text-pretty text-lg text-muted-foreground md:text-xl">
          Lunar runs a code review on every file you open. Same squiggly lines, same Problems panel, same workflow — just with an AI reviewer looking over your shoulder.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button size="lg" className="w-full sm:w-auto">
            Get Started
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              <Github className="mr-2 h-4 w-4" />
              View on GitHub
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}
