"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Github } from "lucide-react";
import Image from "next/image";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        <a href="/" className="flex items-center gap-2">
          <Image
            src="/logo/logo-full.png"
            width={1000}
            height={1000}
            className="w-32 h-auto"
            alt="logo"
          />
          {/*<span className="font-semibold text-foreground">Lunar</span>*/}
        </a>

        <div className="hidden items-center gap-6 md:flex">
          <a
            href="#features"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            How it Works
          </a>
          <a
            href="#waitlist"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Waitlist
          </a>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" size="sm" asChild>
            <a
              href="https://github.com/theVedanta/lunar"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="mr-2 h-4 w-4" />
              GitHub
            </a>
          </Button>
          <Button size="sm" asChild>
            <a href="#waitlist">Get launch updates</a>
          </Button>
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-md border border-border md:hidden"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {isOpen && (
        <div className="border-b border-border bg-background px-4 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            <a
              href="#features"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              How it Works
            </a>
            <a
              href="#waitlist"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Waitlist
            </a>
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://github.com/theVedanta/lunar"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="mr-2 h-4 w-4" />
                  GitHub
                </a>
              </Button>
              <Button size="sm" asChild>
                <a href="#waitlist">Get launch updates</a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
