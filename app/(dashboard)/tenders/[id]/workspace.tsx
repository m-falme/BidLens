"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";

import { ClosedBadge } from "@/components/tenders/markers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RECOMMENDATION_LABEL,
  RECOMMENDATION_LABELS,
  type RecommendationLabel,
} from "@/lib/recommendation/labels";
import { evidenceLibraryHref } from "@/lib/tenders/evidence-return";
import {
  WORKSPACE_TABS,
  approveToast,
  hashForTab,
  nextTab,
  preparationToast,
  reviewStageForTab,
  reviewStageNumber,
  stageHeading,
  stageMark,
  tabFromHash,
  tabFromStage,
  type WorkspaceApproval,
  type WorkspaceTabId,
} from "@/lib/tenders/workspace-stages";
import { cn } from "@/lib/utils";

import { saveBidDecisionAction, saveStageReview } from "./actions";

const DEFAULT_REVIEWER = "Bid manager";
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

const hashListeners = new Set<() => void>();

function subscribeHash(onChange: () => void) {
  hashListeners.add(onChange);
  window.addEventListener("hashchange", onChange);
  return () => {
    hashListeners.delete(onChange);
    window.removeEventListener("hashchange", onChange);
  };
}

function notifyHash() {
  for (const listener of hashListeners) listener();
}

function hashSnapshot() {
  return window.location.hash;
}

export function TenderWorkspace({
  tenderId,
  requestedStage,
  title,
  buyer,
  reference,
  closing,
  closed,
  decisionLabel,
  needsHumanReview,
  addendumHref,
  approval,
  heads,
  recommendedLabel,
  planDone,
  planTotal,
  interpretation,
  compliance,
  commercial,
  recommendation,
  preparation,
}: {
  tenderId: string;
  /** `?stage=` from the tender URL. Opens that stage when it names one. */
  requestedStage?: string | null;
  title: string;
  buyer: string;
  reference: string;
  closing: string;
  closed: boolean;
  /** The saved decision label, once a bid decision exists. */
  decisionLabel: string | null;
  /** No source-confirmed facts, or no mandatory requirements. Approve stays off. */
  needsHumanReview: boolean;
  addendumHref: string;
  approval: WorkspaceApproval;
  heads: Record<WorkspaceTabId, { title: string; summary: string }>;
  recommendedLabel: RecommendationLabel;
  planDone: number;
  planTotal: number;
  interpretation: ReactNode;
  compliance: ReactNode;
  commercial: ReactNode;
  recommendation: ReactNode;
  preparation: ReactNode;
}) {
  const router = useRouter();
  const hash = useSyncExternalStore(subscribeHash, hashSnapshot, () => "");
  const fromQuery = tabFromStage(requestedStage);
  const active =
    fromQuery ??
    tabFromHash(hash) ??
    WORKSPACE_TABS[reviewStageNumber(approval) - 1]?.id ??
    "interpretation";
  const [name, setName] = useState(DEFAULT_REVIEWER);
  const [note, setNote] = useState("");
  const [noteStage, setNoteStage] = useState<WorkspaceTabId>("commercial");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [finalLabel, setFinalLabel] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const nameId = useId();
  const noteId = useId();

  const panels: Record<WorkspaceTabId, ReactNode> = {
    interpretation,
    compliance,
    commercial,
    recommendation,
    preparation,
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!modalOpen) return;
    noteRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setModalOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>("button, input, select, textarea")].filter(
        (el) => !el.hasAttribute("disabled"),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  function select(id: WorkspaceTabId) {
    setError(null);
    const url = new URL(window.location.href);
    url.searchParams.set("stage", id);
    url.hash = hashForTab(id);
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (current !== next) router.push(next, { scroll: false });
    notifyHash();
  }

  useEffect(() => {
    if (fromQuery) return;
    const url = new URL(window.location.href);
    url.searchParams.set("stage", active);
    url.hash = hashForTab(active);
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (current === next) return;
    router.replace(next, { scroll: false });
  }, [active, fromQuery, router]);

  function saveNote() {
    setModalError(null);
    const stage = reviewStageForTab(active) ?? reviewStageForTab(noteStage);
    if (!stage) return;
    if (note.trim().length === 0) {
      setModalError("Enter a note.");
      noteRef.current?.focus();
      return;
    }
    startTransition(async () => {
      const result = await saveStageReview({ tenderId, stage, reviewerName: name, note });
      if (!result.ok) {
        setModalError(result.error);
        return;
      }
      setNote("");
      setModalOpen(false);
      setToast("Review note recorded.");
      router.refresh();
    });
  }

  function approveReview() {
    setError(null);
    if (active === "preparation") {
      setToast(preparationToast(planDone, planTotal));
      return;
    }
    if (active === "recommendation") {
      startTransition(async () => {
        const result = await saveBidDecisionAction({
          tenderId,
          recommendedLabel,
          finalLabel: recommendedLabel,
          action: "approve",
          reason: "",
          reviewerName: name,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setToast("Decision recorded.");
        const next = nextTab(active);
        if (next) select(next);
        router.refresh();
      });
      return;
    }
    const stage = reviewStageForTab(active);
    if (!stage) return;
    startTransition(async () => {
      const result = await saveStageReview({ tenderId, stage, reviewerName: name, note: "" });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setToast(approveToast(active));
      const next = nextTab(active);
      if (next) select(next);
      router.refresh();
    });
  }

  function saveOverride() {
    setError(null);
    startTransition(async () => {
      const result = await saveBidDecisionAction({
        tenderId,
        recommendedLabel,
        finalLabel,
        action: "override",
        reason,
        reviewerName: name,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReason("");
      setFinalLabel("");
      setToast("Decision recorded.");
      router.refresh();
    });
  }

  const evidenceHref = active === "interpretation" ? addendumHref : evidenceLibraryHref(tenderId, active);
  const choices = RECOMMENDATION_LABELS.filter((label) => label !== recommendedLabel);
  const noteOnThisStage = reviewStageForTab(active) !== null;
  const footNote = needsHumanReview
    ? "Needs human review"
    : active === "recommendation"
      ? "A person approves or overrides this recommendation. Nothing is submitted."
      : active === "preparation"
        ? preparationToast(planDone, planTotal)
        : `Review, question or add evidence before approving ${heads[active].title.toLowerCase()}.`;

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-[0_8px_28px_rgba(23,32,42,0.05)]">
      <div className="px-5 py-4">
        <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-confirmed">
          <span className="size-2 rounded-full bg-confirmed" aria-hidden />
          {stageHeading(active, decisionLabel)}
        </p>
        <h2 className="font-heading mt-2 text-2xl tracking-tight break-words">{title}</h2>
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <div>
            Buyer <span className="font-semibold text-foreground">{buyer}</span>
          </div>
          <div>
            Ref <span className="font-semibold text-foreground">{reference}</span>
          </div>
          <div className="flex items-center gap-2">
            Closing <span className="font-semibold text-foreground">{closing}</span>
            {closed && <ClosedBadge />}
          </div>
        </dl>
      </div>

      <div className="flex min-w-0 items-center gap-1 overflow-x-auto border-y border-border px-4 py-3" aria-label="Stage progress">
        {WORKSPACE_TABS.map((tab, index) => {
          const mark = stageMark(tab.id, approval);
          return (
            <div key={tab.id} className="flex min-w-36 flex-1 items-center">
              {index > 0 && <span className="mx-1 hidden h-px w-4 shrink-0 bg-border sm:block" aria-hidden />}
              <button
                type="button"
                onClick={() => select(tab.id)}
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-md px-1 py-1 text-left text-sm",
                  FOCUS_RING,
                  mark === "done" && "text-confirmed",
                  mark === "current" && "font-semibold text-foreground",
                  mark === "waiting" && "text-muted-foreground",
                  active === tab.id && "underline decoration-brand decoration-2 underline-offset-4",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-sm",
                    mark === "done" && "border-confirmed bg-confirmed text-primary-foreground",
                    mark === "current" && "border-brand bg-brand/20 font-semibold text-foreground",
                    mark === "waiting" && "border-border bg-card text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {mark === "done" ? "✓" : index + 1}
                </span>
                <span className="truncate">{tab.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      <div role="tablist" aria-label="Review stages" className="flex min-w-0 flex-wrap gap-1 border-b border-border px-3 py-2">
        {WORKSPACE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`stage-tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`stage-panel-${tab.id}`}
            onClick={() => select(tab.id)}
            className={cn(
              "rounded-md px-3 py-2 text-sm whitespace-nowrap",
              FOCUS_RING,
              active === tab.id ? "bg-confirmed/10 font-semibold text-confirmed" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-5 pt-4">
        <h3 className="font-heading text-xl">{heads[active].title}</h3>
        <p className="mt-1 text-muted-foreground">{heads[active].summary}</p>
      </div>

      <div
        role="tabpanel"
        id={`stage-panel-${active}`}
        aria-labelledby={`stage-tab-${active}`}
        className="mt-2 min-w-0"
      >
        {panels[active]}
      </div>

      <div className="mt-2 flex flex-col gap-3 border-t border-border bg-muted/40 px-4 py-3">
        {active === "recommendation" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="override-label">Different label</Label>
              <select
                id="override-label"
                value={finalLabel}
                onChange={(event) => setFinalLabel(event.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Choose a different label</option>
                {choices.map((label) => (
                  <option key={label} value={label}>
                    {RECOMMENDATION_LABEL[label]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="override-reason">Reason, required to override</Label>
              <textarea
                id="override-reason"
                value={reason}
                rows={2}
                onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-lg border border-input bg-card px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-sm text-muted-foreground">{footNote}</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor={nameId} className="text-muted-foreground">
                Your name
              </Label>
              <Input
                id={nameId}
                value={name}
                autoComplete="name"
                onChange={(event) => setName(event.target.value)}
                className="h-9 w-40 bg-card"
              />
            </div>
            <Button type="button" variant="outline" disabled={pending} onClick={() => { setModalError(null); setModalOpen(true); }}>
              Ask / correct
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href={evidenceHref} />}>
              ＋ Evidence
            </Button>
            {active === "recommendation" ? (
              <>
                <Button type="button" variant="outline" disabled={pending} onClick={saveOverride}>
                  {pending ? "Saving…" : "Override with reason"}
                </Button>
                <Button type="button" disabled={pending || needsHumanReview} onClick={approveReview}>
                  {pending ? "Saving…" : "Approve"}
                </Button>
              </>
            ) : (
              <Button type="button" disabled={pending || needsHumanReview} onClick={approveReview}>
                {pending ? "Saving…" : active === "preparation" ? "Bid preparation reviewed" : "Approve stage →"}
              </Button>
            )}
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-blocker">
            {error}
          </p>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17202A]/45 p-5"
          role="presentation"
          onClick={() => setModalOpen(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-[0_20px_60px_rgba(23,32,42,0.2)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id={titleId} className="font-heading text-xl">
              Question or correct a finding
            </h3>
            <p className="mt-2 text-muted-foreground">
              The note is saved on the review and shown on the decision trail. Extraction is not run again.
            </p>
            <div className="mt-4 flex flex-col gap-1">
              <Label htmlFor={`${nameId}-modal`}>Your name</Label>
              <Input
                id={`${nameId}-modal`}
                value={name}
                autoComplete="name"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            {!noteOnThisStage && (
              <div className="mt-3 flex flex-col gap-1">
                <Label htmlFor="note-stage">Save this note on</Label>
                <select
                  id="note-stage"
                  value={noteStage}
                  onChange={(event) => setNoteStage(event.target.value as WorkspaceTabId)}
                  className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {WORKSPACE_TABS.filter((tab) => tab.review).map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="mt-3 flex flex-col gap-1">
              <Label htmlFor={noteId}>Note</Label>
              <textarea
                ref={noteRef}
                id={noteId}
                value={note}
                rows={4}
                onChange={(event) => setNote(event.target.value)}
                placeholder="What looks wrong, or what a reviewer should know."
                className="w-full rounded-lg border border-input bg-card px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            {modalError && (
              <p role="alert" className="mt-2 text-sm text-blocker">
                {modalError}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={pending} onClick={saveNote}>
                {pending ? "Saving…" : "Save note"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-foreground px-4 py-3 text-background shadow-lg"
        >
          {toast}
        </div>
      )}
    </section>
  );
}
