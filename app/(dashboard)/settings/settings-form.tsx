"use client";

import { Check, Lock } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";

import { CARD_CLASS } from "@/components/app-shell/page-heading";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ratePercentText, type WorkspaceSettings } from "@/lib/settings/schema";

import { saveSettingsAction } from "./actions";

/** Product rules that cannot be switched off. Shown so a company can see what a person always does. */
const LOCKED_GATES: readonly { title: string; detail: string }[] = [
  {
    title: "A person records the bid decision",
    detail: "The recommendation is a suggestion. A named person approves it, or overrides it with a reason.",
  },
  {
    title: "Status comes from the quote check",
    detail: "A fact is Confirmed only when its quote is found on the cited page. Otherwise a person checks it.",
  },
  {
    title: "Nothing leaves the workspace",
    detail: "No bid is submitted and no email is sent from BidLens Tenders.",
  },
];

interface Draft {
  ratePercent: string;
  requireStageReviews: boolean;
  autoStartAnalysis: boolean;
  alertClosing: boolean;
  closingDays: string;
  alertDocuments: boolean;
  documentDays: string;
}

function toDraft(settings: WorkspaceSettings): Draft {
  return {
    ratePercent: ratePercentText(settings.financingRate),
    requireStageReviews: settings.requireStageReviews,
    autoStartAnalysis: settings.autoStartAnalysis,
    alertClosing: settings.alertClosing,
    closingDays: String(settings.alertClosingDays),
    alertDocuments: settings.alertDocuments,
    documentDays: String(settings.alertDocumentsDays),
  };
}

function toPayload(draft: Draft) {
  const number = (text: string) => (text.trim() === "" ? Number.NaN : Number(text));
  return {
    financingRatePercent: number(draft.ratePercent),
    requireStageReviews: draft.requireStageReviews,
    autoStartAnalysis: draft.autoStartAnalysis,
    alertClosing: draft.alertClosing,
    alertClosingDays: number(draft.closingDays),
    alertDocuments: draft.alertDocuments,
    alertDocumentsDays: number(draft.documentDays),
  };
}

function Group({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className={CARD_CLASS}>
      <div className="px-5 pt-5 pb-2">
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{note}</p>
      </div>
      <div className="px-5 pb-3">{children}</div>
    </section>
  );
}

function Row({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-border/80 py-3 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

export function SettingsForm({ initial }: { initial: WorkspaceSettings }) {
  const [saved, setSaved] = useState<Draft>(() => toDraft(initial));
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  /** Saves the whole form. On a refusal the form returns to the last saved values. */
  function save(next: Draft) {
    setDraft(next);
    setMessage(null);
    startTransition(async () => {
      const result = await saveSettingsAction(toPayload(next));
      if (!result.ok) {
        setDraft(saved);
        setMessage({ kind: "error", text: result.error });
        return;
      }
      setSaved(next);
      setMessage({ kind: "ok", text: "Saved." });
    });
  }

  function flip(key: "requireStageReviews" | "autoStartAnalysis" | "alertClosing" | "alertDocuments") {
    save({ ...draft, [key]: !draft[key] });
  }

  function commit(key: "ratePercent" | "closingDays" | "documentDays") {
    if (draft[key] !== saved[key]) save(draft);
  }

  function numberField(
    key: "ratePercent" | "closingDays" | "documentDays",
    id: string,
    label: string,
    unit: string,
    disabled = false,
  ) {
    return (
      <>
        <Label htmlFor={id} className="sr-only">
          {label}
        </Label>
        <Input
          id={id}
          inputMode="decimal"
          className="h-9 w-20 text-right"
          value={draft[key]}
          disabled={disabled}
          onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
          onBlur={() => commit(key)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit(key);
          }}
        />
        <span className="text-sm text-muted-foreground">{unit}</span>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="min-h-6 text-sm" role="status" aria-live="polite">
        {pending && <span className="text-muted-foreground">Saving…</span>}
        {!pending && message?.kind === "ok" && <span className="text-confirmed">{message.text}</span>}
        {!pending && message?.kind === "error" && (
          <span role="alert" className="text-blocker">
            {message.text}
          </span>
        )}
      </div>

      <Group
        title="Money assumptions"
        note="Used for the profit and the table headed What if payment is delayed on the Commercial stage."
      >
        <Row
          title="Loan rate"
          detail="The yearly rate used to price a late payment. Your company profile has no loan rate, so it is set here. The formulas do not change."
        >
          {numberField("ratePercent", "loan-rate", "Loan rate, percent a year", "% a year")}
        </Row>
      </Group>

      <Group title="Review gates" note="Human review. The first three are always on.">
        {LOCKED_GATES.map((gate) => (
          <div key={gate.title} className="flex gap-3 border-t border-border/80 py-3 first:border-t-0">
            <span
              className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-confirmed/10 text-confirmed"
              aria-hidden
            >
              <Check className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{gate.title}</p>
              <p className="text-sm text-muted-foreground">{gate.detail}</p>
            </div>
            <span className="inline-flex h-fit shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium text-muted-foreground">
              <Lock className="size-3" aria-hidden /> Always on
            </span>
          </div>
        ))}
        <Row
          title="Review every stage before a decision"
          detail="When on, a bid decision can be recorded only after Interpretation, Compliance and Commercial have each been reviewed."
        >
          <Switch
            aria-label="Review every stage before a decision"
            checked={draft.requireStageReviews}
            onCheckedChange={() => flip("requireStageReviews")}
          />
        </Row>
      </Group>

      <Group title="Automation" note="What BidLens does on its own. It never submits a bid or sends an email.">
        <Row
          title="Start analysis when a tender opens"
          detail="When off, a tender stays unread until someone presses Start analysis on its page."
        >
          <Switch
            aria-label="Start analysis when a tender opens"
            checked={draft.autoStartAnalysis}
            onCheckedChange={() => flip("autoStartAnalysis")}
          />
        </Row>
      </Group>

      <Group title="Alerts" note="Shown under “Your next actions” on Overview. BidLens sends no email or message.">
        <Row title="Tender closing soon" detail="Flag a tender whose closing date is within this many days.">
          {numberField("closingDays", "closing-days", "Days before closing", "days", !draft.alertClosing)}
          <Switch
            aria-label="Tender closing soon"
            checked={draft.alertClosing}
            onCheckedChange={() => flip("alertClosing")}
          />
        </Row>
        <Row title="Company document expiring" detail="Flag documents marked Have that expire within this many days.">
          {numberField("documentDays", "document-days", "Days before expiry", "days", !draft.alertDocuments)}
          <Switch
            aria-label="Company document expiring"
            checked={draft.alertDocuments}
            onCheckedChange={() => flip("alertDocuments")}
          />
        </Row>
      </Group>
    </div>
  );
}
