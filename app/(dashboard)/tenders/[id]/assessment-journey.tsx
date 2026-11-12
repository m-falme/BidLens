import type { LucideIcon } from "lucide-react";
import { BarChart3, Check, ChevronRight, FileSearch, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { formatReviewedAt, REVIEW_STAGES, type ReviewStage, type StageReviewRecord } from "@/lib/tenders/stage-review";

import { StageReviewForm } from "./stage-review-form";

const STAGE_META: Record<ReviewStage, { title: string; agent: string; summary: string; icon: LucideIcon }> = {
  can_bid: {
    title: "Can we bid?",
    agent: "Tender Interpretation Agent",
    summary: "Extracts and explains key tender requirements.",
    icon: FileSearch,
  },
  can_comply: {
    title: "Can we comply?",
    agent: "Compliance Agent",
    summary: "Checks eligibility, highlights gaps and risks.",
    icon: ShieldCheck,
  },
  should_bid: {
    title: "Should we bid?",
    agent: "Commercial Agent",
    summary: "Assesses viability and potential financial strain, like delayed payments.",
    icon: BarChart3,
  },
};

export function AssessmentStepper({
  reviews,
}: {
  reviews: Record<ReviewStage, StageReviewRecord | null>;
}) {
  return (
    <nav aria-label="Assessment steps">
      <ol className="flex flex-col gap-2 md:flex-row md:items-stretch">
        {REVIEW_STAGES.map((stage, index) => {
          const meta = STAGE_META[stage];
          const review = reviews[stage];
          const when = review ? formatReviewedAt(review.createdAt) : null;
          return (
            <li key={stage} className="flex min-w-0 flex-1 items-center gap-2">
              {index > 0 && <ChevronRight className="hidden size-5 shrink-0 text-primary md:block" aria-hidden />}
              <a
                href={`#${stage}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm transition hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span
                  className={
                    review
                      ? "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      : "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                  }
                >
                  {review ? <Check className="size-4" aria-hidden /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{meta.title}</span>
                  <span className="block text-sm text-muted-foreground">
                    {when ? `Reviewed ${when}` : meta.agent}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function AgentSection({
  stage,
  tenderId,
  finding,
  review,
  children,
}: {
  stage: ReviewStage;
  tenderId: string;
  finding: string;
  review: StageReviewRecord | null;
  children: ReactNode;
}) {
  const meta = STAGE_META[stage];
  const Icon = meta.icon;
  const reviewedLabel = review
    ? `Reviewed by ${review.reviewerName} · ${formatReviewedAt(review.createdAt)}`
    : null;

  return (
    <section id={stage} className="flex scroll-mt-20 flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-primary">
              Step {REVIEW_STAGES.indexOf(stage) + 1} · {meta.agent}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">{meta.title}</h2>
            <p className="text-muted-foreground">{meta.summary}</p>
            <p className="pt-1">
              <span className="font-medium">What I found: </span>
              {finding}
            </p>
          </div>
        </div>
        <StageReviewForm tenderId={tenderId} stage={stage} reviewedLabel={reviewedLabel} />
      </div>
      {children}
    </section>
  );
}
