import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The fictional sample tender notices in data/sample-tenders. This checks the files are well formed and agree with
 * their README: 60 rows, every documented field, valid dates, known county names, and a CSV that matches the JSON.
 * Nothing here reads a database or the network.
 */

// The README says the folder belongs at data/sample-tenders/. Unpacking a zip there can add one more level.
const CANDIDATES = [join("data", "sample-tenders"), join("data", "sample-tenders", "sample-tenders")];

function folder(): string {
  const found = CANDIDATES.find((path) => existsSync(join(process.cwd(), path, "tenders.json")));
  if (!found) throw new Error(`tenders.json not found in ${CANDIDATES.join(" or ")}`);
  return join(process.cwd(), found);
}

function read(name: string): string {
  return readFileSync(join(folder(), name), "utf8").replace(/^﻿/, "");
}

/** The fields the README documents, in the order the files use. */
const FIELDS = [
  "id",
  "fictional",
  "source",
  "type",
  "reference",
  "reference_number",
  "title",
  "buyer",
  "organization",
  "county",
  "buyer_county",
  "location",
  "sector",
  "category",
  "procurement_method",
  "estimated_value_kes",
  "currency",
  "published_on",
  "publication_date",
  "closing_date",
  "closing_datetime",
  "submission_method",
  "bid_security_kes",
  "bid_security_percent",
  "bid_security",
  "eligibility",
  "reserved_for_agpo",
  "description",
  "contact",
  "source_platform",
] as const;

const SECTORS = [
  "ICT",
  "revenue systems",
  "data/BI/analytics",
  "AI",
  "construction",
  "roads",
  "health",
  "education",
  "supplies/goods",
  "consultancy",
  "security services",
  "cleaning",
  "water",
  "energy",
  "agriculture",
  "transport",
];
const CATEGORIES = ["works", "goods", "services", "consultancy"];
const METHODS = ["open national tender", "open international tender", "RFP", "RFQ", "EOI", "restricted"];
const RESERVATIONS = ["youth", "women", "PWD"];

type Row = Record<(typeof FIELDS)[number], unknown> & {
  id: string;
  county: string;
  published_on: string;
  closing_date: string;
  closing_datetime: string;
  eligibility: string[];
  description: string;
  contact: string;
};

const rows = JSON.parse(read("tenders.json")) as Row[];

/** A small CSV reader: quoted fields, doubled quotes, commas and line breaks inside quotes. */
function parseCsv(text: string): string[][] {
  const table: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      table.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    table.push(row);
  }
  return table;
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function realDate(value: string): boolean {
  if (!isoDate.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

describe("sample tenders: tenders.json", () => {
  it("is an array of 60 notices with ids ST-001 to ST-060 in order", () => {
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(60);
    expect(rows.map((row) => row.id)).toEqual(Array.from({ length: 60 }, (_, i) => `ST-${String(i + 1).padStart(3, "0")}`));
  });

  it("gives every notice exactly the documented fields, in the documented order", () => {
    for (const row of rows) expect(Object.keys(row), row.id).toEqual([...FIELDS]);
  });

  it("marks every notice as fictional sample data of the fixed kind", () => {
    for (const row of rows) {
      expect(row.fictional, row.id).toBe(true);
      expect(row.source, row.id).toBe("sample");
      expect(row.type, row.id).toBe("procurement");
      expect(row.currency, row.id).toBe("KES");
      expect(row.source_platform, row.id).toBe("sample");
      expect(row.description, row.id).toMatch(/fictional/i);
    }
  });

  it("keeps the alias fields equal to their originals", () => {
    for (const row of rows) {
      expect(row.reference_number, row.id).toBe(row.reference);
      expect(row.organization, row.id).toBe(row.buyer);
      expect(row.buyer_county, row.id).toBe(row.county);
      expect(row.publication_date, row.id).toBe(row.published_on);
    }
  });

  it("uses a different reference for every notice, and non-empty text where text is required", () => {
    expect(new Set(rows.map((row) => row.reference)).size).toBe(rows.length);
    for (const row of rows) {
      for (const key of ["reference", "title", "buyer", "location", "submission_method", "description"] as const) {
        expect(typeof row[key], `${row.id} ${key}`).toBe("string");
        expect((row[key] as string).trim().length, `${row.id} ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("uses only county names from the BidLens county-risk data", () => {
    const risk = readFileSync(join(process.cwd(), "data", "county_payment_risk_scores_demo.csv"), "utf8")
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.split(",")[0])
      .filter(Boolean);
    expect(risk).toHaveLength(47);
    for (const row of rows) expect(risk, `${row.id} county ${row.county}`).toContain(row.county);
  });

  it("uses real ISO dates, closes after it is published, and closes at 10:00 Nairobi time", () => {
    for (const row of rows) {
      expect(realDate(row.published_on), `${row.id} published_on`).toBe(true);
      expect(realDate(row.closing_date), `${row.id} closing_date`).toBe(true);
      expect(row.closing_date >= row.published_on, `${row.id} closes before it is published`).toBe(true);
      expect(row.closing_datetime, row.id).toBe(`${row.closing_date}T10:00:00+03:00`);
    }
  });

  it("runs from late 2026 into March 2027 and has a few November 2026 closings for closed-tender checks", () => {
    const published = rows.map((row) => row.published_on).sort();
    const closing = rows.map((row) => row.closing_date).sort();
    expect(published[0] >= "2026-10-01").toBe(true);
    expect(published.at(-1)! <= "2027-03-31").toBe(true);
    expect(closing.at(-1)! <= "2027-03-31").toBe(true);
    expect(rows.filter((row) => row.closing_date.startsWith("2026-11")).length).toBeGreaterThanOrEqual(1);
  });

  it("uses only the documented sectors, categories, methods and reservations", () => {
    for (const row of rows) {
      expect(SECTORS, `${row.id} sector`).toContain(row.sector);
      expect(CATEGORIES, `${row.id} category`).toContain(row.category);
      expect(METHODS, `${row.id} procurement_method`).toContain(row.procurement_method);
      expect(row.reserved_for_agpo === null || RESERVATIONS.includes(row.reserved_for_agpo as string), row.id).toBe(true);
    }
  });

  it("writes money as whole shillings or null, and bid security as text or null", () => {
    const wholeOrNull = (value: unknown) => value === null || (Number.isInteger(value) && (value as number) > 0);
    for (const row of rows) {
      expect(wholeOrNull(row.estimated_value_kes), `${row.id} estimated_value_kes`).toBe(true);
      expect(wholeOrNull(row.bid_security_kes), `${row.id} bid_security_kes`).toBe(true);
      const percent = row.bid_security_percent;
      expect(percent === null || (typeof percent === "number" && percent > 0 && percent <= 100), `${row.id} percent`).toBe(true);
      expect(row.bid_security === null || typeof row.bid_security === "string", `${row.id} bid_security`).toBe(true);
      // No security at all means every security field is blank, and the other way round.
      expect(row.bid_security === null, `${row.id} security fields disagree`).toBe(
        row.bid_security_kes === null && row.bid_security_percent === null,
      );
    }
    expect(rows.some((row) => row.estimated_value_kes === null), "some values are blank on purpose").toBe(true);
  });

  it("lists eligibility as a non-empty array of plain conditions", () => {
    for (const row of rows) {
      expect(Array.isArray(row.eligibility), row.id).toBe(true);
      expect(row.eligibility.length, row.id).toBeGreaterThan(0);
      for (const item of row.eligibility) {
        expect(typeof item, row.id).toBe("string");
        expect(item.trim().length, row.id).toBeGreaterThan(0);
        // The CSV joins with " | ", so an item that contains it could not be split back.
        expect(item, row.id).not.toContain(" | ");
      }
    }
  });

  it("writes descriptions of three or four sentences", () => {
    for (const row of rows) {
      const sentences = row.description.split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(sentences.length, row.id).toBeGreaterThanOrEqual(2);
      expect(sentences.length, row.id).toBeLessThanOrEqual(4);
    }
  });

  it("holds no real contact details: one placeholder address, no phone numbers, no other emails", () => {
    for (const row of rows) {
      const emails = row.contact.match(/[\w.+-]+@[\w.-]+/g) ?? [];
      expect(emails, `${row.id} contact`).toHaveLength(1);
      expect(emails[0], `${row.id} contact`).toMatch(/@example\.go\.ke$/);
      expect(row.contact, `${row.id} contact has digits`).not.toMatch(/\d/);
    }
    const everything = JSON.stringify(rows);
    const emails = everything.match(/[\w.+-]+@[\w.-]+/g) ?? [];
    expect(emails.filter((email) => !email.endsWith("@example.go.ke"))).toEqual([]);
    expect(everything).not.toMatch(/(\+?254|\b0[17]\d{2})[\s-]?\d{3}[\s-]?\d{3}/);
  });
});

describe("sample tenders: tenders.csv", () => {
  const table = parseCsv(read("tenders.csv"));
  const [header, ...body] = table.filter((line) => line.length > 1 || line[0] !== "");

  it("has the same columns as the JSON, in the same order, and one line per notice", () => {
    expect(header).toEqual([...FIELDS]);
    expect(body).toHaveLength(rows.length);
    for (const line of body) expect(line, line[0]).toHaveLength(FIELDS.length);
  });

  it("carries the same values as the JSON: lists joined by ' | ', nulls left empty, numbers equal", () => {
    body.forEach((line, index) => {
      const row = rows[index];
      FIELDS.forEach((field, column) => {
        const value = row[field];
        const cell = line[column];
        if (typeof value === "number") {
          // The CSV may write 2.0 where the JSON has 2. Compare the number, not its spelling.
          expect(cell.trim(), `${row.id} ${field}`).not.toBe("");
          expect(Number(cell), `${row.id} ${field}`).toBe(value);
          return;
        }
        const expected = value === null ? "" : Array.isArray(value) ? value.join(" | ") : String(value);
        expect(cell, `${row.id} ${field}`).toBe(expected);
      });
    });
  });
});
