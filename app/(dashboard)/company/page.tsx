import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { NAV } from "@/components/app-shell/nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PAPER_GROUPS } from "@/lib/company/papers";
import { getDemoCompanyProfile } from "@/lib/db/queries/company";

import { DocumentChecklist } from "./document-checklist";

export const metadata: Metadata = { title: NAV.company.title };

async function CompanyProfile() {
  await connection();
  const company = await getDemoCompanyProfile();
  const declared = company.documents.filter((document) => document.holding === "have" && document.selfDeclared).length;
  const notHeld = company.documents.filter((document) => document.holding !== "have").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{company.legalName ?? company.name}</h1>
        <p className="text-lg text-muted-foreground">{NAV.company.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            <h2>Company documents</h2>
          </CardTitle>
          <CardDescription>
            {declared} marked Have (self-declared), {notHeld} marked Don&apos;t have or Expired. Have (self-declared)
            is the team&apos;s own mark. The file has not been checked. A tender requirement is met only when it links
            to a paper marked Have.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-8">
          {company.documents.length === 0 ? (
            <p className="text-muted-foreground">No company documents are on the checklist yet.</p>
          ) : (
            PAPER_GROUPS.map((group) => {
              const documents = company.documents.filter((document) => document.group === group.id);
              if (documents.length === 0) return null;
              return (
                <section key={group.id} className="flex flex-col gap-3">
                  <h3 className="text-lg font-semibold">{group.title}</h3>
                  <DocumentChecklist documents={documents} />
                </section>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CompanyPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <CompanyProfile />
    </Suspense>
  );
}
