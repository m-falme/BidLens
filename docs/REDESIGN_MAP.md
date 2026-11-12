# Redesign map — current features → `docs/design/v0-reference.html`

Visual and wording follow the reference. Data, rules, and saved tables stay as they are. No Jane Mwangi, no KES 8.4m, no invented rows. Empty states when a value is missing. Screen copy does not say demo, example, sample, or a model name.

Brand in the sidebar: **BidLens Tenders**, small line **by Tech Nova**. Top bar and profile read the company name from the profile (Zanari Analytics today). Profile line: **Bid manager · {company name}**.

## Shell

| Now | New place |
| --- | --- |
| Sidebar: Overview, Your company, Leads, Tenders, Proposals. Counties already off the sidebar. | **Workspace:** Overview, Tenders (count = uploaded PDFs), Company profile, Evidence library. **Manage:** Decision trail, Settings. |
| Top bar: BidLens Tenders + tagline. | Breadcrumb `Workspace / {page}` or `Manage / {page}`, company name chip, profile mark. Tagline stays off the top bar (it is not in the reference). Footer line stays. |
| Purple tokens in `app/globals.css`. | Cream `#F6F3EE`, cards `#FFFDF8`, borders `#E7E1D6`, ink `#17202A`, muted `#6B6458`, accent `#8A5A14`, buttons `#5C3D0E`. Confirmed/met `#235B43`, warning `#98651C`, blocker `#B14C45`, Blank in source `#476D8A`. Serif headings, sans body, uppercase eyebrows. Card radius, shadow, pills, tables, stage bar, review footer, modal, toast as in the reference, via theme tokens. |

## Routes

| Route | After |
| --- | --- |
| `/` | Overview (`overview()`). |
| `/tenders` | Tender list with tabs **Tenders** and **Leads**. The reference opens one tender immediately; we keep the list because there are many. |
| `/tenders/[id]` | Tender workspace (`renderTender`). Old hash steps (`#can_bid`, `#can_comply`, `#should_bid`, `#proceed`) still open the matching stage. |
| `/tenders/new` | Upload a PDF as a new tender or an addendum. Linked from Overview **Add tender** and from **Open tender** / **+ Evidence** where a file is the action. |
| `/tenders/[id]/plan` | Printable plan. **Download plan** still opens it. |
| `/leads` | Redirect to `/tenders?tab=leads`. |
| `/company` | Company profile only. Document anchors move to Evidence library. |
| `/evidence` | Evidence library. Old `/company#doc-{id}` links point here. |
| `/trail` | Decision trail for every tender, with a tender filter. |
| `/settings` | Read-only review gates. Nothing is written; there is no settings table. |
| `/counties` | Unchanged table. Not in the sidebar. Only **See all counties** on Commercial. |
| `/proposals` | Removed from the nav. The route redirects to `/tenders`. It was an empty page. Its job is Bid preparation. |

## Overview

Reference layout: four stats, active tenders, next actions, team activity. Values from our queries only.

| Stat in the reference | Our value |
| --- | --- |
| Active tenders | Count of uploaded PDFs. Note: how many have no `stage_reviews` row yet. |
| Awaiting a decision | Uploaded tenders whose latest `bid_decisions` row is absent. |
| Evidence on file | Company documents with holding Have. Note: count expiring (date before today, and `never_expires` is false). |
| Upcoming deadline | Soonest closing date among uploaded tenders, with buyer. **Not stated** when none has a date. |

Active tenders: up to the latest uploaded rows (title, buyer, reference, closing, decision or stage pill). **All tenders** goes to `/tenders`. **Add tender** goes to `/tenders/new`.

Next actions: built from real gaps (needs-human facts, addendum conflicts, missing mandatory documents, tenders with no decision). Empty card when there are none.

Team activity: the newest trail rows (reviews and decisions), not a made-up agent. Empty when the trail is empty.

Home cards Analyse / Check compliance / Assess viability are replaced by this overview. Assess viability’s jump to the latest tender’s commercial stage becomes a row action, not a third home card.

## Tenders list and leads

| Now | New place |
| --- | --- |
| `/tenders` split: uploaded PDFs, then imported leads, with decision badge and risk band. | Tab **Tenders**: uploaded PDFs only, same badges. |
| `/leads`: field leads (title, location, owner, pipeline status) linking to `/tenders/[id]`. | Tab **Leads** on the same page. Same rows and links. |
| Upload a tender button. | **Add tender**. |

## Tender intake

| Now | New place |
| --- | --- |
| PDF upload, drag and drop, 25 MB, signed Storage URL, duplicate reported and not merged, addendum role on an existing tender. | Same form at `/tenders/new`. Header **Open tender** opens the main PDF when a file URL exists. **Upload an addendum** stays available from the workspace (**+ Evidence** on Interpretation, and the upload page). |
| Pasted text. | **Not built.** The PRD names it; the app only accepts a PDF. This redesign does not add a paste pipeline. |

## Tender workspace

One card, as `renderTender`: title, buyer, reference, closing date, **Open tender**, pill **IN REVIEW · STAGE N OF 5**, five-step bar, tabs, then the stage body and the review footer.

Stage order and saved rows:

| Tab | Replaces | Approve stage writes |
| --- | --- | --- |
| Interpretation | Can we bid? (`can_bid`) plus facts | `stage_reviews.stage = can_bid` |
| Compliance | Can we comply? (`can_comply`) plus readiness | `stage_reviews.stage = can_comply` |
| Commercial | Payment risk and profit. The old “Should we bid?” review is this stage. | `stage_reviews.stage = should_bid` |
| Recommendation | Recommendation card and Approve / Override | `bid_decisions` only. No new stage value. |
| Bid preparation | How do we proceed? and `/proposals` | Nothing new. Done ticks stay in `action_items`. |

The pill’s stage is the first tab that is not yet approved, in that order. Interpretation, Compliance, and Commercial are approved when a `stage_reviews` row exists. Recommendation is approved when a `bid_decisions` row exists. Bid preparation is approved when every action item is done (or there are no items). The bar uses the same rule: done, current, or waiting.

`stage_reviews` stays the three values in migration 0005. Recommendation and Bid preparation do not gain stages. See Conflicts.

### Footer (every stage)

| Control | Behaviour |
| --- | --- |
| Ask / correct | Reference modal. On Interpretation, Compliance, and Commercial the note is saved on that stage’s `stage_reviews` row (reviewer name, note). It shows on the trail. It does **not** re-run extraction. The reference line “queued for reassessment” is not used. |
| ＋ Evidence | Interpretation: addendum upload for this tender. Compliance: Evidence library (add or edit a company document). Other stages: Evidence library. No second upload pipeline. |
| Approve stage → | Interpretation, Compliance, Commercial: insert the stage review (same action as today’s Mark as reviewed) and move to the next tab, with a toast. Recommendation: this button is **Approve** (records `bid_decisions`). **Override with reason** stays beside it. Bid preparation: shows “Bid preparation reviewed” from the action-plan progress (the done ticks). No new stage row. |

Reviewer name is still required by the existing parsers. The field is prefilled with **Bid manager** and can be edited. A later review does not delete the earlier row.

### Interpretation (`factsView`)

| Now | New place |
| --- | --- |
| What matters (up to 5 points, evidence chips). | First findings, same quotes. |
| Addendum conflicts, both values kept. | A finding with an amber **Conflict found** pill. Both quotes and pages stay. Nothing is merged. |
| Extracted fields by source, status counts. | Findings: label, value, status pill, quote, page link. Counts stay in the stage head. |
| Evidence sheet: quote on the page text, confidence, **Open the PDF at page N**. | Page link opens that same viewer. |
| Statuses: Confirmed, AI-inferred, Blank in source, Needs human. Set by the quote check, not the model. | Same four. Blank in source uses blue-grey. AI-inferred stays amber. The reference has no AI-inferred pill; we keep it. |
| Extraction status (run, timing, scanned pages, OCR message). | Under the findings, not removed. |
| In-document bid-security amount conflict. | Shown as a conflict finding when the existing check returns one. |

### Compliance (`complianceView` table)

Columns: Requirement, Assessment, Evidence, Owner.

| Now | Cell |
| --- | --- |
| Mandatory lines after addendum withdrawals. | Requirement text, mandatory, tender page. |
| Met, including Met (self-declared), with **Met: you have {document}**. | Assessment **Met**. Evidence is that sentence and a link to the document. Synonym matches stay (bid bond / tender security / bid security, CR12, tax compliance). A similar service name still does not count. |
| Missing, could-disqualify wording. | Assessment **Missing** (red). Not the reference’s “Evidence required”. |
| Unclear. | **Needs human**. |
| To prepare (forms). | **To prepare**. Not a gap. |
| Unlisted requirement + **Add to my documents**. | Same button in the row. Inserts under Other documents as Don't have. |
| Withdrawn-by-addendum lines. | A note above the table, still excluded from the counts. |
| Counts: met, gaps, could disqualify, to prepare. Readiness save error. | Stage head. Error still on screen. |
| Owner. | We do not store an owner on a requirement. The cell says **Not assigned**. Owners, due dates, and done ticks stay on Bid preparation. |

### Commercial (`commercialView`, our numbers)

| Now | New place |
| --- | --- |
| County name, band, score, one reason line (ageing, size, trend). | Callout plus the score. |
| Controller of Budget, as-at date, confidence label. Not a promise of when the buyer pays. | Same callout. The reference’s “illustrative assumptions” editor is not added. |
| **See all counties** → `/counties`. | Same link. Only way into Counties. |
| Contract value and delivery cost form, saved on the opportunity. | The metric inputs. Empty until both are saved. |
| On-time profit and profit at the band scenario (Low 60, Moderate 180, High 365, Severe 730). Rate 16% a year, labelled as the rate the calculation uses because the profile has none. | The same function, called for day 0, for 2, 6, 12 and 24 months, and for the band scenario. The band row is highlighted. The table is not editable. No 18% rate and no invented contract value. |

### Recommendation (`recommendationView`)

| Now | New place |
| --- | --- |
| One of Consider declining, Resolve blockers, Seek clarification, Proceed to preparation. | The heading. |
| The rule that fired (`RULE_TEXT`). | Under the heading. |
| Reasons (text + item). | The reason cards. Wording stays the rule output, not the reference’s Makueni story. |
| Approve, or Override with a different label and a required reason. Insert-only `bid_decisions`. | Footer **Approve** and **Override with reason**. Name prefilled. |
| Latest decision card (label, who, when, reason). | Pill and a line under the heading. **No decision recorded** when there is none. |

No bid is submitted.

### Bid preparation (`prepView`)

The reference’s three preview rows and “Create response outline” are not a second generator. The plan stays code in `lib/plan`.

| Now | New place |
| --- | --- |
| Documents to get (missing or expired mandatory documents). | List row, with owner, due date, done. |
| Questions to ask the buyer, one per blank or needs-human key fact. **Copy all**. | Same section. |
| Response outline (evaluation criteria, then mandatory requirements). | Same section. No new prices, certificates, or case studies. |
| Key dates. Clarification deadline and site visit only when an extracted field states the date. | Same section. |
| Owner, due date, done tick, upserted in `action_items`. | On each row. |
| Progress “N of M done”. | Progress track and the stage pill. |
| **Download plan** → printable `/tenders/[id]/plan`. | Same. |
| Empty copy per section. | Kept. |

## Company profile (`company()`)

Read-only. Save is not shown, because these fields are not edited today and several reference inputs are not stored.

| Shown | Source |
| --- | --- |
| Registered name | `companies.legal_name`, else `companies.name`. |
| Workspace name | `companies.name`. |
| Capabilities | Existing `service`, `tool`, and `sector` rows. Empty state when a kind has none. |
| Not shown | Registration number, headquarters, team size, people, tax status, “82% complete”. We do not have those columns. Inventing them is out. |

## Evidence library (`evidence()`)

This is today’s Your company checklist, not a file cabinet of case studies.

| Now | New place |
| --- | --- |
| Groups: registration, licence, other. | Category filter. |
| Have / Don't have / Expired, self-declared note, original holding (“was Have”). | Status column. Have is green. Don't have and Expired stay distinct. |
| Optional expiry, **Does not expire**. | Expiry column. |
| **Used in N tenders** and links to those tenders. | Owner column is not a person. A second line links the tenders. There is no owner on a company document. |
| Search. | The reference search box, over name and category. |
| Add to my documents (from a tender). | Rows appear here under Other documents. |

Opening a row jumps to `#doc-{id}` on this page. We do not store uploaded certificate files on these rows, so **Open** does not pretend a PDF exists.

## Decision trail (`trail()`)

| Now | New place |
| --- | --- |
| Per tender, under the tender page: stage reviews and bid decisions, newest first. Who, what, when, note or reason. | Global page. Filter by tender. The tender page links here instead of repeating the full list. |
| Export. | Not built. No export button that does nothing. |

Labels move from “Reviewed Can we bid?” to the new stage names (Interpretation, Compliance, Commercial) in `lib/recommendation/trail.ts` display text only. Stored stage values stay `can_bid`, `can_comply`, `should_bid`.

## Settings (`settings()`)

Read-only **Review workflow**. Gates that already exist, each marked On:

- A person marks Interpretation, Compliance, and Commercial reviewed (`stage_reviews`).
- A person approves or overrides the recommendation (`bid_decisions`). An override needs a reason.
- Nothing is submitted or emailed.

Workspace name, timezone Africa/Nairobi, and currency KES are shown as facts, not a form. Team, notifications, and data-source toggles from the reference are omitted. There is no settings table and no Save.

## Conflicts — behaviour wins

1. **Five tabs, three review rows.** Approve on Recommendation writes `bid_decisions`. Approve on Bid preparation does not insert a stage. It shows “Bid preparation reviewed” through the action-plan progress (the done ticks). Adding `recommendation` or `preparation` to `stage_reviews` would be a migration, which this step does not do.
2. **Ask / correct does not reassess.** It stores a note. Extraction is unchanged.
3. **Commercial maths stay ours.** The formula in `lib/risk/margin.ts` does not change. When contract value and cost are filled, that function is called for day 0, for 2, 6, 12 and 24 months, and for the county band (Low 60, Moderate 180, High 365, Severe 730). The band row is highlighted. The rate stays 16%. The table is not editable. No 18% rate and no invented contract value.
4. **Recommendation text stays the four labels, the rule, and the reasons.** The reference’s “bid only if two conditions are resolved” story is not used.
5. **Compliance statuses stay met / missing / unclear / to prepare**, including “Met: you have …” and “New requirement, Add to my documents”. A missing document is not relabelled “Evidence required”.
6. **AI-inferred stays.** Blank in source becomes blue-grey, as this step’s palette says.
7. **No paste-text intake** until a later step builds it. Upload remains PDF only.
8. **No owner on a compliance row or a company document.** Owners stay on the action plan.
9. **Company profile and Settings do not gain Save** for fields we do not store.

## Parts

1. Theme, fonts, sidebar, top bar, Overview.
2. Tender workspace: list, leads tab, all five stages, review footer, counties link, plan download.
3. Company profile, Evidence library, Decision trail, Settings, upload pages, redirects, polish. Then push `main`.
