# PRD — BidLens
**Tender Intelligence, Bid Readiness & Payment Risk**
TechAI Hackathon 2026 · Challenge owner: Zanari Analytics (with MsingiAI voice) · v1.0, 12 Nov 2026

---

## 1. Problem
Businesses, especially SMEs and consultancies like Zanari Analytics, struggle to interpret complex tender documents, determine their eligibility, assess their readiness, spot disqualification risks and understand the financial, technical and contractual implications of pursuing a tender. Leads also arrive fragmented: field visits, handwritten notebooks, emails, meeting notes, questionnaires and procurement portals. Sales staff interpret all of it by hand.

And even a tender a company *qualifies* for can lose money. Government buyers often pay late, sometimes years late, while the supplier pays interest on the money borrowed to deliver.
- Counties owed suppliers **KSh 172.53bn** at 30 Jun 2026 (Controller of Budget, CoB).
- Nairobi City County alone: **KSh 86.9bn**, about 195% of its budget, with **57%** older than 3 years.
- Example (illustrative): an KSh 8m contract at 14% margin, funded at 16% interest, **breaks even at 371 days** of delay and loses KSh 1.08m at 2 years.
- In 3 of 3 real county ICT tenders we downloaded, the **late-payment interest rate is blank**.

## 2. Solution
An AI-assisted workflow that turns any tender or lead into a **verified, traceable opportunity** and a clear, evidence-based **bid decision**, then into an **editable proposal draft**, with a human in control throughout.

> Rather than just finding tenders or summarising documents, it shows exactly what each tender demands, what the company has and lacks, **whether the buyer is likely to pay on time, and how much profit survives if they don't.**

## 3. Users
| User | Job to be done | Primary screens |
|---|---|---|
| **Bid analyst** | Read a tender fast, find mandatory items and gaps, recommend bid/no-bid | Tender detail, Readiness, Risk |
| **Sales rep (field)** | Capture a lead from a visit, notebook or voice note in seconds | Lead capture, Lead board |
| **Business owner / director** | Decide where to spend bid money; avoid profitable-on-paper losses | Recommendation, Decision, Counties |

Demo company: **Zanari Analytics** (profile and synthetic data from the challenge pack).

## 4. Core flows
### Flow A: Tender → decision (the hero flow)
1. **Intake:** upload a tender PDF (or paste text, or import from tenders.go.ke by reference).
2. **Extract:** reference, procuring entity, title, scope, deadline (date and time), submission method, bid security, mandatory documents, eligibility criteria, payment terms (days, advance %, late-payment interest), performance security, addenda. Each field has page, quote, confidence and status.
3. **Verify:** the quote check runs in code. A human can correct any field; the original is kept.
4. **Readiness:** each requirement is matched to the company profile: `met` (linked capability or document), `missing`, `unclear`. A readiness score and a list of gaps.
5. **Payment risk:** buyer lookup → county risk score (0–100, band, confidence, source). Margin-after-delay table (60/180/365/730 days) from the user's own inputs (value, margin, loan rate, advance %). Risky clauses flagged (blank interest rate, blank payment days, deadline mismatch, addendum conflicts).
6. **Recommendation:** `Bid`, `Bid at higher price` (with the price needed to keep margin), `Ask for advance / clarification`, or `Skip`, with reasons and drafted clarification questions.
7. **Decision:** the human picks, adds a note. A snapshot is logged.
8. **Proposal:** generate a proposal brief → editable draft (Section 7 of the Zanari pack). Prices and claims are placeholders until approved.

### Flow B: Field lead → qualified lead
1. **Intake:** a Form 1 entry, pasted notes or email, a notebook photo, or a **voice note** (Swahili / English / mixed, via MsingiAI Sauti STT).
2. **Extract and normalize:** organization, location, industry, date, source, contacts, need, current systems, decision-maker, budget/timeline, next step. Dates, phones and names standardized; original wording kept.
3. **Duplicates and gaps:** likely duplicates flagged (name, phone, email, reference); missing fields listed.
4. **Qualify:** need, service fit, decision-maker access, timing, budget evidence, feasibility, strategic value → status per the Zanari glossary.
5. **Map to services** → proposal brief → draft (shared with Flow A).

### Flow C: Pipeline
A board or table of all opportunities with owner, status, next action, due date, last contact and proposal version.

## 5. MVP scope and acceptance criteria
Priority: **P0** = must work at the 14:00 gate · **P1** = must work for the finals · **P2** = bonus.

| # | Feature (Zanari MVP item) | Pri | Done when… |
|---|---|---|---|
| 1 | Import a tender (upload PDF / paste text) and extract metadata | P0 | Uploading a real tender (e.g. Nairobi SD-WAN) shows ≥ 10 fields, each with page, quote, confidence and status in < 60s |
| 2 | Evidence, confidence and human correction | P0 | Clicking a field shows its quote; an edit is saved with the original kept; the quote check marks unfound quotes `needs_human` |
| 3 | Qualify and map to the service catalogue (readiness) | P0 | Requirements listed as met/missing/unclear; every `met` links to a capability record; a readiness % is shown |
| 4 | **Payment risk and recommendation** (our edge) | P0 | Buyer risk card (score, band, confidence, CoB source and date, limits); margin table with editable inputs; break-even days; recommendation with reasons; risky blanks flagged |
| 5 | Deployed and openable link | P0 | A public Vercel URL loads the demo company with seeded data |
| 6 | Human decision log | P1 | A decision is saved with user, time, choice, note and the inputs snapshot |
| 7 | Proposal brief and editable draft | P1 | Generates all Section-7 headings; no invented prices or claims (placeholders shown); editable and saved with a version number |
| 8 | Form 1 lead entry and structured record | P1 | Form saves; the 10 synthetic field leads are seeded and visible |
| 9 | Paste notes / notebook photo → candidate fields | P1 | Pasting the NB-001 text or uploading a photo fills Form 1 candidates with confidence; uncertain fields flagged; user confirms before save |
| 10 | Duplicates and missing fields | P1 | Re-entering "Northstar Clinic" with the same phone shows a duplicate warning; no auto-merge |
| 11 | Pipeline tracking | P1 | Board shows owner, status, next action and follow-up date; status changes are logged |
| 12 | Counties dashboard | P1 | Table and chart of 47 counties (pending bills, % over 3 years, risk band) with source |
| 13 | **Voice note → lead** (MsingiAI STT) | P2 | A Swahili/mixed voice note becomes a transcript and Form 1 candidates; numbers are confirmed by the user |
| 14 | Voice Q&A on a tender (STT → answer from our data → TTS) | P2 | "Tu-bid ama tuache?" returns a spoken answer that quotes only computed results |
| 15 | Import from tenders.go.ke OCDS by reference | P2 | Pasting a reference fetches the notice metadata and source URL |
| 16 | Claim-readiness checklist (get-paid file) | P2 | A checklist of documents to keep for chasing payment, per contract |

**Out of scope:** bid submission, sending emails or proposals, payments, multi-tenant auth, mobile app, model fine-tuning.

## 6. Data
| Data | Source | Use | Status |
|---|---|---|---|
| Zanari company profile | Challenge pack (PDF) | Capability records and service catalogue | Provided |
| Developer pack and sample workbook | Challenge pack (DOCX, XLSX) | 10 field leads, 5 synthetic tenders, 3 notebook notes, questionnaire, status glossary | Provided (synthetic) |
| Real tender PDFs (Nairobi SD-WAN + addendum, Makueni CRMIS, Nyamira revenue) | tenders.go.ke | Hero demo; real blanks and conflicts | Downloaded |
| County pending bills, 47 counties (Jun 2025, Jun 2026) | Controller of Budget BIRR reports | Buyer risk score and dashboard | Extracted to CSV |
| County risk scores | Our calc from CoB | Risk card | CSV (formula in ARCHITECTURE §6) |
| PPIP ICT awards 2024–26 | tenders.go.ke OCDS | Context: who wins what (optional) | CSV |
| CBK lending rate | CBK | Default loan rate (user can override) | Look up and cite on the day |

## 7. Success metrics (demo)
- Time to a decision on a real 150-page tender: **minutes, not hours** (measure one human read vs the tool; quote only what we measured).
- Extraction accuracy on a hand-checked set of ~15 fields × 3 tenders: fields correct, page citations correct, blanks correctly flagged.
- Zero invented prices or claims in generated proposals.

## 8. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Other teams build the same tender checker | Our edge: payment risk from real CoB data, the code-verified quote check, real tenders with real blanks |
| LLM hallucination | Zod schemas, quote check in code, `needs_human` status, placeholders |
| Scanned PDFs | Detect empty text pages → OCR fallback (or a vision LLM) |
| Long tenders blow the context window | Page-level text + keyword retrieval → send only relevant pages |
| Sauti misreads spoken numbers | Show the transcript and confirm numbers before using them |
| Risk score misread as a prediction | Show bands, confidence, data date and limits; scenarios, not forecasts |
| Running out of time | Strict P0 → P1 → P2 order; deploy early and often |

## 9. Pitch line
**"BidLens: see if a tender will pay you before you bid."** Most tools tell you if you *can* win a tender. BidLens also tells you if it will *pay* you.
