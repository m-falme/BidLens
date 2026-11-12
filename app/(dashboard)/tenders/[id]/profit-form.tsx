"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatKes, formatMarginPct, type DelayTableRow } from "@/lib/recommendation/profit";
import { cn } from "@/lib/utils";

import { saveTenderFiguresAction } from "./actions";

export function ProfitForm({
  tenderId,
  contractValue,
  deliveryCost,
  onTimeLabel,
  rateNote,
  bandNote,
  lateNote,
  rows,
  emptyMessage,
}: {
  tenderId: string;
  contractValue: string;
  deliveryCost: string;
  onTimeLabel: string | null;
  rateNote: string | null;
  bandNote: string | null;
  lateNote: string | null;
  rows: DelayTableRow[] | null;
  emptyMessage: string;
}) {
  const [value, setValue] = useState(contractValue);
  const [cost, setCost] = useState(deliveryCost);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveTenderFiguresAction({
        tenderId,
        contractValue: value,
        deliveryCost: cost,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="contract-value">Contract value (KES)</Label>
          <Input
            id="contract-value"
            name="contractValue"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="delivery-cost">Estimated delivery cost (KES)</Label>
          <Input
            id="delivery-cost"
            name="deliveryCost"
            inputMode="decimal"
            autoComplete="off"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
          />
        </div>
      </div>
      {rows === null ? (
        <p className="text-muted-foreground">{lateNote ?? emptyMessage}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {onTimeLabel && <p>{onTimeLabel}</p>}
          {rateNote && <p className="text-muted-foreground">{rateNote}</p>}
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <caption className="sr-only">Payment delay at 2, 6, 12 and 24 months</caption>
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Payment delay</th>
                  <th className="px-2 py-2 font-medium">Estimated finance cost</th>
                  <th className="px-2 py-2 font-medium">Scenario profit</th>
                  <th className="px-2 py-2 font-medium">Margin after finance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.months}
                    className={cn("border-b border-border/80", row.countyBand && "bg-warning/15")}
                  >
                    <td className="px-2 py-3 font-medium">
                      {row.months} months
                      {row.countyBand && <span className="mt-0.5 block text-warning">County band</span>}
                    </td>
                    <td className="px-2 py-3 tabular-nums">{formatKes(row.financingKes)}</td>
                    <td className="px-2 py-3 font-semibold tabular-nums">{formatKes(row.profitKes)}</td>
                    <td className="px-2 py-3 tabular-nums">{formatMarginPct(row.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bandNote && <p className="text-muted-foreground">{bandNote}</p>}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-blocker">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save figures"}
        </Button>
      </div>
    </form>
  );
}
