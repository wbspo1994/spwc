# SPWC V1 — Pipe Dimension Data Sources Research

Date: 2026-10-06
Purpose: Identify **publicly citable sources** (not values) for ASME B36.10-2022 (Sch 40/80) and ASME B36.19-2022 (5S/10S/40S/80S) dimension tables, plus answer whether B36.10-2022 changed any Sch 40/80 dimensions vs B36.10M-2018.

Rules followed: no dimension values copied into this report; every URL below was actually opened and confirmed in this session; sources that do not name an edition are flagged as weak.

---

## A. ASME B36.10-2022 — Schedule 40 / 80, NPS 1/2–12 (OD + wall)

### A1. ASME cstools (official ASME committee file server) — PRIMARY
- URL: `http://cstools.asme.org/csconnect/Filedownload.cfm?thisfile=R24875.pdf&dir=&46186.271794`
- Publisher: ASME (cstools.asme.org)
- Stated edition: **"ASME B36.10-2022 Table 2-1"** (explicit)
- Coverage: **fragment only** — the excerpt shows NPS 8–10 rows of Table 2-1 (not the full NPS 1/2–12 range)
- Reliability: highest (standards body itself); limited by fragmentary coverage. Good as a spot-check anchor for the 2022 edition, not as the data-entry source.

### A2. asme.org standard product page — PRIMARY (metadata)
- URL: `https://www.asme.org/codes-standards/find-codes-standards/welded-and-seamless-wrought-steel-pipe`
- Publisher: ASME
- Stated edition: **B36.10-2022**; Order No. M03122 / M0312Q; price $74; status notes indicate it is "placed on stabilized maintenance"
- Coverage: metadata only (no table values on the page)
- Reliability: primary; confirms the 2022 edition exists and is the current designation (successor to B36.10M-2018). This is the purchase path for the authoritative full text.

### A3. Intertek Inform product listing — SECONDARY (standards retailer metadata)
- URL: `https://www.intertekinform.com:443/en-gb/standards/asme-b36-10-2022-138297_saig_asme_asme_3167375/`
- Publisher: Intertek Inform (standards reseller)
- Stated edition: **ASME B36.10:2022**; "Supersedes: ASME B36.10M:2018"; 32 pages; ISBN 9780791875056
- Coverage: metadata only
- Reliability: corroborates the 2018→2022 succession; note the **page count is identical (32 pp.)**, which supports the finding that 2022 was not a table-expansion revision.

### A4. tekhnim.ru PDF — UNOFFICIAL full-text hosting (verification only, do NOT cite publicly)
- URL: `https://tekhnim.ru/upload/iblock/071/dgw8kdpbguwnwopkiv67e5xxsgo4zp6o.pdf`
- Publisher: tekhnim.ru (Russian site; provenance unknown)
- Stated edition: presents itself as the full **ASME B36.10-2022** text: "Date of Issuance: June 30, 2022", "(Revision of ASME B36.10M-2018)", includes Summary of Changes and Foreword
- Coverage: full Table 2-1 (all NPS × schedules) plus the Foreword's 2022 change description — this is what answered the edition-change question in §C
- Reliability: **copyright caveat** — almost certainly an unauthorized copy of a paywalled standard. Useful for internal verification and change analysis, but it must NOT be linked or cited as a source on the public site. The legitimate citable path is A2 (purchase from ASME).

### A5. Wheatland Tube submittal sheets — PRIMARY manufacturer, but NO edition named — WEAK for traceability
- URLs:
  - `https://www.wheatland.com/wp-content/uploads/2021/08/Schedule-10-and-Schedule-40-Submittal-Sheet.pdf` (Sch 40)
  - `https://www.wheatland.com/wp-content/uploads/2017/12/F1083-Schedule-80-Submittal-Sheet.pdf` (Sch 80)
- Publisher: Wheatland Tube (manufacturer)
- Stated edition: **none** — these are ASTM F1083 product submittals; ASME B36.10 is not named at all
- Coverage: Sch 40 and Sch 80 respectively, NPS 1/2–12 (within their product lines)
- Reliability: manufacturer-published data is generally accurate for its own product, but with no standard edition named it **cannot serve as a 2022-edition provenance source**. Use only for cross-checking, never as the cited authority.

### B36.10 manufacturer-chart gap (honest negative result)
Multiple targeted searches found **no manufacturer, mill, or engineering-reference chart that explicitly names "B36.10-2022"** other than ASME's own materials. Public charts overwhelmingly cite B36.10M-2015/2018 or no edition at all. Practical consequence for V1: the public "Source" citation for B36.10 data should be **"ASME B36.10-2022, Table 2-1"** (the standard itself, obtained via A2), with ASME's cstools excerpt (A1) as a public corroborating link — not a third-party chart.

---

## B. ASME B36.19-2022 — Schedules 5S / 10S / 40S / 80S (OD + wall)

### B1. ASME cstools (official) — PRIMARY
- URL: `http://cstools.asme.org/csconnect/Filedownload.cfm?thisfile=R222472.pdf&dir=&46186.271794`
- Publisher: ASME (cstools.asme.org)
- Stated edition: **"ASME B36.19-2022 Table 2-1"**, with May 2023 errata applied
- Coverage: **fragment only** — NPS 14–30 rows (the errata-affected portion); does NOT cover the V1 range (NPS 1/2–12)
- Reliability: highest authority; limited coverage. Also carries the important table notes: wall thicknesses marked (1) "do not permit threading in accordance with ASME B1.20.1" and (2) "These dimensions do not conform to ASME B36.10" — primary-document support for the V1 baseline rule that **40S/80S ≠ Sch 40/80**.

### B2. asme.org B36.19-2022 table-of-contents PDF — PRIMARY (metadata)
- URL: `https://www.asme.org/getmedia/a9eaf44a-2fd2-4063-a6e5-c648750bf781/table-of-contents_b36-19-2022.pdf`
- Publisher: ASME
- Stated edition: **B36.19-2022**; "Date of Issuance: May 31, 2022"; "Revision of B36.19M-2018"
- Coverage: contents/foreord matter only (the free preview does not include the dimension table)
- Reliability: primary; confirms the 2022 edition exists and its issuance date.

### B3. oepipe.com — SECONDARY, names the 2022 edition (strongest third-party B36.19 source found)
- URL: `https://www.oepipe.com/info/asme-b36-19m-stainless-steel-pipe-92838299.html`
- Publisher: oepipe.com (pipe supplier; page title: "Welded and Seamless Stainless Steel Pipe Dimensions & Weights (ASME B36.19-2022)")
- Stated edition: **ASME B36.19-2022** — table header reads "ASME B36.19-2022", and note (1) states: "This data is derived from the latest edition of ASME B36.19-2022."
- Coverage: NPS 1/8–30 × 5S / 10S / 40S / 80S / 160S (OD + wall + weight); fully covers the V1 range
- Reliability: explicitly edition-stated, which is rare for third-party charts. **Caveats**: (a) the URL slug and some body text still say "B36.19M" (old/new naming mixed on the page — cite the table header's "2022", not the slug); (b) it is a supplier marketing page, so each V1 cell must still be verified against the standard before going live.

### B4. Raykam Alloys blog — SECONDARY, names the 2022 edition
- URL: `https://raykamalloys.com/blog/asme-b36-19-2022-stainless-steel-pipe-dimensions/`
- Publisher: Raykam Alloys (Indian manufacturer/distributor blog)
- Stated edition: **"as per ASME B36.19-2022"** (explicit)
- Coverage: NPS 1/8–30 × 5S / 10S / 40S / 80S / 160S (wall thickness + kg/m); fully covers the V1 range
- Reliability: edition-stated; usable as an independent cross-check against B3. Same caveat as B3: commercial secondary source — verify each cell against the standard.

### B5. stainless-sheets.com (Gnee steel) — SECONDARY, NO edition named — WEAK
- URL: `https://www.stainless-sheets.com/info/asme-b36-19-pipe-dimensions-charts-56098192.html`
- Publisher: Gnee steel (supplier)
- Stated edition: **none**
- Coverage: 5S / 10S / 40S / 80S table (NPS range per page)
- Reliability: no edition stated — cannot serve as 2022-edition provenance; cross-check only.

### B6. quest4alloys.com 80S chart — SECONDARY, NO edition named — WEAK
- URL: `https://www.quest4alloys.com/schedule_80s_stainless_steel_pipe_tube.html`
- Publisher: Quest4Alloys (distributor)
- Stated edition: **none**
- Coverage: 80S only
- Reliability: narrow (single schedule) and edition-unstated — cross-check only.

### Scribd and similar document-hosting copies — NOT recommended
Various Scribd uploads contain B36.10/B36.19 tables but are edition-unstated, source-unknown, and often behind login walls. Excluded from the candidate list.

---

## C. Does B36.10-2022 change any Sch 40/80 dimensions (OD/wall) vs B36.10M-2018 in NPS 1/2–12?

**Answer: No evidence of any change to existing OD or wall-thickness values. The 2022 revision did not alter the Sch 40/80 OD/wall cells; its table changes were (1) new added wall-thickness rows for larger sizes, and (2) updated calculated weight listings.**

Evidence (from the standard's own change documentation, §A4, cross-checked against ASME's official cstools excerpt):

1. **Foreword, verbatim substance**: "The 2022 edition modifies the SI outside diameter rounding rules, updates the calculated plain end mass listings in Table 2-1, and adds new nominal wall thicknesses for some standard sizes from NPS 8 to NPS 28 (DN 200 to DN 700)."
   - *SI OD rounding rules* → affects the displayed **mm** OD values only, not inch ODs or wall thicknesses.
   - *Updated calculated plain-end mass listings* → the tabulated **lb/ft and kg/m weights** were recalculated; OD and wall columns were not.
   - *New nominal wall thicknesses added* for NPS 8–28 → **additions** of new rows, not modifications of existing Sch 40/80 cells.

2. **Summary of Changes** (2022 vs 2018): §2 last paragraph revised; §3 added; §6 nomenclature for D revised; §10 revised; Table 2-1 "Revised" — consistent with the Foreword description above. No mention of changed existing dimensions.

3. **Spot-check**: the 2022-edition cells visible in ASME's own cstools excerpt (A1) and in the full text (§A4) for Sch 40/80 (e.g., NPS 1/2, 1, 1-1/4, 1-1/2, 2, 2-1/2, 3, 8, 10) are identical to the long-established B36.10M values.

4. **Page count unchanged** (32 pp., per Intertek, §A3) — consistent with a non-expansive revision.

**Implications for SPWC V1:**
- A 2018-edition chart and a 2022-edition chart will show the **same OD and wall numbers** for every Sch 40/80 cell in NPS 1/2–12 — so the edition question is a *provenance* question, not a *data* question. Cite "ASME B36.10-2022, Table 2-1" as the source; values sourced from a carefully verified 2018-edition chart remain valid for these cells, but the public citation should name 2022.
- Because SPWC computes weight **geometrically** (OD × wall × density), the 2022 "updated calculated plain end mass listings" do not affect computed results — the calculator never uses tabulated masses. Do not copy the standard's lb/ft or kg/m columns into the data matrix.
- One caveat: the 2022 SI (mm) OD rounding rules changed, so **mm OD display values should come from the 2022 table** (or be computed from inch values with a stated rounding rule), not carried over from 2018-edition charts.
- Residual honesty note: this conclusion rests on the standard's own Summary of Changes + Foreword and sampled-cell agreement, not a full cell-by-cell diff of 2018 vs 2022. A full diff would require purchasing the standard (A2, $74). Nothing in the official change record suggests any existing Sch 40/80 OD/wall cell changed.

**Not verified (stated openly):** whether B36.19-2022 changed any 5S/10S/40S/80S dimensions vs B36.19M-2018 — the B36.19 Summary of Changes text was not accessible (the asme.org preview contains contents only; the cstools B36.19 fragment contains the table portion only). Same practical note applies: cross-check candidate values between B3 and B4, and verify each V1 cell against the standard before launch.

---

## D. Recommended source strategy for V1 data entry

| Data set | Primary authority (cite publicly) | Public corroborating link | Cross-check sources |
|---|---|---|---|
| B36.10-2022 Sch 40/80, NPS 1/2–12 | ASME B36.10-2022, Table 2-1 (purchased standard, A2) | ASME cstools 2022 excerpt (A1) | Wheatland submittals (A5) — values only, no citation |
| B36.19-2022 5S/10S/40S/80S, NPS 1/2–12 | ASME B36.19-2022, Table 2-1 (purchased standard via asme.org) | ASME cstools 2022 excerpt w/ errata (B1) | oepipe.com (B3) vs Raykam (B4) — values only, cite as cross-checks at most |

Per the frozen build brief: every cell must be verified before going live, 40≠40S / 80≠80S must be explicit in the UI, and source + edition must be shown per data matrix row. The B36.19 data-collection step (flagged as the execution risk) can start from B3/B4 as collection scaffolds, with final verification against the purchased standard.
