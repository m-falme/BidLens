import type { Metadata } from "next";

import { NAV } from "@/components/app-shell/nav";

export const metadata: Metadata = { title: NAV.settings.title };

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
      <p className="text-sm font-semibold tracking-[0.14em] text-brand uppercase">Manage</p>
      <h1 className="font-heading text-3xl tracking-tight">{NAV.settings.title}</h1>
      <p className="max-w-2xl text-muted-foreground">
        A person marks Interpretation, Compliance, and Commercial reviewed. A person approves or overrides the
        recommendation, and an override needs a reason. Nothing is submitted or emailed. Nothing on this page is saved.
      </p>
    </div>
  );
}
