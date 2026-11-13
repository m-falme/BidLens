import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { NAV } from "@/components/app-shell/nav";
import { CARD_CLASS, PageHeading } from "@/components/app-shell/page-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { getDemoCompanyProfile, listCompanyCapabilities, type CapabilityKind } from "@/lib/db/queries/company";

export const metadata: Metadata = { title: NAV.company.title };

const KINDS: readonly { kind: CapabilityKind; title: string; empty: string }[] = [
  { kind: "service", title: "Services", empty: "No services are stated in the profile." },
  { kind: "tool", title: "Tools", empty: "No tools are stated in the profile." },
  { kind: "sector", title: "Sectors", empty: "No sectors are stated in the profile." },
];

async function CompanyBody() {
  await connection();
  const [company, capabilities] = await Promise.all([getDemoCompanyProfile(), listCompanyCapabilities()]);
  const have = company.documents.filter((document) => document.holding === "have").length;
  const details = [
    { label: "Registered name", value: company.legalName ?? company.name },
    { label: "Workspace name", value: company.name },
    { label: "Capabilities stated", value: String(capabilities.length) },
    { label: "Company documents", value: `${have} of ${company.documents.length} marked Have` },
  ];

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)]">
      <div className="flex flex-col gap-4">
        <section className={CARD_CLASS}>
          <div className="px-5 pt-5 pb-2">
            <h2 className="font-heading text-lg font-semibold">Organisation details</h2>
            <p className="text-sm text-muted-foreground">Read from the company profile. This page does not edit it.</p>
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
            <h2 className="font-heading text-lg font-semibold">Capabilities</h2>
            <p className="text-sm text-muted-foreground">
              Stated in the company profile. A similar service name never counts as a certificate or licence.
            </p>
          </div>
          <div className="flex flex-col gap-5 px-5 pt-2 pb-5">
            {KINDS.map(({ kind, title, empty }) => {
              const items = capabilities.filter((capability) => capability.kind === kind);
              return (
                <div key={kind}>
                  <h3 className="font-medium">
                    {title} <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
                  </h3>
                  {items.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">{empty}</p>
                  ) : (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-full border border-confirmed/25 bg-confirmed/8 px-3 py-1 text-sm text-confirmed"
                        >
                          {item.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className={`${CARD_CLASS} px-5 py-4`}>
        <h2 className="font-heading text-lg font-semibold">Documents for tenders</h2>
        <p className="mt-2 text-muted-foreground">
          Registration papers, licences and certificates live in the Evidence library. A tender requirement is met only
          when it links to one of them marked Have.
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
