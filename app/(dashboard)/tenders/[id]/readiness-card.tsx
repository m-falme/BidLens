import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReadinessResult } from "@/lib/readiness/match";
import { cn } from "@/lib/utils";

const MATCH_META = {
  met: {
    label: "Met",
    className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  },
  missing: {
    label: "Missing",
    className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
  unclear: {
    label: "Needs human",
    className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  },
} as const;

export function ReadinessCard({
  result,
  withdrawn,
}: {
  result: ReadinessResult;
  /** Mandatory lines an addendum withdrew, so they are not counted as gaps. */
  withdrawn: readonly string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Can Zanari meet the mandatory requirements?</CardTitle>
        <CardDescription>
          Matched against the Zanari profile. A line is met only when it links to a record there. Nothing was added to
          the profile for this tender.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-lg">
          <span className="font-semibold text-green-700 dark:text-green-400">{result.met} met</span>
          {", "}
          <span className="font-semibold">{result.gaps} gaps</span>
          {", "}
          <span className="font-semibold text-red-700 dark:text-red-400">
            {result.couldDisqualify} could disqualify us
          </span>
          .
        </p>
        {withdrawn.length > 0 && (
          <p className="text-muted-foreground">
            Not counted: the addendum removes {withdrawn.length} requirement{withdrawn.length === 1 ? "" : "s"}:{" "}
            {withdrawn.join("; ")}.
          </p>
        )}
        {result.items.length === 0 ? (
          <p className="text-muted-foreground">No mandatory requirements were extracted from this tender.</p>
        ) : (
          <details className="rounded-lg border">
            <summary className="cursor-pointer px-4 py-3 font-semibold">
              All {result.items.length} mandatory requirements
            </summary>
            <ul className="flex flex-col gap-2 px-3 pb-3">
              {result.items.map((item) => {
                const meta = MATCH_META[item.match];
                return (
                  <li key={`${item.pageNo ?? "x"}-${item.text}`} className="rounded-lg border">
                    <details>
                      <summary className="flex cursor-pointer flex-wrap items-start gap-2 px-3 py-2">
                        <Badge className={cn("mt-0.5 h-6 shrink-0 px-2.5", meta.className)}>{meta.label}</Badge>
                        <span className="min-w-0 flex-1">{item.text}</span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">
                          {item.pageNo ? `p.${item.pageNo}` : "no page"}
                        </span>
                      </summary>
                      <div className="flex flex-col gap-2 px-3 pb-3">
                        <p>{item.rationale}</p>
                        {item.capabilityName && (
                          <p className="text-muted-foreground">
                            Profile record: {item.capabilityName}
                            {item.evidenceRef ? ` · ${item.evidenceRef}` : ""}
                          </p>
                        )}
                        {item.quote && (
                          <blockquote className="border-l-4 border-primary/60 bg-muted/50 px-3 py-2 whitespace-pre-line">
                            “{item.quote}”
                          </blockquote>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
