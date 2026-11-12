import { NextResponse } from "next/server";
import { z } from "zod";

import { EnvValidationError } from "@/lib/env/schema";
import { runTenderExtraction } from "@/lib/tenders/run-extraction";

// A 200-page tender takes several model calls; ARCHITECTURE §2 allows up to 300 s here.
export const maxDuration = 300;

export async function POST(_request: Request, ctx: RouteContext<"/api/tenders/[id]/extract">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Unknown tender." }, { status: 404 });
  }
  try {
    const sources = await runTenderExtraction(id);
    return NextResponse.json({ sources });
  } catch (error) {
    console.error("extract", id, error);
    const message =
      error instanceof EnvValidationError
        ? `Extraction is not configured: ${error.problems.join("; ")}`
        : "Extraction failed unexpectedly. Nothing was saved for the failed document.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
