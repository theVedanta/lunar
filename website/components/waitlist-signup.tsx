"use client";

import { FormEvent, useMemo, useState } from "react";
import { Loader2, Mail, CheckCircle2, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SubmitState = "idle" | "submitting" | "success" | "error";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function WaitlistSignup() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  const isValidEmail = useMemo(() => emailPattern.test(email.trim()), [email]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!emailPattern.test(normalizedEmail)) {
      setState("error");
      setMessage("Enter a valid email address.");
      return;
    }

    try {
      setState("submitting");
      setMessage("");

      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;

      if (!response.ok) {
        setState("error");
        setMessage(data?.error ?? "Something went wrong. Please try again.");
        return;
      }

      setState("success");
      setMessage(data?.message ?? "You’re on the list. We’ll email you at launch.");
      setEmail("");
    } catch {
      setState("error");
      setMessage("Unable to submit right now. Please try again in a moment.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl rounded-2xl border border-border bg-card/80 p-4 shadow-lg shadow-primary/5 backdrop-blur sm:p-6">
      <div className="mb-5 text-center sm:text-left">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Mail className="h-3.5 w-3.5" />
          Launch updates
        </div>

        <h3 className="text-2xl font-semibold tracking-tight text-foreground">
          Get notified when Lunar rolls out
        </h3>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Join the waitlist for product updates, early access, and launch news.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="waitlist-email" className="sr-only">
              Email address
            </label>
            <Input
              id="waitlist-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (state !== "idle") {
                  setState("idle");
                  setMessage("");
                }
              }}
              disabled={state === "submitting"}
              aria-invalid={state === "error" ? true : undefined}
              className="h-11"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={state === "submitting" || !isValidEmail}
            className="h-11 sm:px-6"
          >
            {state === "submitting" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              "Join waitlist"
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          We’ll only use your email for Lunar launch and product updates.
        </p>

        {message ? (
          <div
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
              state === "success"
                ? "border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300"
                : "border-destructive/20 bg-destructive/10 text-destructive"
            }`}
            role={state === "error" ? "alert" : "status"}
          >
            {state === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{message}</span>
          </div>
        ) : null}
      </form>
    </div>
  );
}
