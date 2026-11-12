import { Badge } from "@/components/ui/badge";
import {
  DECISION_CLASS,
  DECISION_LABEL,
  RISK_CLASS,
  RISK_LABEL,
  type DecisionChoice,
} from "@/lib/format/display";
import type { RiskBand } from "@/lib/risk/county-score";
import { cn } from "@/lib/utils";

export function DecisionBadge({ choice }: { choice: DecisionChoice | null }) {
  const label = choice ? DECISION_LABEL[choice] : "No decision yet";
  return <Badge className={cn("h-6 px-2.5", DECISION_CLASS[choice ?? "none"])}>{label}</Badge>;
}

export function RiskBadge({ band }: { band: RiskBand | null }) {
  if (!band) return <Badge className={cn("h-6 px-2.5", RISK_CLASS.unknown)}>No county score</Badge>;
  return <Badge className={cn("h-6 px-2.5", RISK_CLASS[band])}>{RISK_LABEL[band]}</Badge>;
}
