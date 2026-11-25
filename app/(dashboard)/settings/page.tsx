import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { NAV } from "@/components/app-shell/nav";
import { CARD_CLASS, PageHeading } from "@/components/app-shell/page-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { getWorkspaceName } from "@/lib/db/queries/company";
import { getWorkspaceSettings } from "@/lib/db/queries/settings";

import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: NAV.settings.title };

/** Shown, not editable. The AI and the data sources are set up by whoever deploys BidLens. */
const AI_AND_DATA: readonly { label: string; value: string }[] = [
  { label: "Reading tenders", value: "Cloud language model, set up by your administrator" },
  { label: "Local model", value: "Coming soon" },
  { label: "Tender documents", value: "PDFs you upload, kept in private storage" },
  { label: "County payment risk", value: "Controller of Budget, as at 30 Jun 2026" },
];

async function Loaded() {
  await connection();
  const [name, settings] = await Promise.all([getWorkspaceName(), getWorkspaceSettings()]);
  const details = [
    { label: "Workspace name", value: name },
    { label: "Timezone", value: "Africa/Nairobi (EAT)" },
    { label: "Currency", value: "Kenyan Shilling (KES)" },
    { label: "Language", value: "English" },
  ];
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <SettingsForm initial={settings} />

      <div className="flex flex-col gap-4">
        <section className={CARD_CLASS}>
          <div className="px-5 pt-5 pb-2">
            <h2 className="font-heading text-lg font-semibold">Workspace</h2>
            <p className="text-sm text-muted-foreground">Read from the company profile.</p>
          </div>
          <dl className="grid gap-x-6 gap-y-4 px-5 pt-2 pb-5 sm:grid-cols-2">
            {details.map((detail) => (
              <div key={detail.label} className="min-w-0">
                <dt className="text-sm text-muted-foreground">{detail.label}</dt>
                <dd className="mt-0.5 break-words font-medium">{detail.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={CARD_CLASS}>
          <div className="px-5 pt-5 pb-2">
            <h2 className="font-heading text-lg font-semibold">AI and data</h2>
            <p className="text-sm text-muted-foreground">Display only. These are not changed here.</p>
          </div>
          <dl className="px-5 pb-4">
            {AI_AND_DATA.map((item) => (
              <div key={item.label} className="border-t border-border/80 py-3 first:border-t-0">
                <dt className="text-sm text-muted-foreground">{item.label}</dt>
                <dd className="mt-0.5 font-medium">
                  {item.label === "Local model" ? `Local model: ${item.value.toLowerCase()}` : item.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeading eyebrow="Manage" title={NAV.settings.title} description={NAV.settings.description} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Loaded />
      </Suspense>
    </div>
  );
}
