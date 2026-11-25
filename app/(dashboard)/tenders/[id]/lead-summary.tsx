import Link from "next/link";

import { CARD_CLASS, PageHeading } from "@/components/app-shell/page-heading";
import { ClosedBadge } from "@/components/tenders/markers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { closingLabel, sentenceCase } from "@/lib/format/display";
import { buildLeadSummary, leadStatusLabel, readableSheetDate, type LeadFieldValue } from "@/lib/leads/summary";
import { daysUntilClosing } from "@/lib/recommendation/deadline";

/**
 * What a lead shows before anyone has a tender PDF for it. There is no compliance check, payment-risk view or
 * recommendation yet, so the page says what the lead holds and what to do next, and nothing more.
 */
export function LeadSummaryView({
  title,
  organization,
  reference,
  status,
  deadlineAt,
  sourceKind,
  fields,
}: {
  title: string;
  organization: string | null;
  reference: string | null;
  status: string;
  deadlineAt: string | null;
  /** "Imported lead" or "Field lead". */
  sourceKind: string;
  /** Already worded for the screen. */
  fields: readonly LeadFieldValue[];
}) {
  const summary = buildLeadSummary(fields);
  const rawClosing = fields.find((field) => field.key === "submission_deadline")?.value ?? null;
  const closes = rawClosing ? readableSheetDate(rawClosing) : closingLabel(null, deadlineAt);
  const days = daysUntilClosing({ closingText: rawClosing, deadlineAt, asOf: new Date() });
  const facts = summary.facts.map((fact) => (fact.label === "Closes" && closes ? { ...fact, value: closes } : fact));
  // A field lead is titled by its organisation; do not print the same name twice.
  const showOrganization = organization && organization.trim().toLowerCase() !== title.trim().toLowerCase();
  const subtitle = [showOrganization ? sentenceCase(organization) : null, reference].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeading
        eyebrow={sourceKind}
        title={sentenceCase(title)}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {subtitle && <span>{subtitle}</span>}
            <Badge className="h-6 bg-muted px-2.5 text-muted-foreground">{leadStatusLabel(status)}</Badge>
            {days !== null && days < 0 && <ClosedBadge />}
          </span>
        }
      />

      <section className={`${CARD_CLASS} flex flex-col gap-3 px-5 py-4`} aria-label="About this lead">
        <h2 className="font-heading text-lg font-semibold">This is a lead, not a read tender</h2>
        <p className="text-muted-foreground">
          Nothing here has been checked against a tender document, so there is no compliance check, payment-risk view or
          recommendation yet. Add the tender PDF and BidLens will read it and check it against your company profile.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} render={<Link href="/tenders/new" />}>
            Add the tender PDF
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/tenders?tab=leads" />}>
            Back to leads
          </Button>
        </div>
      </section>

      {facts.length > 0 && (
        <section className={`${CARD_CLASS} px-5 py-4`}>
          <h2 className="font-heading text-lg font-semibold">Key facts</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <dt className="text-sm text-muted-foreground">{fact.label}</dt>
                <dd className="mt-0.5 break-words font-medium">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {summary.notes.length > 0 && (
        <section className={`${CARD_CLASS} px-5 py-4`}>
          <h2 className="font-heading text-lg font-semibold">What the lead says</h2>
          <dl className="mt-3 flex flex-col gap-4">
            {summary.notes.map((note) => (
              <div key={note.label}>
                <dt className="text-sm text-muted-foreground">{note.label}</dt>
                <dd className="mt-0.5 break-words">{note.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {summary.nextAction && (
        <section className={`${CARD_CLASS} px-5 py-4`}>
          <h2 className="font-heading text-lg font-semibold">Next action</h2>
          <p className="mt-2 break-words">{summary.nextAction}</p>
        </section>
      )}

      <p className="text-sm text-muted-foreground">
        Source: {sourceKind.toLowerCase()}
        {summary.checkedByPerson === null ? "" : ` · Checked by a person: ${summary.checkedByPerson ? "Yes" : "No"}`}
      </p>
    </div>
  );
}
