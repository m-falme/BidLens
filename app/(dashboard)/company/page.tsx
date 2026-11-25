import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { NAV } from "@/components/app-shell/nav";
import { CARD_CLASS, PageHeading } from "@/components/app-shell/page-heading";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProfileKind } from "@/lib/company/profile";
import { getDemoCompanyProfile, listCompanyCapabilities } from "@/lib/db/queries/company";

import { CapabilityGroup, LegalNameField } from "./profile-editor";

export const metadata: Metadata = { title: NAV.company.title };

const KINDS: readonly { kind: ProfileKind; title: string; addLabel: string; empty: string }[] = [
  { kind: "service", title: "Services", addLabel: "Add a service", empty: "No services yet. Add what you deliver." },
  { kind: "tool", title: "Tools", addLabel: "Add a tool", empty: "No tools yet. Add the software and equipment you use." },
  { kind: "sector", title: "Sectors", addLabel: "Add a sector", empty: "No sectors yet. Add the sectors you serve." },
];

async function CompanyBody() {
  await connection();
  const [company, capabilities] = await Promise.all([getDemoCompanyProfile(), listCompanyCapabilities()]);
  const have = company.documents.filter((document) => document.holding === "have").length;
  const added = capabilities.filter((capability) => capability.addedByTeam).length;
  const facts = [
    { label: "Workspace name", value: company.name, note: "Fixed. Your workspace is found by this name." },
    {
      label: "Services, tools and sectors",
      value: String(capabilities.length),
      note: added > 0 ? `${added} added by your team` : "All stated in your profile document",
    },
    { label: "Company documents", value: `${have} of ${company.documents.length} marked Have`, note: "Managed in the Evidence library" },
  ];

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)]">
      <div className="flex flex-col gap-4">
        <section className={CARD_CLASS}>
          <div className="px-5 pt-5 pb-2">
            <h2 className="font-heading text-lg font-semibold">About your company</h2>
            <p className="text-sm text-muted-foreground">The registered name can be changed. The earlier name is kept.</p>
          </div>
          <dl className="grid gap-x-6 gap-y-4 px-5 pt-2 pb-5 sm:grid-cols-2">
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-sm text-muted-foreground">Registered name</dt>
              <dd className="mt-0.5">
                <LegalNameField name={company.legalName ?? company.name} original={company.originalLegalName} />
              </dd>
            </div>
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <dt className="text-sm text-muted-foreground">{fact.label}</dt>
                <dd className="mt-0.5 break-words font-medium">{fact.value}</dd>
                <dd className="text-sm text-muted-foreground">{fact.note}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={CARD_CLASS}>
          <div className="px-5 pt-5 pb-2">
            <h2 className="font-heading text-lg font-semibold">What you deliver</h2>
            <p className="text-sm text-muted-foreground">
              Tenders are checked against this list. Green items are stated in your company profile document. Dashed
              items were added by your team and are not checked, so a tender line matched to one reads &ldquo;Claimed,
              not verified&rdquo;. A similar service name never counts as a certificate or licence.
            </p>
          </div>
          <div className="flex flex-col gap-6 px-5 pt-2 pb-5">
            {KINDS.map(({ kind, title, addLabel, empty }) => (
              <CapabilityGroup
                key={kind}
                kind={kind}
                title={title}
                addLabel={addLabel}
                empty={empty}
                items={capabilities
                  .filter((capability) => capability.kind === kind)
                  .map((capability) => ({ id: capability.id, name: capability.name, addedByTeam: capability.addedByTeam }))}
              />
            ))}
          </div>
        </section>
      </div>

      <section className={`${CARD_CLASS} px-5 py-4`}>
        <h2 className="font-heading text-lg font-semibold">Documents for tenders</h2>
        <p className="mt-2 text-muted-foreground">
          Registration papers, licences and certificates live in the Evidence library, where you can upload a file for
          each. A tender requirement is met only when it links to one of them marked Have.
        </p>
        <Link href="/evidence" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
          Open Evidence library
        </Link>
      </section>
    </div>
  );
}

export default function CompanyPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeading eyebrow="Workspace" title={NAV.company.title} description={NAV.company.description} />
      <Suspense
        fallback={
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)]">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        }
      >
        <CompanyBody />
      </Suspense>
    </div>
  );
}
