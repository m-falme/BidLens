"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatWhen } from "@/lib/format/display";
import type { PlanRow, PlanSection } from "@/lib/plan/build";
import { planProgress } from "@/lib/plan/build";

import { saveActionItem } from "./actions";

const SECTIONS: readonly { id: PlanSection; title: string; empty: string }[] = [
  {
    id: "documents",
    title: "Documents to get",
    empty: "No mandatory document is missing or expired.",
  },
  {
    id: "questions",
    title: "Questions to ask the buyer",
    empty: "No key fact is blank or marked needs a person.",
  },
  {
    id: "outline",
    title: "Response outline",
    empty: "No evaluation criteria or mandatory requirements were extracted.",
  },
  {
    id: "dates",
    title: "Key dates",
    empty: "No dates were extracted.",
  },
];

function pageLabel(pageNo: number | null): string {
  return pageNo ? `Page ${pageNo}` : "Page not stated";
}

export function ActionPlan({
  tenderId,
  rows,
  editable,
}: {
  tenderId: string;
  rows: readonly PlanRow[];
  editable: boolean;
}) {
  const progress = planProgress(rows);
  const questions = rows.flatMap((row) => (row.section === "questions" && row.question ? [row.question] : []));

  return (
    <div id="action-plan" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold tabular-nums">{progress.label}</p>
        {editable ? (
          <Button variant="outline" nativeButton={false} render={<Link href={`/tenders/${tenderId}/plan`} />}>
            Download plan
          </Button>
        ) : null}
      </div>
      {SECTIONS.map((section) => {
        const items = rows.filter((row) => row.section === section.id);
        return (
          <section key={section.id} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold">{section.title}</h3>
              {editable && section.id === "questions" && (
                <CopyQuestions questions={questions} />
              )}
            </div>
            {items.length === 0 ? (
              <p className="mt-3 text-muted-foreground">{section.empty}</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-4">
                {items.map((row) => (
                  <li key={row.key} className="border-t pt-4 first:border-t-0 first:pt-0">
                    {editable ? (
                      <ActionRow tenderId={tenderId} row={row} />
                    ) : (
                      <StaticRow row={row} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function StaticRow({ row }: { row: PlanRow }) {
  const due = row.dueOn ? formatWhen(row.dueOn) : null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 font-medium break-words">{row.title}</p>
        <span className="shrink-0 text-muted-foreground tabular-nums">{pageLabel(row.pageNo)}</span>
      </div>
      <p className="text-muted-foreground">{row.detail}</p>
      <p>
        {row.done ? "Done" : "Not done"}
        {" · "}
        {row.ownerName ? `Owner: ${row.ownerName}` : "Unassigned"}
        {" · "}
        {due ? `Due ${due}` : "No due date"}
      </p>
    </div>
  );
}

function ActionRow({ tenderId, row }: { tenderId: string; row: PlanRow }) {
  const router = useRouter();
  const [owner, setOwner] = useState(row.ownerName);
  const [due, setDue] = useState(row.dueOn);
  const [done, setDone] = useState(row.done);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ownerId = `owner-${row.key}`;
  const dueId = `due-${row.key}`;
  const doneId = `done-${row.key}`;

  function persist(next: { ownerName: string; dueOn: string; done: boolean }) {
    setError(null);
    startTransition(async () => {
      const result = await saveActionItem({
        tenderId,
        itemKey: row.key,
        kind: row.kind,
        ownerName: next.ownerName,
        dueOn: next.dueOn,
        done: next.done,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const nextOwner = String(data.get("owner") ?? "");
        const nextDue = String(data.get("due") ?? "");
        setOwner(nextOwner);
        setDue(nextDue);
        persist({ ownerName: nextOwner, dueOn: nextDue, done });
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 font-medium break-words">{row.title}</p>
        <span className="shrink-0 text-muted-foreground tabular-nums">{pageLabel(row.pageNo)}</span>
      </div>
      <p className="text-muted-foreground">{row.detail}</p>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-2 pb-2">
          <input
            id={doneId}
            type="checkbox"
            className="size-5 accent-primary"
            checked={done}
            disabled={pending}
            onChange={(event) => {
              const next = event.target.checked;
              setDone(next);
              persist({ ownerName: owner, dueOn: due, done: next });
            }}
          />
          <Label htmlFor={doneId}>Done</Label>
        </div>
        <div className="flex min-w-40 flex-1 flex-col gap-1">
          <Label htmlFor={ownerId}>Owner</Label>
          <Input
            id={ownerId}
            name="owner"
            value={owner}
            autoComplete="name"
            disabled={pending}
            onChange={(event) => setOwner(event.target.value)}
            onBlur={(event) => {
              const next = event.currentTarget.value;
              if (next === row.ownerName) return;
              setOwner(next);
              persist({ ownerName: next, dueOn: due, done });
            }}
          />
        </div>
        <div className="flex w-44 flex-col gap-1">
          <Label htmlFor={dueId}>Due date</Label>
          <Input
            id={dueId}
            name="due"
            type="date"
            value={due}
            disabled={pending}
            onChange={(event) => {
              const next = event.target.value;
              setDue(next);
              persist({ ownerName: owner, dueOn: next, done });
            }}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-blocker">
          {error}
        </p>
      )}
      {pending && <p className="text-sm text-muted-foreground">Saving…</p>}
    </form>
  );
}

function CopyQuestions({ questions }: { questions: readonly string[] }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    setError(null);
    try {
      await navigator.clipboard.writeText(questions.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
      setError("Could not copy. Select the questions and copy them.");
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" disabled={questions.length === 0} onClick={() => void copy()}>
        {copied ? "Copied" : "Copy all questions"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-blocker">
          {error}
        </p>
      )}
    </div>
  );
}
