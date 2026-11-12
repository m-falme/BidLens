import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RECOMMENDATION_LABEL, RULE_TEXT, type Recommendation } from "@/lib/recommendation/labels";

import { DecisionForm } from "./decision-form";

export function RecommendationCard({
  tenderId,
  recommendation,
}: {
  tenderId: string;
  recommendation: Recommendation;
}) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <p className="text-sm text-muted-foreground">Recommendation</p>
        <CardTitle className="text-3xl">{RECOMMENDATION_LABEL[recommendation.label]}</CardTitle>
        <CardDescription>Rule: {RULE_TEXT[recommendation.rule]}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-3">
          {recommendation.reasons.map((reason, index) => (
            <li key={`${reason.item}-${index}`} className="flex flex-col gap-1">
              <p>{reason.text}</p>
              <p className="text-muted-foreground">{reason.item}</p>
            </li>
          ))}
        </ul>
        <DecisionForm tenderId={tenderId} recommendedLabel={recommendation.label} />
      </CardContent>
    </Card>
  );
}
