# SPWC Codex CTA Build Brief (V1)

Distilled from GPT `[SPWC-CTA-R0]` (2026-10-07), the frozen CTA architecture baseline.
Codex implements on branch `codex/worker-d1-cta`. GPT reviews after implementation.
Muse/Black reviews product/commercial/SEO only.

## 1. Architecture

```
Static Astro Pages (steelpipe.wbspo.ccwu.cc, frozen)
  → "Request sourcing assistance" form
  → Cloudflare Turnstile
  → POST /v1/inquiries → isolated Cloudflare API Worker (e.g. api.steelpipe.wbspo.ccwu.cc)
  → server-side validation + abuse controls
  → D1 batch(): INSERT inquiries + notification_outbox (atomic)
  → 201 immediately on D1 commit
  → ctx.waitUntil(): attempt Resend owner notification
  → Cron (5 min): retry pending/failed outbox rows, bounded batches
  → Cron (daily): 12-month retention deletion (+ R2 backup hygiene if enabled)
```

Invariant: customer-visible success depends ONLY on D1 persistence. Mail failure ⇒ 201 still returned, outbox retries.

Isolation: do NOT convert the Pages project to Functions. CORS allowlist = `https://steelpipe.wbspo.ccwu.cc` only.

## 2. Public CTA fields

Pre-fill from calculator when available: calculation_mode (actual|schedule), standard_id/edition, NPS,
schedule_designation, OD mm, wall mm, density kg/m³, length m, theoretical kg/m + total (display only —
Worker recomputes; never trust client totals).

User-entered: quantity, quantity_unit (pieces|total_length), destination_country, email,
company (optional), notes (optional).

Do NOT add a generic grade field unless a verified grade model exists.

## 3. API contract — POST /v1/inquiries

Request: form fields + calculator snapshot + Turnstile token + `idempotency_key` (client UUID).

Responses:
- `201` persisted → `{ inquiry_id }`
- `400` validation error (safe messages, no internals)
- `403` invalid origin / Turnstile failure
- `409` idempotency conflict (same key, materially different payload)
- `413` payload too large
- `429` rate limited
- `500/503` D1 persistence failed → frontend preserves all data, offers retry

Same idempotency key + same payload retried ⇒ return original success, no duplicate row.

## 4. Worker validation / security (in this order)

1. POST only, JSON content type
2. Strict production Origin allowlist
3. Body-size cap (≤ 16 KB)
4. Coarse Worker rate limit (abuse guard, not exact accounting)
5. Mandatory Turnstile siteverify (check hostname/action when configured)
6. Field length/type/range validation; normalize email/country/units
7. Recompute geometric theoretical weight server-side from OD/wall/density/length
8. Prepared D1 statements only

Do not store: Turnstile token, raw IP (unless real operational need), unnecessary User-Agent.

## 5. D1 schema

`inquiries`: id TEXT PK, idempotency_key TEXT UNIQUE NOT NULL, created_at/updated_at TEXT NOT NULL,
status TEXT NOT NULL DEFAULT 'new' (new|reviewing|sourced|unsourced|closed),
source_page, calculation_mode, standard_id, edition, nps, schedule_designation,
od_mm REAL NOT NULL, wall_mm REAL NOT NULL, density_kg_m3 REAL NOT NULL, length_m REAL NOT NULL,
theoretical_kg_m REAL NOT NULL, theoretical_total_kg REAL,
quantity_value REAL NOT NULL, quantity_unit TEXT NOT NULL,
destination_country TEXT NOT NULL, email TEXT NOT NULL, company TEXT, notes TEXT,
handled_at, closed_at, closure_reason, retention_delete_after TEXT NOT NULL.

`notification_outbox`: id TEXT PK, inquiry_id TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'owner_new_inquiry',
status TEXT NOT NULL DEFAULT 'pending' (pending|retry|sent|failed),
attempt_count INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT NOT NULL,
last_attempt_at, sent_at, last_error, created_at/updated_at TEXT NOT NULL.

Indexes: inquiries(created_at), inquiries(status, created_at), inquiries(email),
notification_outbox(status, next_attempt_at).

Atomicity: one D1 `batch()` for inquiry + outbox; either fails ⇒ neither commits.

## 6. Notification semantics (Resend)

- To: `wbspo1994@gmail.com` (owner). From: `RESEND_FROM` (default `onboarding@resend.dev`; sandbox sender, V1-safe).
- API key: `RESEND_API_KEY` Worker secret. Never committed, never logged.
- Subject: `[SPWC Inquiry] <inquiry_id> — <destination country> — <pipe summary>`.
- Body: all normalized fields + direct mailto/reply path to the buyer.
- V1: NO buyer confirmation email. Browser success screen shows inquiry ID + "Typically within 2 business days".
- Immediate: after D1 commit, `ctx.waitUntil(processOutbox(inquiry_id))`; success ⇒ outbox sent; failure ⇒ outbox retry, customer keeps 201.
- Retry schedule: immediate, +5 min, +30 min, +2 h, +12 h, then failed/dead-letter (owner attention).
- Stale-lead escalation: status='new' older than ~24 business hours ⇒ one escalation notification (SLA alert, not submission UX).

## 7. Anti-spam (layered)

Turnstile (mandatory) + Worker rate limiting (coarse) + idempotency key + field/payload limits +
optional honeypot + duplicate heuristic (same normalized email + near-identical request in short window).

## 8. Frontend UX

- CTA copy stays: "Request sourcing assistance".
- Success: "Request received" + inquiry ID + "Typically within 2 business days". Clear form only after confirmed 201.
- D1 failure: preserve every field, show retry, never false success. Fallback contact `wbspo1994@gmail.com` (owner-approved as monitored).
- Turnstile expiry/failure: refresh challenge, keep form data.
- CTA analytics (no PII — never email/company/notes): sourcing_cta_view, sourcing_cta_click,
  sourcing_form_start, sourcing_form_success, sourcing_form_fail. Reuse `src/lib/analytics.ts`.

## 9. Privacy / retention

- Primary retention: 12 months via `retention_delete_after`; daily cron deletes expired inquiry + outbox rows.
- Backups must not silently defeat retention: purge backup copies consistently, or disclose a short
  operational grace period with enforced lifecycle deletion.
- Do not put inquiry data in Git.

## 10. Admin scope (V1)

No CRM/admin UI to block V1. Minimum operating path: owner email notifications + D1 as source of truth
+ Cloudflare D1 console / controlled operator query. Optional later: tiny `/admin/inquiries` behind
Cloudflare Access (list/filter + status update only).

## 11. Go/No-Go test matrix (all required before public enable)

1. Valid submit ⇒ inquiry + outbox written, 201, owner email received.
2. Forced D1 failure ⇒ no success UI; form preserved.
3. Forced mail failure after D1 commit ⇒ 201 still returned; outbox retries; no duplicate inquiry.
4. Duplicate retry, same idempotency key ⇒ same inquiry ID.
5. Invalid/expired/replayed Turnstile ⇒ rejected.
6. Invalid origin ⇒ rejected.
7. Rate limit ⇒ 429.
8. Oversize/invalid fields ⇒ rejected with safe errors.
9. XSS-looking notes/company stored as data, escaped when rendered/emailed.
10. Cron retry succeeds after transient email failure.
11. Stale-new escalation fires once.
12. Retention deletion works.
13. Backup + restore tested (if backup is a launch gate).
14. CTA analytics fire without email/company/notes in payloads.

## 12. Recommended implementation order

1. D1 + migrations → 2. isolated Worker + bindings/secrets → 3. validation/idempotency/D1 batch →
4. Turnstile + rate limiting → 5. outbox + Resend adapter + cron retries → 6. frontend CTA form/prefill/UX →
7. CTA analytics → 8. retention/backup → 9. E2E failure-injection tests → 10. public enable only after Go/No-Go.
