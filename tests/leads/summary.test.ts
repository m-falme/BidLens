import { describe, expect, it } from "vitest";

import { buildLeadSummary, leadStatusLabel } from "@/lib/leads/summary";

const f = (key: string, value: string | null) => ({ key, value });

describe("lead summary", () => {
  const notice = [
    f("title", "Business intelligence dashboards and data warehouse support"),
    f("procuring_entity", "County Referral Hospital"),
    f("reference", "TND-2026-001"),
    f("submission_deadline", "2026-11-28 10:00"),
    f("publication_date", "2026-11-08"),
    f("location", "National"),
    f("sector", "Public Healthcare"),
    f("lead_category", "A"),
    f("owner", "Bid Analyst"),
    f("key_requirements", "Dashboard development, data integration, training and support"),
    f("eligibility_checks", "Confirm mandatory registrations, tax compliance and experience"),
    f("next_action", "Download full notice; extract mandatory criteria"),
    f("human_verified", "No"),
    f("source_url", "https://example.invalid/tender/TND-2026-001"),
    f("ai_confidence", "0.81"),
  ];

  it("picks short facts in reading order and leaves out plumbing such as the URL and the model confidence", () => {
    const summary = buildLeadSummary(notice);
    expect(summary.facts.map((fact) => fact.label)).toEqual([
      "Buyer",
      "Reference",
      "Closes",
      "Published",
      "Location",
      "Sector",
      "Lead category",
      "Owner",
    ]);
    expect(JSON.stringify(summary)).not.toContain("example.invalid");
    expect(JSON.stringify(summary)).not.toContain("0.81");
  });

  it("keeps the longer notes and the next action apart from the facts", () => {
    const summary = buildLeadSummary(notice);
    expect(summary.notes.map((note) => note.label)).toEqual(["Key requirements", "Eligibility checks to make"]);
    expect(summary.nextAction).toBe("Download full notice; extract mandatory criteria");
  });

  it("reports whether a person has checked the lead, and says nothing when the sheet has no mark", () => {
    expect(buildLeadSummary(notice).checkedByPerson).toBe(false);
    expect(buildLeadSummary([f("human_verified", "Yes")]).checkedByPerson).toBe(true);
    expect(buildLeadSummary([f("title", "x")]).checkedByPerson).toBeNull();
  });

  it("drops empty values and a line that repeats an earlier one", () => {
    const summary = buildLeadSummary([
      f("procuring_entity", "Ridgeway Technical College"),
      f("organization", "ridgeway technical  college"),
      f("email", "   "),
      f("phone", null),
      f("stage", "Discovery pending"),
    ]);
    expect(summary.facts).toEqual([
      { label: "Buyer", value: "Ridgeway Technical College" },
      { label: "Stage", value: "Discovery pending" },
    ]);
  });

  it("shows field-lead contact and visit notes", () => {
    const summary = buildLeadSummary([
      f("organization", "Ridgeway Technical College"),
      f("decision_maker", "ICT lead not identified"),
      f("email", "admin@ridgewaycollege.example"),
      f("phone", "0700 000 102"),
      f("initial_notes", "Student records are kept in separate spreadsheets."),
      f("additional_questions", "Number of students, current MIS"),
      f("next_action", "Request meeting with the principal"),
    ]);
    expect(summary.facts.map((fact) => fact.label)).toEqual(["Organisation", "Decision maker", "Email", "Phone"]);
    expect(summary.notes.map((note) => note.label)).toEqual(["Visit notes", "Questions to ask"]);
  });

  it("returns an empty summary for a lead with no fields, so the page still explains what to do", () => {
    expect(buildLeadSummary([])).toEqual({ facts: [], notes: [], nextAction: null, checkedByPerson: null });
  });

  it("words a lead status for the screen", () => {
    expect(leadStatusLabel("awaiting_response")).toBe("Awaiting response");
    expect(leadStatusLabel("something_new")).toBe("Something new");
  });
});
