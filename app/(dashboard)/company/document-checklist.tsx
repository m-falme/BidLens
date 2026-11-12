"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { holdingLabel } from "@/lib/company/papers";
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

function wasLabel(holding: DocumentHolding): string {
  if (holding === "have") return "Have";
  if (holding === "expired") return "Expired";
  return "Don't have";
}

export function DocumentChecklist({ documents }: { documents: readonly CompanyDocument[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {documents.map((document) => (
        <DocumentRow key={document.id} document={document} />
      ))}
    </ul>
  );
}

function tenderCount(document: CompanyDocument): number {
  return new Set(document.uses.map((use) => use.tenderId)).size;
}

function DocumentRow({ document }: { document: CompanyDocument }) {
  const [holding, setHolding] = useState<DocumentHolding>(document.holding);
  const [expiresOn, setExpiresOn] = useState(document.expiresOn ?? "");
  const [neverExpires, setNeverExpires] = useState(document.neverExpires);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const dateValue = neverExpires || holding === "dont_have" ? "" : expiresOn;
  const dirty =
    holding !== document.holding ||
    neverExpires !== document.neverExpires ||
    dateValue !== (document.neverExpires || document.holding === "dont_have" ? "" : (document.expiresOn ?? ""));
  const shown = holdingLabel(document.holding, document.selfDeclared);
  const usedIn = tenderCount(document);

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
      className="grid scroll-mt-24 gap-3 rounded-lg border px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_12rem_14rem_auto] md:items-start"
    >
      <div className="min-w-0">
        <p className="font-medium">{document.name}</p>
        <p className={cn("text-sm", document.holding === "have" ? "text-green-700" : "text-muted-foreground")}>
          {shown}
          {document.originalHolding && document.originalHolding !== document.holding
            ? ` · was ${wasLabel(document.originalHolding)}`
            : ""}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {`Used in ${usedIn} ${usedIn === 1 ? "tender" : "tenders"}`}
        </p>
        {document.uses.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {document.uses.map((use, index) => (
              <li key={`${use.tenderId}-${index}`}>
                <Link
                  href={`/tenders/${use.tenderId}#can_comply`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {sentenceCase(use.tenderTitle)}
                </Link>
                <span className="text-muted-foreground">: {use.requirement}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Status</span>
        <select
          className="h-9 rounded-lg border border-input bg-transparent px-2.5"
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
      </label>
      <div className="flex flex-col gap-2 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Expiry date</span>
          <input
            type="date"
            className="h-9 rounded-lg border border-input bg-transparent px-2.5 disabled:opacity-50"
            value={dateValue}
            disabled={holding === "dont_have" || neverExpires}
            onChange={(event) => {
              setExpiresOn(event.target.value);
              setSaved(false);
            }}
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="size-4 accent-primary"
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
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          className="h-9 rounded-lg bg-primary px-3 font-medium text-primary-foreground disabled:opacity-50"
          disabled={pending || !dirty}
          onClick={save}
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && !dirty && <span className="text-sm text-green-700">Saved</span>}
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
    </li>
  );
}
