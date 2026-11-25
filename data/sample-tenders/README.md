# Fictional sample tender notices

This folder is **fictional sample data** for BidLens. It is not a live tender feed, not a government list, and not a record of real invitations to tender. County names and some well-known public-body types are used only to make the notices feel like Kenyan public procurement. Every row is invented. Do not bid on these, and do not treat the references, values or dates as real.

The intended home in the BidLens repo is `data/sample-tenders/`. Copy this folder there (or unpack `sample-tenders.zip` into that path) when you wire the "Find Our Tenders" agent. The agent should read `tenders.json` (or `tenders.csv`) through a swappable source interface. Today the source is this file. A later source can be an internet or government portal, without changing the rest of the pipeline.

There is **no fit field**. A later agent must decide, against the company profile, which notices are relevant.

## Files

- `tenders.json` — 60 notices as an array of objects.
- `tenders.csv` — the same rows and columns, with `eligibility` joined by ` | `, and empty cells for nulls.

## Field list

Fields are named so they can map into BidLens `opportunities` and extracted tender fields.

| Field | Meaning | Pipeline mapping |
|---|---|---|
| `id` | Stable sample id, `ST-001` to `ST-060` | Local dataset key (not a database uuid) |
| `fictional` | Always `true` | — |
| `source` | Always `sample` | — |
| `type` | Always `procurement` | `opportunities.type` |
| `reference` | Tender number, as written | `opportunities.reference` |
| `reference_number` | Same as `reference` | Extracted field `reference_number` |
| `title` | Tender title | `opportunities.title` |
| `buyer` | Procuring entity | Extracted field `buyer` |
| `organization` | Same as `buyer` | `opportunities.organization` |
| `county` | One of the 47 county names used in BidLens county-risk data | Extracted field `county` |
| `buyer_county` | Same as `county` | `opportunities.buyer_county` |
| `location` | Place of delivery or work | `opportunities.location` |
| `sector` | ICT, revenue systems, data/BI/analytics, AI, construction, roads, health, education, supplies/goods, consultancy, security services, cleaning, water, energy, agriculture, or transport | `opportunities.sector` |
| `category` | `works`, `goods`, `services`, or `consultancy` | — |
| `procurement_method` | `open national tender`, `open international tender`, `RFP`, `RFQ`, `EOI`, or `restricted` | — |
| `estimated_value_kes` | Integer shillings, or null if not stated | Informational only; not a default contract value in the app |
| `currency` | Always `KES` | — |
| `published_on` | ISO date (`YYYY-MM-DD`) | — |
| `publication_date` | Same as `published_on` | Workbook-style alias |
| `closing_date` | ISO date (`YYYY-MM-DD`) | — |
| `closing_datetime` | 10:00 Africa/Nairobi on the closing date (`…T10:00:00+03:00`) | `opportunities.deadline_at` / extracted `closing_datetime` |
| `submission_method` | How bids are submitted | `opportunities.submission_method` |
| `bid_security_kes` | Amount in shillings, or null | Used to build `bid_security` |
| `bid_security_percent` | Percent of the tender sum, or null | Used to build `bid_security` |
| `bid_security` | Plain-language security, or null if none | Extracted field `bid_security` |
| `eligibility` | List of conditions (JSON array; pipe-separated in the CSV) | Extracted list field `eligibility` (wording aligns with `lib/company/papers.ts` where it applies) |
| `reserved_for_agpo` | `youth`, `women`, `PWD`, or null | Part of eligibility / reservation |
| `description` | Three to four sentences. Every notice states that it is fictional. | — |
| `contact` | Enquiry contact: an office or job title, then a placeholder `@example.go.ke` address, for example `Procurement Office, procurement@example.go.ke`. No personal names. | Extracted field `contact` |
| `source_platform` | Always `sample` | `opportunities.source_platform` |

Dates run from late 2026 into March 2027. A few notices have a `closing_date` in November 2026 so closed-tender filters can be tested. Estimated values, where stated, range from a few hundred thousand shillings to the high hundreds of millions. Some values and some bid securities are left blank on purpose.

## What this is not

- Not a dump of tenders.go.ke, PPIP, or any real portal.
- Not seeded into the database until you choose to import it.
- Not a list of recommended bids. Some notices would reasonably interest a BI / data / AI / digital-transformation firm such as the seeded Zanari Analytics profile; many would not. The dataset does not label which are which.
- There are no phone numbers, personal emails, bank details or real people's names in these files.

## Licence and use

Use only as sample data inside BidLens development and demos.
