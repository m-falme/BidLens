import { Badge } from "@/components/ui/badge";
import { RECOMMENDATION_CLASS, RECOMMENDATION_LABEL, type RecommendationLabel } from "@/lib/recommendation/labels";
import { RISK_CLASS, RISK_LABEL } from "@/lib/format/display";
import type { RiskBand } from "@/lib/risk/county-score";
import { cn } from "@/lib/utils";

export function DecisionBadge({ label }: { label: RecommendationLabel | null }) {
  const text = label ? RECOMMENDATION_LABEL[label] : "No decision yet";
  return <Badge className={cn("h-6 px-2.5", RECOMMENDATION_CLASS[label ?? "none"])}>{text}</Badge>;
}

export function RiskBadge({ band }: { band: RiskBand | null }) {
  if (!band) return <Badge className={cn("h-6 px-2.5", RISK_CLASS.unknown)}>No county score</Badge>;
  return <Badge className={cn("h-6 px-2.5", RISK_CLASS[band])}>{RISK_LABEL[band]}</Badge>;
}
