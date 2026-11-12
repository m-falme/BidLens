"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ReviewStage } from "@/lib/tenders/stage-review";

import { saveStageReview } from "./actions";

export function StageReviewForm({
  tenderId,
  stage,
  reviewedLabel,
}: {
  tenderId: string;
  stage: ReviewStage;
  reviewedLabel: string | null;
}) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const nameId = `reviewer-${stage}`;
  const noteId = `note-${stage}`;

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveStageReview({ tenderId, stage, reviewerName: name, note });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNote("");
      router.refresh();
    });
  }

  return (
    <form
      className="flex w-full shrink-0 flex-col gap-2 lg:w-72"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {reviewedLabel && (
        <p className="flex items-start gap-1.5 text-sm font-medium text-primary">
          <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{reviewedLabel}</span>
        </p>
      )}
      <div className="flex flex-col gap-1">
        <Label htmlFor={nameId}>Your name</Label>
        <Input id={nameId} name="reviewerName" value={name} autoComplete="name" onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={noteId}>Note, optional</Label>
        <textarea
          id={noteId}
          name="note"
          value={note}
          rows={2}
          onChange={(event) => setNote(event.target.value)}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Mark as reviewed"}
      </Button>
    </form>
  );
}
