"use client";

import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import { useState, useTransition } from "react";

import { CARD_CLASS } from "@/components/app-shell/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatWhen } from "@/lib/format/display";
import type { RankedTender } from "@/lib/find/rank";
import type { FindResult } from "@/lib/find/run";
import { cn } from "@/lib/utils";

import { findTendersAction, startTenderAction } from "./actions";

function kes(value: number | null): string | null {
  return value === null ? null : `KSh ${new Intl.NumberFormat("en-KE").format(value)}`;
}

function fitTone(fit: number, eligibility: RankedTender["eligibility"]): string {
  if (eligibility === "blocked") return "bg-blocker/12 text-blocker";
  if (fit >= 60) return "bg-confirmed/10 text-confirmed";
  if (fit >= 35) return "bg-warning/15 text-warning";
  return "bg-muted text-muted-foreground";
}

type Started = Record<string, string>;

export function FindClient() {
  const [pending, startSearch] = useTransition();
  const [data, setData] = useState<{ result: FindResult; started: Started } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  function search() {
    setError(null);
    startSearch(async () => {
      const answer = await findTendersAction();
      if (answer.ok) setData({ result: answer.result, started: answer.started });
      else setError(answer.error);
    });
  }

  function markStarted(reference: string, leadId: string) {
    setData((current) => (current ? { ...current, started: { ...current.started, [reference]: leadId } } : current));
  }

  const ranked = data?.result.ranked ?? [];
  const open = ranked.filter((r) => r.eligibility === "open");
  const blocked = ranked.filter((r) => r.eligibility === "blocked");
  const closed = ranked.filter((r) => r.eligibility === "closed");

  return (
    <div className="flex flex-col gap-5">
      <section className={`${CARD_CLASS} flex flex-wrap items-center justify-between gap-4 px-5 py-4`}>
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground">
            Source: {data?.result.sourceLabel ?? "sample dataset (60 tenders)"}. Live tender sites coming next.
          </p>
          <p className="text-sm text-muted-foreground">
            Matches are suggestions from your company profile and evidence. A person decides what to bid on.
          </p>
        </div>
        <Button size="lg" onClick={search} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
          {pending ? "Finding tenders…" : "Find tenders for Zanari"}
        </Button>
      </section>

      {error && (
        <p role="alert" className="rounded-lg border border-blocker/30 bg-blocker/10 px-4 py-3 text-blocker">
          {error}
        </p>
      )}

      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-muted-foreground">
            <p>
              {open.length} open {open.length === 1 ? "match" : "matches"}
              {blocked.length > 0 && `, ${blocked.length} you are probably not eligible for`}
              {closed.length > 0 && `, ${closed.length} closed`}.
              {data.result.aiStatus === "failed" &&
                " The AI could not write reasons just now, so scores come from the profile check alone."}
              {data.result.aiStatus === "not_configured" &&
                " No AI model is set up, so scores come from the profile check alone."}
            </p>
            <label className="flex items-center gap-2">
              <Switch checked={showClosed} onCheckedChange={setShowClosed} aria-label="Show closed" />
              Show closed
            </label>
          </div>

          <Group title="Best matches" rows={open} started={data.started} onStarted={markStarted} />
          <Group
            title="Probably not eligible"
            note="A reservation or licence you do not hold."
            rows={blocked}
            started={data.started}
            onStarted={markStarted}
          />
          {showClosed && <Group title="Closed" rows={closed} started={data.started} onStarted={markStarted} />}
        </>
      )}
    </div>
  );
}

function Group({
  title,
  note,
  rows,
  started,
  onStarted,
}: {
  title: string;
  note?: string;
  rows: RankedTender[];
  started: Started;
  onStarted: (reference: string, leadId: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-heading text-lg font-semibold">
          {title} <span className="text-muted-foreground">({rows.length})</span>
        </h2>
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
      </div>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <Result key={row.tender.id} row={row} leadId={started[row.tender.reference] ?? null} onStarted={onStarted} />
        ))}
      </ul>
    </section>
  );
}

function Result({
  row,
  leadId,
  onStarted,
}: {
  row: RankedTender;
  leadId: string | null;
  onStarted: (reference: string, leadId: string) => void;
}) {
  const { tender } = row;
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const value = kes(tender.estimated_value_kes);

  function begin() {
    setError(null);
    start(async () => {
      const answer = await startTenderAction(tender.id);
      if (answer.ok) onStarted(tender.reference, answer.leadId);
      else setError(answer.error);
    });
  }

  return (
    <li className={`${CARD_CLASS} flex flex-wrap items-start justify-between gap-4 px-5 py-4`}>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 className="font-heading text-base font-semibold">{tender.title}</h3>
        <p className="text-muted-foreground">
          {[
            tender.buyer,
            tender.county,
            `Closes ${formatWhen(tender.closing_datetime) ?? tender.closing_datetime}`,
            value ?? "Value not stated",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <ul className="list-disc pl-5">
          {row.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          {row.aiWritten ? "Reasons written by AI from your profile." : "Reasons from the profile check."} Fictional
          sample notice.
        </p>
        {error && (
          <p role="alert" className="text-sm text-blocker">
            {error}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-3">
        <Badge className={cn("h-7 px-3 text-sm tabular-nums", fitTone(row.fit, row.eligibility))}>Fit {row.fit}</Badge>
        {leadId ? (
          <Button variant="outline" nativeButton={false} render={<Link href={`/tenders/${leadId}`} />}>
            Open lead
          </Button>
        ) : (
          <Button onClick={begin} disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {pending ? "Starting…" : "Start this tender"}
          </Button>
        )}
      </div>
    </li>
  );
}
