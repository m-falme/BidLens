import { RECOMMENDATION_CLASS, RECOMMENDATION_LABEL, RULE_TEXT, type Recommendation } from "@/lib/recommendation/labels";
import type { BidDecisionRecord } from "@/lib/recommendation/decision";
import { formatReviewedAt } from "@/lib/tenders/stage-review";
import { cn } from "@/lib/utils";

export function RecommendationCard({
  recommendation,
  decision,
}: {
  recommendation: Recommendation;
  decision: BidDecisionRecord | null;
}) {
  const pill = decision ? RECOMMENDATION_LABEL[decision.finalLabel] : "No decision recorded";
  const tone = decision ? RECOMMENDATION_CLASS[decision.finalLabel] : RECOMMENDATION_CLASS.none;
  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-sm font-medium", tone)}>{pill}</span>
        <span className="text-sm text-muted-foreground">Rule-based assessment</span>
      </div>
      <div>
        <h3 className="font-heading text-2xl">{RECOMMENDATION_LABEL[recommendation.label]}</h3>
        <p className="mt-1 text-muted-foreground">{RULE_TEXT[recommendation.rule]}</p>
        <p className="mt-2">
          {decision
            ? `${decision.action === "approve" ? "Approved" : "Overridden"} by ${decision.reviewerName} · ${formatReviewedAt(decision.createdAt)}`
            : "No one has approved or overridden the recommendation."}
        </p>
        {decision?.reason && <p className="mt-1">{decision.reason}</p>}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {recommendation.reasons.map((reason, index) => (
          <li key={`${reason.item}-${index}`} className="rounded-lg border border-border px-3 py-3">
            <p>{reason.text}</p>
            <p className="mt-1 text-muted-foreground">{reason.item}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
