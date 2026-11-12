"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { holdingLabel } from "@/lib/company/papers";
import type { CompanyDocument } from "@/lib/db/queries/company";
import { DOCUMENT_HOLDINGS, type DocumentHolding } from "@/lib/db/vocab";
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

function DocumentRow({ document }: { document: CompanyDocument }) {
  const [holding, setHolding] = useState<DocumentHolding>(document.holding);
  const [expiresOn, setExpiresOn] = useState(document.expiresOn ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const dirty = holding !== document.holding || (holding === "dont_have" ? false : expiresOn !== (document.expiresOn ?? ""));
  const shown = holdingLabel(document.holding, document.selfDeclared);

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveCompanyDocument({
        id: document.id,
        holding,
        expiresOn: holding === "dont_have" ? "" : expiresOn,
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
    <li className="grid gap-3 rounded-lg border px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_12rem_11rem_auto] md:items-center">
      <div className="min-w-0">
        <p className="font-medium">{document.name}</p>
        <p className={cn("text-sm", document.holding === "have" ? "text-green-700" : "text-muted-foreground")}>
          {shown}
          {document.originalHolding && document.originalHolding !== document.holding
            ? ` · was ${wasLabel(document.originalHolding)}`
            : ""}
        </p>
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
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Expiry date</span>
        <input
          type="date"
          className="h-9 rounded-lg border border-input bg-transparent px-2.5 disabled:opacity-50"
          value={holding === "dont_have" ? "" : expiresOn}
          disabled={holding === "dont_have"}
          onChange={(event) => {
            setExpiresOn(event.target.value);
            setSaved(false);
          }}
        />
      </label>
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
