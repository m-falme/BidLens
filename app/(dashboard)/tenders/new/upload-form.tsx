"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type DragEvent } from "react";
import { AlertTriangle, FileText, Loader2, UploadCloud } from "lucide-react";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AddendumTarget } from "@/lib/db/queries/tenders";
import { getBrowserClient } from "@/lib/db/supabase-browser";
import type { SourceRole } from "@/lib/db/vocab";
import { cn } from "@/lib/utils";

import { prepareTenderUpload, registerTenderUpload } from "./actions";

const MAX_MB = 25;

type Phase = "idle" | "uploading" | "reading" | "done";

function checkFile(file: File): string | null {
  const isPdf = file.type === "application/pdf" || (file.type === "" && /\.pdf$/i.test(file.name));
  if (!isPdf || !/\.pdf$/i.test(file.name)) return "Only PDF files can be uploaded.";
  if (file.size === 0) return "The file is empty.";
  if (file.size > MAX_MB * 1024 * 1024) return `The file is larger than ${MAX_MB} MB.`;
  return null;
}

export function UploadForm({
  targets,
  defaultAddendumFor,
}: {
  targets: AddendumTarget[];
  defaultAddendumFor: string | null;
}) {
  const router = useRouter();
  const inputId = useId();
  const initialTarget = targets.some((t) => t.id === defaultAddendumFor) ? defaultAddendumFor : null;
  const [role, setRole] = useState<SourceRole>(initialTarget ? "addendum" : "main");
  const [opportunityId, setOpportunityId] = useState<string>(initialTarget ?? targets[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ opportunityId: string | null; originalName: string } | null>(null);

  const busy = phase === "uploading" || phase === "reading";

  function pick(candidate: File | undefined) {
    setError(null);
    setDuplicate(null);
    if (!candidate) return;
    const problem = checkFile(candidate);
    if (problem) {
      setFile(null);
      setError(problem);
      return;
    }
    setFile(candidate);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (!busy) pick(event.dataTransfer.files[0]);
  }

  async function submit() {
    if (!file) return;
    setError(null);
    setDuplicate(null);
    const target = { role, opportunityId: role === "addendum" ? opportunityId || null : null };
    try {
      setPhase("uploading");
      const prepared = await prepareTenderUpload({
        ...target,
        fileName: file.name,
        size: file.size,
        contentType: file.type,
      });
      if (!prepared.ok) throw new Error(prepared.error);

      const { error: uploadError } = await getBrowserClient()
        .storage.from("sources")
        .uploadToSignedUrl(prepared.data.path, prepared.data.token, file, { contentType: "application/pdf" });
      if (uploadError) throw new Error("The file could not be uploaded to storage. Please try again.");

      setPhase("reading");
      const registered = await registerTenderUpload({ ...target, path: prepared.data.path, originalName: file.name });
      if (!registered.ok) throw new Error(registered.error);
      if (registered.data.status === "duplicate") {
        setDuplicate(registered.data);
        setPhase("idle");
        return;
      }
      setPhase("done");
      router.push(`/tenders/${registered.data.opportunityId}`);
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "The upload failed. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3" disabled={busy}>
        <legend className="mb-2 font-medium">What are you uploading?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["main", "A new tender", "The main tender document. Creates a new tender."],
              ["addendum", "An addendum", "Changes to a tender already uploaded. Conflicts are flagged, never merged."],
            ] as const
          ).map(([value, title, hint]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRole(value)}
              disabled={value === "addendum" && targets.length === 0}
              aria-pressed={role === value}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                role === value ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-border hover:bg-muted",
              )}
            >
              <span className="block font-medium">{title}</span>
              <span className="block text-sm text-muted-foreground">
                {value === "addendum" && targets.length === 0 ? "Upload a main tender document first." : hint}
              </span>
            </button>
          ))}
        </div>

        {role === "addendum" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${inputId}-tender`}>Tender this addendum belongs to</Label>
            <select
              id={`${inputId}-tender`}
              value={opportunityId}
              onChange={(e) => setOpportunityId(e.target.value)}
              className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {targets.map((t) => {
                const label = `${t.reference ? `${t.reference} · ` : ""}${t.title}`;
                return (
                  <option key={t.id} value={t.id}>
                    {label.length > 110 ? `${label.slice(0, 107)}…` : label}
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </fieldset>

      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors focus-within:ring-3 focus-within:ring-ring/50",
          dragging ? "border-brand bg-brand/5" : "border-border hover:bg-muted/50",
          busy && "pointer-events-none opacity-60",
        )}
      >
        {file ? (
          <FileText className="size-10 text-brand" aria-hidden />
        ) : (
          <UploadCloud className="size-10 text-muted-foreground" aria-hidden />
        )}
        {file ? (
          <span>
            <span className="block font-medium">{file.name}</span>
            <span className="text-sm text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(1)} MB · click or drop to replace
            </span>
          </span>
        ) : (
          <span>
            <span className="block font-medium">Drop a tender PDF here, or click to choose</span>
            <span className="text-sm text-muted-foreground">PDF only, up to {MAX_MB} MB</span>
          </span>
        )}
        <input
          id={inputId}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertTitle>Upload not saved</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {duplicate && (
        <Alert>
          <AlertTriangle aria-hidden />
          <AlertTitle>This exact file was uploaded before</AlertTitle>
          <AlertDescription>
            It matches “{duplicate.originalName}”. Nothing new was created or merged.{" "}
            {duplicate.opportunityId && (
              <Link href={`/tenders/${duplicate.opportunityId}`} className="font-medium text-brand underline">
                Open the existing tender
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-4">
        <Button size="lg" onClick={submit} disabled={!file || busy || (role === "addendum" && !opportunityId)}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {phase === "uploading" ? "Uploading…" : phase === "reading" ? "Reading pages…" : "Upload and extract"}
        </Button>
        {busy && (
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {phase === "uploading"
              ? "Sending the file to secure storage."
              : "Extracting the text of every page so each quote can be checked."}
          </span>
        )}
      </div>
    </div>
  );
}
