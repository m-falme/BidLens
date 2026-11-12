import { describe, expect, it } from "vitest";

import { createBm25Index, tokenize } from "@/lib/retrieval/bm25";

const pages = [
  { id: 1, text: "Tender No: NCCG/IDE/T/039 Supply of SD-WAN. Nairobi City County." },
  { id: 2, text: "Table of contents. Instructions to tenderers. General conditions of contract." },
  { id: 3, text: "Payments shall be made within ____ days. The interest rate is ____. Advance payment: none." },
  { id: 4, text: "Tender security of KSh 420,000 issued by a bank. Tender validity period 120 days." },
];

describe("bm25", () => {
  it("tokenizes without stopwords or punctuation", () => {
    expect(tokenize("The Tender, at 10:00 AM!")).toEqual(["tender", "10", "00", "am"]);
  });

  it("ranks the page that matches the query terms first", () => {
    const index = createBm25Index(pages);
    expect(index.search("interest rate delayed payment days", 2)[0].id).toBe(3);
    expect(index.search("tender security bank guarantee", 1)[0].id).toBe(4);
  });

  it("returns only pages with a positive score, at most k, deterministically", () => {
    const index = createBm25Index(pages);
    expect(index.search("zebra", 3)).toEqual([]);
    expect(index.search("tender", 10).map((h) => h.id)).toEqual(index.search("tender", 10).map((h) => h.id));
    expect(index.search("tender", 1)).toHaveLength(1);
    expect(index.search("", 5)).toEqual([]);
  });
});
