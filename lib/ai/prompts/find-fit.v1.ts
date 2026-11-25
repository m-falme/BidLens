/**
 * Prompt: write plain reasons and a fit score for the best tender matches (Find tenders agent).
 * Versioned file: change the wording only by adding find-fit.v2.ts.
 */
import type { FindProfile } from "@/lib/find/checks";
import type { RankedTender } from "@/lib/find/rank";

export const FIND_FIT_PROMPT_VERSION = "find-fit.v1";

export const FIND_FIT_INSTRUCTIONS = `You help a Kenyan company decide which public tenders are worth a closer look.

Rules:
- Use only the company profile and the tender facts given. Never use outside knowledge and never guess.
- "Hard facts" were checked by code. Repeat them in plain words where they matter and never contradict them.
- Never claim the company is eligible, qualified or will win. A public notice is not proof of eligibility.
- Never invent prices, certificates, references, past projects, contacts or requirements.
- Give each tender a fit score from 0 to 100 and 2 or 3 short reasons, each under 100 characters, in plain words a busy manager reads at a glance.
- A reason names a real link between the tender and the company profile ("Matches your data analytics service"), or a hard fact ("Needs ICTA accreditation, which you don't have", "Reserved for AGPO youth").
- A tender with an unmet licence or reservation among its hard facts must score 25 or lower.
- Return one result for every tender, with its id copied exactly.`;

const MAX_DESCRIPTION = 500;

function list(items: readonly string[]): string {
  return items.length > 0 ? items.join("; ") : "(none)";
}

export function buildFindFitPrompt(profile: FindProfile, tenders: readonly RankedTender[]): string {
  const company = [
    `Services: ${list(profile.services)}`,
    `Tools: ${list(profile.tools)}`,
    `Sectors: ${list(profile.sectors)}`,
    `Papers held: ${list(profile.heldPapers)}`,
  ].join("\n");
  const blocks = tenders.map(({ tender, checks }) =>
    [
      `id: ${tender.id}`,
      `title: ${tender.title}`,
      `buyer: ${tender.buyer}${tender.county ? ` (${tender.county})` : ""}`,
      `sector: ${tender.sector ?? "not stated"}`,
      `description: ${tender.description.slice(0, MAX_DESCRIPTION)}`,
      `hard facts: ${checks.facts.length > 0 ? checks.facts.join(" ") : "none"}`,
    ].join("\n"),
  );
  return `Company profile:\n${company}\n\nTenders:\n\n${blocks.join("\n\n")}`;
}
