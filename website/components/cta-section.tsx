"use client";

import { Mail, Github, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="border-t border-border bg-secondary/20 py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-card px-6 py-10 text-center shadow-xl shadow-primary/5 sm:px-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Mail className="h-3.5 w-3.5" />
            Launch waitlist
          </div>

          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Be first to hear when Lunar rolls out
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Lunar is built for fast, editor-native review loops. Join the
            waitlist to get launch updates, early access news, and product
            announcements.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <a href="#waitlist">
                Join the waitlist
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>

            <Button variant="outline" size="lg" asChild>
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

          <p className="mt-6 text-sm text-muted-foreground">
            No PR review queue required. Just your editor, your code, and
            immediate feedback.
          </p>
        </div>
      </div>
    </section>
  );
}
