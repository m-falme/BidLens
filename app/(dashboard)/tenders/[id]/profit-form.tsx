"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { saveTenderFiguresAction } from "./actions";

export function ProfitForm({
  tenderId,
  contractValue,
  deliveryCost,
  lines,
  emptyMessage,
}: {
  tenderId: string;
  contractValue: string;
  deliveryCost: string;
  lines: string[] | null;
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
      {lines === null ? (
        <p className="text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
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
