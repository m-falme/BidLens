import Link from "next/link";

import { readinessLabel, type ReadinessMatch, type ReadinessResult } from "@/lib/readiness/match";
import { evidenceLibraryHref } from "@/lib/tenders/evidence-return";
import { cn } from "@/lib/utils";

import { AddDocumentButton } from "./add-document-button";

const MATCH_CLASS: Record<ReadinessMatch, string> = {
  met: "bg-confirmed/10 text-confirmed",
  missing: "bg-blocker/12 text-blocker",
  unclear: "bg-blocker/12 text-blocker",
  to_prepare: "bg-muted text-muted-foreground",
};

function Assessment({ match, selfDeclared }: { match: ReadinessMatch; selfDeclared: boolean }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-sm font-medium", MATCH_CLASS[match])}>
      {readinessLabel({ match, selfDeclared })}
    </span>
  );
}

export function ReadinessCard({
  tenderId,
  result,
  withdrawn,
}: {
  tenderId: string;
  result: ReadinessResult;
  /** Mandatory lines an addendum withdrew, so they are not counted as gaps. */
  withdrawn: readonly string[];
  companyName?: string;
}) {
  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      {withdrawn.length > 0 && (
        <p className="text-muted-foreground">
          Not counted: the addendum removes {withdrawn.length} requirement{withdrawn.length === 1 ? "" : "s"}:{" "}
          {withdrawn.join("; ")}.
        </p>
      )}
      {result.items.length === 0 ? (
        <p className="text-muted-foreground">No mandatory requirements were extracted from this tender.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="w-[38%] px-2 py-2 font-medium">Requirement</th>
                <th className="w-[16%] px-2 py-2 font-medium">Assessment</th>
                <th className="w-[30%] px-2 py-2 font-medium">Evidence</th>
                <th className="w-[16%] px-2 py-2 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                <tr key={`${item.pageNo ?? "x"}-${item.text}`} className="border-b border-border/80 align-top">
                  <td className="px-2 py-3 break-words">
                    <span className="block font-semibold">{item.text}</span>
                    <span className="mt-1 block text-muted-foreground">
                      Mandatory
                      {item.pageNo ? ` · Tender p. ${item.pageNo}` : " · Page not stated"}
                    </span>
                    {item.quote && <span className="mt-2 block text-muted-foreground italic">“{item.quote}”</span>}
                  </td>
                  <td className="px-2 py-3">
                    <Assessment match={item.match} selfDeclared={item.selfDeclared} />
                  </td>
                  <td className="px-2 py-3 break-words">
                    {item.match === "met" && item.capabilityId && item.capabilityName ? (
                      <span className="flex flex-col gap-1">
                        <Link
                          href={evidenceLibraryHref(tenderId, "compliance", item.capabilityId)}
                          className="font-medium text-brand underline-offset-4 hover:underline"
                        >
                          Met: you have {item.capabilityName}
                        </Link>
                        {item.selfDeclared && (
                          <span className="text-muted-foreground">Marked by the team. The file was not checked.</span>
                        )}
                      </span>
                    ) : item.unlisted ? (
                      <span className="flex flex-col gap-2">
                        <span>New requirement: not in your documents yet</span>
                        <AddDocumentButton requirement={item.text} />
                      </span>
                    ) : item.match === "to_prepare" ? (
                      <span>To prepare. Not a gap.</span>
                    ) : (
                      <span>{item.rationale}</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-muted-foreground">Not assigned</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
