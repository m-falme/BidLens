import { Badge } from "@/components/ui/badge";
import { planDoneText, preparationPill, type PlanState } from "@/lib/plan/state";
import { RECOMMENDATION_CLASS, RECOMMENDATION_LABEL, type RecommendationLabel } from "@/lib/recommendation/labels";
import { RISK_CLASS, riskChipLabel } from "@/lib/format/display";
import type { RiskBand } from "@/lib/risk/county-score";
import { cn } from "@/lib/utils";

/** The recorded decision. After "Proceed to preparation" it shows how far bid preparation has got. */
export function DecisionBadge({ label, plan }: { label: RecommendationLabel | null; plan?: PlanState | null }) {
  const preparing = preparationPill(label, plan);
  if (preparing) {
    const tone = preparing.ready ? RECOMMENDATION_CLASS.proceed_to_preparation : RECOMMENDATION_CLASS.seek_clarification;
    return <Badge className={cn("h-6 px-2.5", tone)}>{preparing.label}</Badge>;
  }
  const text = label ? RECOMMENDATION_LABEL[label] : "No decision yet";
  return <Badge className={cn("h-6 px-2.5", RECOMMENDATION_CLASS[label ?? "none"])}>{text}</Badge>;
}

/** "3 of 8 done" and, once ticked, a small "Bid security paid ✓". Nothing when the tender has no plan. */
export function PlanMarks({ plan }: { plan: PlanState | null | undefined }) {
  const text = planDoneText(plan);
  if (!text) return null;
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span className="tabular-nums">{text}</span>
      {plan?.bidSecurityPaid && (
        <Badge className="h-6 bg-confirmed/10 px-2.5 text-confirmed">Bid security paid ✓</Badge>
      )}
    </span>
  );
}

export function RiskBadge({ band }: { band: RiskBand | null }) {
  const tone = band ?? "unknown";
  return <Badge className={cn("h-6 px-2.5", RISK_CLASS[tone])}>{riskChipLabel(band)}</Badge>;
}

export function ClosedBadge() {
  return <Badge className="h-6 bg-muted px-2.5 text-muted-foreground">Closed</Badge>;
}
