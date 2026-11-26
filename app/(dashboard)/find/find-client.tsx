"use client";

import Link from "next/link";
import { ChevronRight, Loader2, Search } from "lucide-react";
import { useState, useTransition } from "react";

import { CARD_CLASS } from "@/components/app-shell/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatWhen } from "@/lib/format/display";
import { GOOD_FIT, type RankedTender } from "@/lib/find/rank";
import type { FindResult } from "@/lib/find/run";
import { cn } from "@/lib/utils";

import { findTendersAction, startedLeadsAction, startTenderAction } from "./actions";

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

const SESSION_KEY = "bidlens:find-tenders";
const SESSION_MS = 30 * 60 * 1000;

/** The last ranking in this browser tab, so pressing the button again does not call the AI again. */
function savedResult(): FindResult | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { at: number; result: FindResult };
    return Date.now() - saved.at < SESSION_MS ? saved.result : null;
  } catch {
    return null;
  }
}

function saveResult(result: FindResult) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ at: Date.now(), result }));
  } catch {
    // Storage full or blocked: the result still shows, it is just not kept.
  }
}

function timeOf(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" }).format(
    new Date(iso),
  );
}

export function FindClient() {
  const [pending, startSearch] = useTransition();
  const [data, setData] = useState<{ result: FindResult; started: Started; fromSession: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  function search() {
    setError(null);
    startSearch(async () => {
      const kept = savedResult();
      if (kept) {
        // Only the started leads are read again: someone may have started one since.
        const started = await startedLeadsAction();
        if (started.ok) {
          setData({ result: kept, started: started.started, fromSession: true });
          return;
        }
      }
      const answer = await findTendersAction();
      if (answer.ok) {
        saveResult(answer.result);
        setData({ result: answer.result, started: answer.started, fromSession: false });
      } else setError(answer.error);
    });
  }

  function markStarted(reference: string, leadId: string) {
    setData((current) => (current ? { ...current, started: { ...current.started, [reference]: leadId } } : current));
  }

  const ranked = data?.result.ranked ?? [];
  const best = ranked.filter((r) => r.eligibility === "open" && r.fit >= GOOD_FIT);
  const weak = ranked.filter((r) => r.eligibility === "open" && r.fit < GOOD_FIT);
  const blocked = ranked.filter((r) => r.eligibility === "blocked");
  const closed = ranked.filter((r) => r.eligibility === "closed");
  const groupProps = { started: data?.started ?? {}, onStarted: markStarted };

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

      {pending && !data && (
        <p className="text-muted-foreground">
          Reading the notices and checking each one against your profile. This takes a few seconds.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-blocker/30 bg-blocker/10 px-4 py-3 text-blocker">
          {error}
        </p>
      )}

      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-muted-foreground">
            <p>
              {best.length} good {best.length === 1 ? "match" : "matches"} open for bids
              {weak.length > 0 && `, ${weak.length} other open`}
              {blocked.length > 0 && `, ${blocked.length} you are probably not eligible for`}
              {closed.length > 0 && `, ${closed.length} closed`}.
              {data.fromSession && ` Ranked at ${timeOf(data.result.rankedAt)} and kept for this session.`}
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

          {best.length === 0 && <p>No open tender is a good match for your profile right now.</p>}
          <Group title="Best matches" note={`Open for bids, fit ${GOOD_FIT} or more.`} rows={best} {...groupProps} />
          <Group
            title="Other open tenders"
            note="Little overlap with your services, tools or sectors."
            rows={weak}
            folded
            {...groupProps}
          />
          <Group
            title="Probably not eligible"
            note="Reserved for an AGPO group, or needs a licence you do not hold."
            rows={blocked}
            folded
            {...groupProps}
          />
          {showClosed && <Group title="Closed" note="The closing date has passed." rows={closed} {...groupProps} />}
        </>
      )}
    </div>
  );
}

function Group({
  title,
  note,
  rows,
  folded = false,
  started,
  onStarted,
}: {
  title: string;
  note?: string;
  rows: RankedTender[];
  /** Closed until someone opens it, so the best matches stay on the first screen. */
  folded?: boolean;
  started: Started;
  onStarted: (reference: string, leadId: string) => void;
}) {
  if (rows.length === 0) return null;
  const list = (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <Result key={row.tender.id} row={row} leadId={started[row.tender.reference] ?? null} onStarted={onStarted} />
      ))}
    </ul>
  );
  const heading = (
    <span>
      <span className="font-heading text-lg font-semibold">
        {title} <span className="text-muted-foreground">({rows.length})</span>
      </span>
      {note && <span className="block text-sm text-muted-foreground">{note}</span>}
    </span>
  );
  if (folded) {
    return (
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start gap-2 [&::-webkit-details-marker]:hidden">
          <ChevronRight className="mt-1.5 size-4 shrink-0 transition-transform group-open:rotate-90" aria-hidden />
          {heading}
        </summary>
        <div className="mt-3">{list}</div>
      </details>
    );
  }
  return (
    <section className="flex flex-col gap-3">
      <h2>{heading}</h2>
      {list}
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
            // "County Government of Nakuru · Nakuru" would say the county twice.
            tender.county && !tender.buyer.toLowerCase().includes(tender.county.toLowerCase()) ? tender.county : null,
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
        <Badge
          className={cn("h-7 px-3 text-sm tabular-nums", fitTone(row.fit, row.eligibility))}
          title="How well the notice suits your company profile, out of 100. Not a chance of winning."
        >
          Fit {row.fit} / 100
        </Badge>
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
