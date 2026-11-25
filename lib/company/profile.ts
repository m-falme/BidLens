import { z } from "zod";

/** Edits to "Your company profile". Pure, so the form and the server agree. */

export const PROFILE_KINDS = ["service", "tool", "sector"] as const;
export type ProfileKind = (typeof PROFILE_KINDS)[number];

/** Stored on a capability the team added, so it can be told apart from one stated in the profile document. */
export const TEAM_EVIDENCE_REF = "Added by the team on the Company profile page";

const KIND_WORD: Record<ProfileKind, string> = { service: "service", tool: "tool", sector: "sector" };

export function kindWord(kind: ProfileKind): string {
  return KIND_WORD[kind];
}

function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

const legalNameSchema = z.object({
  name: z
    .string()
    .transform(tidy)
    .pipe(z.string().min(2, "Enter the registered name.").max(120, "That name is too long.")),
});

export function parseLegalName(input: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const parsed = legalNameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter the registered name." };
  return { ok: true, value: parsed.data.name };
}

const capabilitySchema = z.object({
  kind: z.enum(PROFILE_KINDS),
  name: z
    .string()
    .transform(tidy)
    .pipe(z.string().min(2, "Enter at least two characters.").max(120, "That is too long. Keep it under 120 characters.")),
});

export function parseCapability(
  input: unknown,
): { ok: true; value: { kind: ProfileKind; name: string } } | { ok: false; error: string } {
  const parsed = capabilitySchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.path[0] === "kind" ? "Choose services, tools or sectors." : (issue?.message ?? "Check the entry.") };
  }
  return { ok: true, value: parsed.data };
}

export function sameName(a: string, b: string): boolean {
  return tidy(a).toLowerCase() === tidy(b).toLowerCase();
}

const removeSchema = z.object({ id: z.uuid() });
export function parseRemoval(input: unknown): { ok: true; id: string } | { ok: false } {
  const parsed = removeSchema.safeParse(input);
  return parsed.success ? { ok: true, id: parsed.data.id } : { ok: false };
}
