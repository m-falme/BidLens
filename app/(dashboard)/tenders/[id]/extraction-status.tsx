"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, RotateCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ExtractionRunStatus, SourceRole } from "@/lib/db/vocab";

export interface SourceStatus {
  id: string;
  name: string;
  role: SourceRole;
  pages: number;
  needsOcrPages: number[];
  run: {
    status: ExtractionRunStatus;
    error: string | null;
    seconds: number | null;
    facts: number;
  } | null;
}

export function ExtractionStatus({ opportunityId, sources }: { opportunityId: string; sources: SourceStatus[] }) {
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const autoStarted = useRef(false);

  const pending = sources.some((s) => s.run === null);
  const runningElsewhere = sources.some((s) => s.run?.status === "running");

  async function extract() {
    setRequesting(true);
    setError(null);
    setElapsed(0);
    try {
      const response = await fetch(`/api/tenders/${opportunityId}/extract`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) setError(body?.error ?? `Extraction failed (HTTP ${response.status}).`);
    } catch {
      setError("Could not reach the server. Check your connection and retry.");
    } finally {
      setRequesting(false);
      router.refresh();
    }
  }

  useEffect(() => {
    if (pending && !autoStarted.current) {
      autoStarted.current = true;
      void extract();
    }
    // extract is stable enough for a one-shot start; re-running on its identity would double-trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  useEffect(() => {
    if (!requesting) return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [requesting]);

  useEffect(() => {
    if (requesting || !runningElsewhere) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [requesting, runningElsewhere, router]);

  const anyFailed = sources.some((s) => s.run?.status === "failed");

  return (
    <div className="flex flex-col gap-3">
      {(requesting || runningElsewhere) && (
        <Alert>
          <Loader2 className="animate-spin" aria-hidden />
          <AlertTitle>Extracting requirements… {requesting && `${elapsed}s`}</AlertTitle>
          <AlertDescription>
            Reading the relevant pages and checking each quote against the page it came from. A long document can take
            up to a minute.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertTitle>Extraction did not finish</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <ul className="flex flex-col divide-y rounded-lg border">
        {sources.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
            <FileText className="size-4 text-muted-foreground" aria-hidden />
            <span className="font-medium">{s.name}</span>
            <span className="text-sm text-muted-foreground">
              {s.role === "addendum" ? "Addendum" : "Main document"} · {s.pages} pages
              {s.needsOcrPages.length > 0 &&
                ` · ${s.needsOcrPages.length} page${s.needsOcrPages.length === 1 ? "" : "s"} need OCR (${s.needsOcrPages.slice(0, 8).join(", ")}${s.needsOcrPages.length > 8 ? "…" : ""})`}
            </span>
            <span className="ml-auto text-sm">
              {s.run === null && <span className="text-muted-foreground">Waiting to extract</span>}
              {s.run?.status === "running" && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden /> Extracting
                </span>
              )}
              {s.run?.status === "succeeded" && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="size-4 text-green-600" aria-hidden />
                  Analysed
                  {s.run.seconds !== null && ` in ${s.run.seconds}s`}
                  {` · ${s.run.facts.toLocaleString()} fact${s.run.facts === 1 ? "" : "s"} found`}
                </span>
              )}
              {s.run?.status === "failed" && (
                <span className="text-destructive">Failed: {s.run.error ?? "unknown error"}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {anyFailed && !requesting && (
        <div>
          <Button variant="outline" onClick={() => void extract()}>
            <RotateCw aria-hidden /> Retry failed extraction
          </Button>
        </div>
      )}
    </div>
  );
}
