import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { readinessLabel, type ReadinessMatch, type ReadinessResult } from "@/lib/readiness/match";
import { cn } from "@/lib/utils";

import { AddDocumentButton } from "./add-document-button";

function DocumentLinks({ items }: { items: ReadinessResult["items"] }) {
  const linked = items.filter(
    (item) => item.match === "met" && item.onChecklist && item.capabilityId && item.capabilityName,
  );
  const unlisted = items.filter((item) => item.unlisted);
  if (linked.length === 0 && unlisted.length === 0) return null;
  return (
    <ul className="flex flex-col gap-3">
      {linked.map((item) => (
        <li key={`met-${item.capabilityId}-${item.text}`} className="flex flex-col gap-1">
          <Link
            href={`/company#doc-${item.capabilityId}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Met: you have {item.capabilityName}
          </Link>
          <span className="text-muted-foreground">{item.text}</span>
        </li>
      ))}
      {unlisted.map((item) => (
        <li key={`new-${item.text}`} className="flex flex-col gap-2 rounded-lg border px-4 py-3">
          <span>{item.text}</span>
          <span className="font-medium text-red-700 dark:text-red-400">
            New requirement: not in your documents yet
          </span>
          <AddDocumentButton requirement={item.text} />
        </li>
      ))}
    </ul>
  );
}

const MATCH_CLASS: Record<ReadinessMatch, string> = {
  met: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  missing: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  unclear: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  to_prepare: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
};

export function ReadinessCard({
  result,
  withdrawn,
  companyName = "your company",
}: {
  result: ReadinessResult;
  /** Mandatory lines an addendum withdrew, so they are not counted as gaps. */
  withdrawn: readonly string[];
  companyName?: string;
}) {
  const who = companyName.trim() || "your company";
  const yours = who.toLowerCase() === "your company";
  const title = yours
    ? "Can your company meet the mandatory requirements?"
    : `Can ${who} meet the mandatory requirements?`;
  const against = yours ? "your company's" : `${who}'s`;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>
          Matched against {against} documents and services. A line is met only when it links to a paper marked Have.
          Met (self-declared) is the team&apos;s own mark, not a checked file. Forms to fill in and sign are to
          prepare, not gaps.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-lg">
          <span className="font-semibold text-green-700 dark:text-green-400">{result.met} met</span>
          {", "}
          <span className="font-semibold">
            {result.gaps} gap{result.gaps === 1 ? "" : "s"}
          </span>
          {", "}
          <span className="font-semibold text-red-700 dark:text-red-400">
            {result.couldDisqualify} could disqualify us
          </span>
          {result.toPrepare > 0 && (
            <>
              {", "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{result.toPrepare} to prepare</span>
            </>
          )}
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
          <>
            <DocumentLinks items={result.items} />
            <details className="rounded-lg border">
            <summary className="cursor-pointer px-4 py-3 font-semibold">
              All {result.items.length} mandatory requirements
            </summary>
            <ul className="flex flex-col gap-2 px-3 pb-3">
              {result.items.map((item) => (
                  <li key={`${item.pageNo ?? "x"}-${item.text}`} className="rounded-lg border">
                    <details>
                      <summary className="flex cursor-pointer flex-wrap items-start gap-2 px-3 py-2">
                        {item.unlisted ? (
                          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-md bg-red-100 px-2.5 py-0.5 text-sm font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                            New requirement: not in your documents yet
                          </span>
                        ) : (
                          <Badge className={cn("mt-0.5 h-6 shrink-0 px-2.5", MATCH_CLASS[item.match])}>
                            {readinessLabel(item)}
                          </Badge>
                        )}
                        <span className="min-w-0 flex-1 break-words">
                          <span className="block">{item.text}</span>
                          {item.match === "met" && item.onChecklist && item.capabilityId && item.capabilityName && (
                            <Link
                              href={`/company#doc-${item.capabilityId}`}
                              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                            >
                              Met: you have {item.capabilityName}
                            </Link>
                          )}
                        </span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">
                          {item.pageNo ? `p.${item.pageNo}` : "no page"}
                        </span>
                      </summary>
                      <div className="flex flex-col gap-2 px-3 pb-3">
                        {item.unlisted && <AddDocumentButton requirement={item.text} />}
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
              ))}
            </ul>
          </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}
