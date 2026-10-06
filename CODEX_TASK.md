# CODEX_TASK — SPWC Worker + D1 Sourcing CTA (V1)

Branch: `codex/worker-d1-cta` (from `main` = frozen production calculator baseline)
Spec: `SPWC_CODEX_CTA_BUILD_BRIEF.md` (same branch, distilled from GPT SPWC-CTA-R0)

You (Codex) are the primary implementation agent for the CTA track.
Muse/Black does repository setup and later product/commercial/SEO review only,
and will NOT make CTA code changes. GPT does technical/risk review after you finish.

## What to build

An isolated Cloudflare API Worker + D1 service behind the static Astro Pages site:

Static Astro Pages frontend (this repo, `main` baseline — DO NOT change calculator behavior, datasets, copy, SEO, or the Pages deploy path)
  → "Request sourcing assistance" form (add to frontend; pre-fill from calculator state when available)
  → Cloudflare Turnstile (mandatory server-side verification)
  → POST /v1/inquiries on the isolated Worker (e.g. api.steelpipe.wbspo.ccwu.cc)
  → server-side validation + abuse controls
  → D1 transactional write: `inquiries` + `notification_outbox` (atomic)
  → 201 returned to the browser as soon as the D1 commit succeeds
  → owner notification email via Resend (async, retried by Cron)
  → 12-month retention + daily private backup

**Frozen invariant:** customer-visible success depends ONLY on durable D1 persistence.
Email delivery must never decide whether the customer sees success.

## Hard constraints

1. `main` branch = frozen production calculator. Do not merge this branch into `main`.
2. Do NOT redeploy `steelpipe.wbspo.ccwu.cc`, do NOT touch the production Pages project,
   do NOT enable the CTA publicly, do NOT create production D1 migrations or production API DNS
   until the Go/No-Go gate passes and the owner explicitly approves.
3. Do NOT introduce: APP_PASSWORD, SESSION_SECRET, admin login, customer accounts, CRM,
   or any authentication shell. (Those leaked in from an unrelated repository and are NOT part of SPWC V1.)
4. Secrets: NEVER commit real credentials. The Worker must read the Resend key from the
   `RESEND_API_KEY` Worker secret and the sender from a configurable `RESEND_FROM` variable.
   No API key, token, password, or secret may appear in commits, README, docs, issues, PRs, or logs.
5. Do not store in D1: Turnstile tokens, raw IPs (unless a real operational need appears),
   unnecessary User-Agent data. Do not put inquiry data in Git.

## Resend environment (already provisioned by Muse)

- Resend account: registered and logged in (owner holds it).
- Domain verification is NOT required for V1: the account is on the sandbox sender
  `onboarding@resend.dev`, which may only send to the account owner's own address —
  and the V1 notification recipient IS the account owner (`wbspo1994@gmail.com`).
- API key (Sending access, named `spwc-worker`) was created; the owner will inject it as
  the `RESEND_API_KEY` Worker secret at deploy time. Your code must expect it as a secret,
  never as a committed value. Default `RESEND_FROM` to `onboarding@resend.dev` (overridable).
- V1 sends owner notifications only. No buyer confirmation email.

## Deliverables on this branch

1. `worker/` — isolated API Worker source (do NOT convert the Pages project to Functions):
   - `POST /v1/inquiries` per the API contract in the build brief
   - validation order: POST+JSON → Origin allowlist → body-size cap (≤16 KB) → rate limit →
     Turnstile siteverify → field validation/normalization → server-side theoretical-weight
     recomputation → prepared D1 statements only
   - idempotency via client-generated `idempotency_key` (409 on material conflict, replay returns original 201)
   - D1 `batch()` atomic insert into `inquiries` + `notification_outbox`
   - Resend provider adapter behind an abstracted interface (provider identity must not leak into business logic)
   - scheduled handlers: outbox retry cron (bounded batches), stale-lead escalation, retention deletion
2. `migrations/` — D1 schema migrations (`inquiries`, `notification_outbox`, indexes) per the build brief.
3. `src/` (frontend) — CTA form component + pre-fill from calculator + Turnstile widget +
   success/failure UX per the brief (preserve form data on failure, never show false success) +
   CTA analytics events via the existing `src/lib/analytics.ts` (no PII in payloads).
4. `tests/` — CTA tests covering at minimum the 14-item Go/No-Go matrix in the build brief,
   including failure injection (D1 failure, mail provider failure after D1 commit, Turnstile replay).
5. Docs: keep `CODEX-HANDOFF-README.md`; update this file if scope changes.

## Definition of done

- `npm ci && npx vitest run && npm run build` still green; the 76 pre-existing calculator tests still pass.
- All 14 Go/No-Go matrix items demonstrably pass in a staging/dev environment.
- `wrangler dev`-level local run of Worker + D1 (local) + frontend form works end to end.
- No secrets committed (`git log -p` clean; `.gitignore` covers `.dev.vars`, `.env*`).
- No changes to calculator behavior, datasets, SEO files, or production deploy config.

When done, report: what was built, how to run it locally, test results, and anything you
could NOT verify (e.g. production secrets/DNS you intentionally did not touch).
