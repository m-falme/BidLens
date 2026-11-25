"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProfileKind } from "@/lib/company/profile";
import { cn } from "@/lib/utils";

import { addCapabilityAction, removeCapabilityAction, saveLegalNameAction } from "./actions";

export function LegalNameField({ name, original }: { name: string; original: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveLegalNameAction({ name: draft });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="break-words font-medium">{name}</span>
        <button
          type="button"
          className="text-sm font-medium text-brand underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
        >
          Edit
        </button>
        {original && original !== name && <span className="text-sm text-muted-foreground">was {original}</span>}
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <Label htmlFor="legal-name" className="sr-only">
        Registered name
      </Label>
      <Input
        id="legal-name"
        value={draft}
        maxLength={120}
        autoFocus
        disabled={pending}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || draft.trim() === name}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-blocker">
          {error}
        </p>
      )}
    </form>
  );
}

export interface ProfileItem {
  id: string;
  name: string;
  addedByTeam: boolean;
}

export function CapabilityGroup({
  kind,
  title,
  addLabel,
  empty,
  items,
}: {
  kind: ProfileKind;
  title: string;
  addLabel: string;
  empty: string;
  items: readonly ProfileItem[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputId = `add-${kind}`;

  function add() {
    if (draft.trim() === "") return;
    setError(null);
    startTransition(async () => {
      const result = await addCapabilityAction({ kind, name: draft });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft("");
      router.refresh();
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeCapabilityAction({ id });
      setConfirmId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <h3 className="font-medium">
        {title} <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
      </h3>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
                item.addedByTeam
                  ? "border-dashed border-foreground/30 bg-muted text-foreground"
                  : "border-confirmed/25 bg-confirmed/8 text-confirmed",
              )}
              title={item.addedByTeam ? "Added by your team. Not checked." : "Stated in your company profile."}
            >
              {item.name}
              {item.addedByTeam && confirmId !== item.id && (
                <button
                  type="button"
                  aria-label={`Remove ${item.name}`}
                  className="-mr-1 rounded-full p-0.5 text-muted-foreground hover:text-blocker focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  disabled={pending}
                  onClick={() => setConfirmId(item.id)}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
              {item.addedByTeam && confirmId === item.id && (
                <span className="inline-flex items-center gap-2 pl-1">
                  <span className="text-muted-foreground">Remove?</span>
                  <button
                    type="button"
                    className="font-medium text-blocker underline-offset-4 hover:underline"
                    disabled={pending}
                    onClick={() => remove(item.id)}
                  >
                    {pending ? "Removing…" : "Yes"}
                  </button>
                  <button
                    type="button"
                    className="font-medium underline-offset-4 hover:underline"
                    disabled={pending}
                    onClick={() => setConfirmId(null)}
                  >
                    No
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <Label htmlFor={inputId} className="sr-only">
          {addLabel}
        </Label>
        <Input
          id={inputId}
          className="h-9 max-w-xs"
          placeholder={addLabel}
          value={draft}
          maxLength={120}
          disabled={pending}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" variant="outline" disabled={pending || draft.trim() === ""}>
          <Plus aria-hidden /> Add
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-1 text-sm text-blocker">
          {error}
        </p>
      )}
    </div>
  );
}
