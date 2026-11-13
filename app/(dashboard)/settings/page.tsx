import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Check } from "lucide-react";

import { NAV } from "@/components/app-shell/nav";
import { CARD_CLASS, PageHeading } from "@/components/app-shell/page-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { getWorkspaceName } from "@/lib/db/queries/company";

export const metadata: Metadata = { title: NAV.settings.title };

const GATES: readonly { title: string; detail: string }[] = [
  {
    title: "A person approves each stage",
    detail: "Interpretation, Compliance and Commercial are marked reviewed by a named person. Each review is a new row.",
  },
  {
    title: "A person records the bid decision",
    detail: "The recommendation is a suggestion. A named person approves it or overrides it.",
  },
  {
    title: "An override needs a reason",
    detail: "The reason, the reviewer, the time and the earlier recommendation are kept. Nothing is erased.",
  },
  {
    title: "Status comes from the quote check",
    detail: "A fact is Confirmed only when its quote is found on the cited page. Otherwise a person checks it.",
  },
  {
    title: "Nothing leaves the workspace",
    detail: "No bid is submitted and no email is sent from BidLens Tenders.",
  },
];

async function WorkspaceDetails() {
  await connection();
  const name = await getWorkspaceName();
  const details = [
    { label: "Workspace name", value: name },
    { label: "Timezone", value: "Africa/Nairobi (EAT)" },
    { label: "Currency", value: "Kenyan Shilling (KES)" },
    { label: "Language", value: "English" },
  ];
  return (
    <dl className="grid gap-x-6 gap-y-4 px-5 pt-2 pb-5 sm:grid-cols-2">
      {details.map((detail) => (
        <div key={detail.label} className="min-w-0">
          <dt className="text-sm text-muted-foreground">{detail.label}</dt>
          <dd className="mt-0.5 break-words font-medium">{detail.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeading eyebrow="Manage" title={NAV.settings.title} description={NAV.settings.description} />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className={CARD_CLASS}>
          <div className="px-5 pt-5 pb-2">
            <h2 className="font-heading text-lg font-semibold">Workspace</h2>
            <p className="text-sm text-muted-foreground">Read from the company profile.</p>
          </div>
          <Suspense fallback={<Skeleton className="mx-5 mb-5 h-24" />}>
            <WorkspaceDetails />
          </Suspense>
        </section>

        <section className={CARD_CLASS}>
          <div className="px-5 pt-5 pb-2">
            <h2 className="font-heading text-lg font-semibold">Review workflow</h2>
            <p className="text-sm text-muted-foreground">Human review gates. Always on.</p>
          </div>
          <ul className="px-5 pb-3">
            {GATES.map((gate) => (
              <li key={gate.title} className="flex gap-3 border-t border-border/80 py-3 first:border-t-0">
                <span
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-confirmed/10 text-confirmed"
                  aria-hidden
                >
                  <Check className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{gate.title}</p>
                  <p className="text-sm text-muted-foreground">{gate.detail}</p>
                </div>
                <span className="h-fit shrink-0 rounded-full bg-confirmed/10 px-2.5 py-0.5 text-sm font-medium text-confirmed">
                  On
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
