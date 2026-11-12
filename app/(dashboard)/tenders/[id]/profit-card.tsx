import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PROFIT_EMPTY, profitCopy } from "@/lib/recommendation/profit";
import type { RiskBand } from "@/lib/risk/county-score";

import { ProfitForm } from "./profit-form";

function kesInput(value: number | null): string {
  if (value === null) return "";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function ProfitCard({
  tenderId,
  contractValueKes,
  deliveryCostKes,
  band,
}: {
  tenderId: string;
  contractValueKes: number | null;
  deliveryCostKes: number | null;
  band: RiskBand | null;
}) {
  const lines = profitCopy({ contractValueKes, deliveryCostKes, band });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Profit</CardTitle>
        <CardDescription>
          Saved for this tender. On-time profit and late profit use the margin calculation and this county&apos;s
          payment-delay scenario.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProfitForm
          tenderId={tenderId}
          contractValue={kesInput(contractValueKes)}
          deliveryCost={kesInput(deliveryCostKes)}
          lines={lines}
          emptyMessage={PROFIT_EMPTY}
        />
      </CardContent>
    </Card>
  );
}
