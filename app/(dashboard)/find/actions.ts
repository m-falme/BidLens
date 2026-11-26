"use server";

import { revalidatePath } from "next/cache";

import { getConfiguredModel } from "@/lib/ai/client";
import { createSampleLead, findSampleLead, listStartedSampleLeads, loadFindProfile } from "@/lib/db/queries/find";
import { findTenders, type FindResult } from "@/lib/find/run";
import { SampleTenderSource } from "@/lib/find/source";
import { startTender } from "@/lib/find/start";

// Today's source. A web source (PpipTenderSource) would be swapped in here, and nowhere else.
const source = new SampleTenderSource();

export type FindActionResult =
  | { ok: true; result: FindResult; started: Record<string, string> }
  | { ok: false; error: string };

export type StartActionResult = { ok: true; leadId: string; alreadyStarted: boolean } | { ok: false; error: string };

export async function findTendersAction(): Promise<FindActionResult> {
  try {
    const profile = await loadFindProfile();
    let model = null;
    try {
      model = getConfiguredModel().model;
    } catch {
      // No model configured: the code-only ranking still works.
    }
    const [result, started] = await Promise.all([findTenders({ source, profile, model }), listStartedSampleLeads()]);
    return { ok: true, result, started: Object.fromEntries(started) };
  } catch (error) {
    console.error("find tenders", error);
    return { ok: false, error: "The tenders could not be read just now. Please try again." };
  }
}

/** The leads already started from this source, by reference. Read only; used when a ranking is reused. */
export async function startedLeadsAction(): Promise<{ ok: true; started: Record<string, string> } | { ok: false }> {
  try {
    return { ok: true, started: Object.fromEntries(await listStartedSampleLeads()) };
  } catch (error) {
    console.error("list started tenders", error);
    return { ok: false };
  }
}

/** Creates a lead from one result. The tender is looked up on the server by id; nothing from the browser is stored. */
export async function startTenderAction(tenderId: unknown): Promise<StartActionResult> {
  if (typeof tenderId !== "string" || tenderId.length === 0 || tenderId.length > 40) {
    return { ok: false, error: "That tender could not be found." };
  }
  try {
    const tenders = await source.fetchTenders();
    const tender = tenders.find((t) => t.id === tenderId);
    if (!tender) return { ok: false, error: "That tender could not be found." };
    const result = await startTender(tender, { findExisting: findSampleLead, create: createSampleLead });
    revalidatePath("/tenders", "layout");
    revalidatePath("/");
    return result;
  } catch (error) {
    console.error("start tender", error);
    return { ok: false, error: "The lead could not be created. Please try again." };
  }
}
