import { Badge } from "@/components/ui/badge";
import { RECOMMENDATION_CLASS, RECOMMENDATION_LABEL, type RecommendationLabel } from "@/lib/recommendation/labels";
import { RISK_CLASS, riskChipLabel } from "@/lib/format/display";
import type { RiskBand } from "@/lib/risk/county-score";
import { cn } from "@/lib/utils";

export function DecisionBadge({ label }: { label: RecommendationLabel | null }) {
  const text = label ? RECOMMENDATION_LABEL[label] : "No decision yet";
  return <Badge className={cn("h-6 px-2.5", RECOMMENDATION_CLASS[label ?? "none"])}>{text}</Badge>;
}

export function RiskBadge({ band }: { band: RiskBand | null }) {
  const tone = band ?? "unknown";
  return <Badge className={cn("h-6 px-2.5", RISK_CLASS[tone])}>{riskChipLabel(band)}</Badge>;
}

export function ClosedBadge() {
  return <Badge className="h-6 bg-muted px-2.5 text-muted-foreground">Closed</Badge>;
}
