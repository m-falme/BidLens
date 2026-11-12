"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { addRequirementDocument } from "../../company/actions";

export function AddDocumentButton({ requirement }: { requirement: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function add() {
    setError(null);
    startTransition(async () => {
      const result = await addRequirementDocument({ requirement });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className="h-8 rounded-lg border border-primary px-3 text-sm font-medium text-primary disabled:opacity-50"
        disabled={pending}
        onClick={add}
      >
        {pending ? "Adding…" : "Add to my documents"}
      </button>
      {error && <span className="text-sm text-red-700">{error}</span>}
    </span>
  );
}
