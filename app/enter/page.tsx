import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { APP_BYLINE, APP_FOOTER, APP_NAME, APP_TAGLINE, DEMO_COMPANY_NAME } from "@/lib/app-config";

import { signIn } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

export default function EnterPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 p-6">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-border bg-card p-8 shadow-[0_8px_28px_rgba(23,32,42,0.05)]">
        <div className="space-y-1">
          <p className="text-sm font-semibold tracking-[0.14em] text-brand uppercase">{APP_BYLINE}</p>
          <h1 className="font-heading text-3xl tracking-tight">{APP_NAME}</h1>
          <p className="text-muted-foreground">{APP_TAGLINE}</p>
        </div>
        <p>
          Read a tender, check it against your company&apos;s evidence, and decide whether to bid. A person approves every
          decision. Nothing is submitted and no email is sent.
        </p>
        <form action={signIn}>
          <Button type="submit" size="lg" className="w-full">
            Sign in as {DEMO_COMPANY_NAME}
          </Button>
        </form>
      </div>
      <p className="max-w-md text-center text-sm text-muted-foreground italic">{APP_FOOTER}</p>
    </main>
  );
}
