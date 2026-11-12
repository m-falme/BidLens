"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RECOMMENDATION_LABEL,
  RECOMMENDATION_LABELS,
  type RecommendationLabel,
} from "@/lib/recommendation/labels";

import { saveBidDecisionAction } from "./actions";

export function DecisionForm({
  tenderId,
  recommendedLabel,
}: {
  tenderId: string;
  recommendedLabel: RecommendationLabel;
}) {
  const [name, setName] = useState("");
  const [finalLabel, setFinalLabel] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const choices = RECOMMENDATION_LABELS.filter((label) => label !== recommendedLabel);

  function save(action: "approve" | "override") {
    setError(null);
    startTransition(async () => {
      const result = await saveBidDecisionAction({
        tenderId,
        recommendedLabel,
        finalLabel: action === "approve" ? recommendedLabel : finalLabel,
        action,
        reason,
        reviewerName: name,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReason("");
      setFinalLabel("");
      router.refresh();
    });
  }

  return (
    <form
      className="flex flex-col gap-3 border-t pt-4"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor="decision-name">Your name</Label>
        <Input
          id="decision-name"
          name="reviewerName"
          value={name}
          autoComplete="name"
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => save("approve")}>
          {pending ? "Saving…" : "Approve"}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => save("override")}>
          Override
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="decision-label">Different label</Label>
          <select
            id="decision-label"
            name="finalLabel"
            value={finalLabel}
            onChange={(event) => setFinalLabel(event.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Choose a different label</option>
            {choices.map((label) => (
              <option key={label} value={label}>
                {RECOMMENDATION_LABEL[label]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="decision-reason">Reason, required to override</Label>
          <textarea
            id="decision-reason"
            name="reason"
            value={reason}
            rows={2}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
