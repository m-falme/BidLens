# /workspace/techai/malipo/data

| File | What | Source / status |
|---|---|---|
| county_pending_bills_cob_47_jun2026.csv | 47 counties, trade payables at 30 Jun 2026: total, exec/assembly split, FY25/26 budget, % of budget, executive ageing buckets, % over 3y / over 2y, OSR reported, payables as % of OSR, data_status (OK / FLAGGED / NOT_DISCLOSED), YoY change | PRIMARY: CoB County BIRR FY2025/26 (Aug 2026) Tables 2.1, 2.10, 2.11. Parsed by script; totals reconcile to KSh 172,526.69m |
| county_pending_bills_cob_47_jun2025.csv | Same for 30 Jun 2025 (FY2024/25 report Tables 2.9/2.10) with data-quality flags, plus Jun-2026 totals and Mar-2026 narrative % | PRIMARY for Jun 2025; reconciles to 183,028.75m total and 85,420.04m over-3y |
| county_payment_risk_scores_demo.csv | Demo scores using the formula in research.md section 3 | Our own arithmetic. NOT validated against payment outcomes |
| tenders/ | 3 real open ICT tenders (5 documents + addendum) | Downloaded from tenders.go.ke/storage on 11 Nov 2026 |
| tenders_demo.json | Metadata and demo role for each tender | |
| ppip_ict_awards_2024_2026.csv | 3,693 ICT-ish PPIP awards 2024-26 (keyword filter on title: noisy) | PPIP OCDS, from /workspace/techai/r2 |
| source_reports/ | Primary PDFs: CoB FY25/26 and FY24/25 county reports, Nyandarua verification report, PPADA | |

## Primary source reports (not committed; too large for the repo)
- CoB County Governments Budget Implementation Review Report FY2025/26 (Aug 2026) and FY2024/25 (Aug 2025): https://cob.go.ke/reports/
- Public Procurement and Asset Disposal Act 2015 (rev. 2022): https://ppra.go.ke/download/the-public-procurement-and-asset-disposal-act-revised-edition-2022/?wpdmdl=13095
- Public Procurement and Asset Disposal Regulations 2020: https://www.treasury.go.ke/sites/default/files/PPDA/Public-Procurement-and-Asset-Disposal-Regulations-2020.pdf
