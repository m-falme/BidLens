"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";

import { documentIsExpired, holdingLabel, type PaperGroup } from "@/lib/company/papers";
import type { CompanyDocument } from "@/lib/db/queries/company";
import { DOCUMENT_HOLDINGS, type DocumentHolding } from "@/lib/db/vocab";
import { sentenceCase } from "@/lib/format/display";
import { cn } from "@/lib/utils";

import { saveCompanyDocument } from "./actions";

const STATUS_OPTIONS: readonly { value: DocumentHolding; label: string }[] = [
  { value: "have", label: "Have" },
  { value: "dont_have", label: "Don't have" },
  { value: "expired", label: "Expired" },
];

const STATUS_HINT: Record<DocumentHolding, string> = {
  have: "The team holds this document. A requirement that needs it counts as met.",
  dont_have: "Not held. A requirement that needs it is a gap.",
  expired: "Held but expired. A requirement that needs it is a gap until it is renewed.",
};

const PILL: Record<DocumentHolding, string> = {
  have: "bg-confirmed/10 text-confirmed",
  dont_have: "bg-muted text-muted-foreground",
  expired: "bg-blocker/12 text-blocker",
};

function wasLabel(holding: DocumentHolding): string {
  if (holding === "have") return "Have";
  if (holding === "expired") return "Expired";
  return "Don't have";
}

function tenderCount(document: CompanyDocument): number {
  return new Set(document.uses.map((use) => use.tenderId)).size;
}

export function EvidenceLibrary({
  documents,
  groups,
  today,
}: {
  documents: readonly CompanyDocument[];
  groups: readonly { id: PaperGroup; title: string }[];
  today: string;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<PaperGroup | "all">("all");
  const searchId = useId();
  const groupTitle = useMemo(() => new Map(groups.map((item) => [item.id, item.title])), [groups]);
  const needle = query.trim().toLowerCase();
  const shown = documents.filter((document) => {
    if (group !== "all" && document.group !== group) return false;
    if (!needle) return true;
    const haystack = `${document.name} ${groupTitle.get(document.group) ?? ""}`.toLowerCase();
    return haystack.includes(needle);
  });

  return (
    <>
      <div className="flex flex-wrap gap-3 border-b border-border px-5 py-4">
        <label htmlFor={`${searchId}-q`} className="sr-only">
          Search documents
        </label>
        <input
          id={`${searchId}-q`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search documents…"
          className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 sm:max-w-sm"
        />
        <label htmlFor={`${searchId}-g`} className="sr-only">
          Category
        </label>
        <select
          id={`${searchId}-g`}
          value={group}
          onChange={(event) => {
            const next = event.target.value;
            setGroup(next === "all" ? "all" : (groups.find((item) => item.id === next)?.id ?? "all"));
          }}
          className="h-10 rounded-lg border border-input bg-background px-3"
        >
          <option value="all">All categories</option>
          {groups.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </div>

      <div
        className="hidden gap-4 border-b border-border px-5 py-2 text-sm font-medium tracking-wide text-muted-foreground uppercase lg:grid lg:grid-cols-[minmax(0,1.5fr)_11rem_14rem_7rem]"
        aria-hidden
      >
        <span>Document</span>
        <span>Status</span>
        <span>Expiry</span>
        <span />
      </div>

      {shown.length === 0 ? (
        <p className="px-5 py-6 text-muted-foreground">
          {documents.length === 0 ? "No company documents are on the checklist yet." : "No document matches this search."}
        </p>
      ) : (
        <ul>
          {shown.map((document) => (
            <DocumentRow
              key={document.id}
              document={document}
              category={groupTitle.get(document.group) ?? "Other documents"}
              today={today}
            />
          ))}
        </ul>
      )}

      <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground">
        {shown.length} of {documents.length} documents · Have (self-declared) is the team&apos;s own mark; the file has not
        been checked.
      </p>
    </>
  );
}

function DocumentRow({
  document,
  category,
  today,
}: {
  document: CompanyDocument;
  category: string;
  today: string;
}) {
  const [holding, setHolding] = useState<DocumentHolding>(document.holding);
  const [expiresOn, setExpiresOn] = useState(document.expiresOn ?? "");
  const [neverExpires, setNeverExpires] = useState(document.neverExpires);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const controlId = useId();
  const dateValue = neverExpires || holding === "dont_have" ? "" : expiresOn;
  const dirty =
    holding !== document.holding ||
    neverExpires !== document.neverExpires ||
    dateValue !== (document.neverExpires || document.holding === "dont_have" ? "" : (document.expiresOn ?? ""));
  const shown = holdingLabel(document.holding, document.selfDeclared);
  const usedIn = tenderCount(document);
  const pastDate =
    document.holding === "have" && !document.neverExpires && documentIsExpired(document.expiresOn, today);

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveCompanyDocument({
        id: document.id,
        holding,
        neverExpires,
        expiresOn: dateValue,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <li
      id={`doc-${document.id}`}
      className="grid scroll-mt-24 gap-4 border-b border-border/80 px-5 py-4 last:border-b-0 target:bg-brand/5 lg:grid-cols-[minmax(0,1.5fr)_11rem_14rem_7rem] lg:items-start"
    >
      <div className="min-w-0">
        <p className="font-medium break-words">{document.name}</p>
        <p className="text-sm text-muted-foreground">{category}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={cn("inline-flex rounded-full px-2.5 py-0.5 text-sm font-medium", PILL[document.holding])}
            title={STATUS_HINT[document.holding]}
          >
            {shown}
          </span>
          {pastDate && (
            <span
              className="inline-flex rounded-full bg-blocker/12 px-2.5 py-0.5 text-sm font-medium text-blocker"
              title="The expiry date is before today, so readiness treats this document as expired."
            >
              Past expiry date
            </span>
          )}
          {document.originalHolding && document.originalHolding !== document.holding && (
            <span className="text-sm text-muted-foreground">was {wasLabel(document.originalHolding)}</span>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{`Used in ${usedIn} ${usedIn === 1 ? "tender" : "tenders"}`}</p>
        {document.uses.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {document.uses.map((use, index) => (
              <li key={`${use.tenderId}-${index}`} className="break-words">
                <Link
                  href={`/tenders/${use.tenderId}#can_comply`}
                  className="font-medium text-brand underline-offset-4 hover:underline"
                >
                  {sentenceCase(use.tenderTitle)}
                </Link>
                <span className="text-muted-foreground">: {use.requirement}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor={`${controlId}-status`} className="text-muted-foreground">
          Status
        </label>
        <select
          id={`${controlId}-status`}
          className="h-10 rounded-lg border border-input bg-background px-2.5"
          value={holding}
          onChange={(event) => {
            const next = event.target.value;
            if ((DOCUMENT_HOLDINGS as readonly string[]).includes(next)) {
              setHolding(next as DocumentHolding);
              setSaved(false);
            }
          }}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <label htmlFor={`${controlId}-date`} className="text-muted-foreground">
          Expiry date
        </label>
        <input
          id={`${controlId}-date`}
          type="date"
          className="h-10 rounded-lg border border-input bg-background px-2.5 disabled:opacity-50"
          value={dateValue}
          disabled={holding === "dont_have" || neverExpires}
          onChange={(event) => {
            setExpiresOn(event.target.value);
            setSaved(false);
          }}
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="size-4 accent-brand"
            checked={neverExpires}
            onChange={(event) => {
              setNeverExpires(event.target.checked);
              if (event.target.checked) setExpiresOn("");
              setSaved(false);
            }}
          />
          Does not expire
        </label>
      </div>

      <div className="flex flex-col items-start gap-1 lg:pt-6">
        <button
          type="button"
          className="h-10 rounded-lg bg-primary px-4 font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
          disabled={pending || !dirty}
          onClick={save}
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && !dirty && (
          <span className="text-sm text-confirmed" role="status">
            Saved
          </span>
        )}
        {error && (
          <span className="text-sm text-blocker" role="alert">
            {error}
          </span>
        )}
      </div>
    </li>
  );
}
