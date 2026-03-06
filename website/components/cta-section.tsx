"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Check, Copy, Github } from "lucide-react"

export function CTASection() {
  const [copied, setCopied] = useState(false)
  const installCommand = "git clone https://github.com/theVedanta/lunar && cd lunar && npm install"

  const handleCopy = async () => {
    await navigator.clipboard.writeText(installCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="border-t border-border bg-secondary/20 py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">Start reviewing as you write</h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Requires Node.js 18+, VS Code, and an OpenAI API key.
          </p>

          <div className="mx-auto mb-8 flex max-w-xl items-center gap-2 rounded-lg border border-border bg-card p-2">
            <code className="flex-1 overflow-x-auto px-3 font-mono text-xs text-foreground sm:text-sm">{installCommand}</code>
            <Button variant="ghost" size="sm" onClick={handleCopy} className="shrink-0">
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <a href="https://github.com/theVedanta/lunar" target="_blank" rel="noopener noreferrer">
                <Github className="mr-2 h-4 w-4" />
                View on GitHub
              </a>
            </Button>
            <Button variant="outline" size="lg">
              Read the Docs
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
