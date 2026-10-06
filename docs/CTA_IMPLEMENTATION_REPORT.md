# SPWC Worker + D1 sourcing CTA — GPT review report

Date: 2026-10-07 (client timezone Asia/Shanghai).
Repository: `wbspo1994/spwc`. Branch: `codex/worker-d1-cta`.
Starting HEAD: `1061d276bc9030011834a4a2f296bef04c14de6a`.
Implementation is prepared on this branch for GPT review; see Git history for the committed revision. No merge or deployment was performed.

## Review disposition

Implementation and local validation are complete. **NO-GO for public enable** until technical/product/privacy review, live staging provider checks, backup lifecycle/recovery controls and explicit owner approval. Tests with provider simulators are not proof that a real Turnstile challenge or owner mailbox works in staging.

Read project instructions in their specified order after checking out the requested remote branch. The environment initially restored the frozen baseline on local branch `work`; the requested remote branch was fetched and checked out before implementation. The 76 baseline tests were rerun on the requested branch and passed before changes.

## What was built

| Area | Files | Behavior |
| --- | --- | --- |
| Isolated Worker API | `worker/src/index.ts`, `validation.ts`, `types.ts` | POST JSON API, exact Origin/preflight, streamed 16 KiB cap, native rate limiter, mandatory Turnstile hostname/action checks, field normalization/ranges, exact schedule verification, server weight recomputation, safe errors |
| Durable persistence | `migrations/0001_inquiries.sql` | Inquiry schema plus atomic notification outbox, indexes, UNIQUE idempotency and escalation keys, foreign-key cascade |
| Mail and retry | `worker/src/provider.ts`, `outbox.ts` | Abstract mail interface, runtime `RESEND_API_KEY`, configurable sender, owner-only mail/Reply-To, escaping, post-commit background attempt, bounded cron/leases/recovery, four retries then dead letter |
| Retention/backup | `worker/src/backup.ts`, daily cron | 12 calendar month expiry, atomic purge, consistent private R2 daily snapshot, seven-day cleanup, local restore filtering expired data |
| Frontend | `src/components/SourcingCTA.astro`, `src/lib/sourcing.ts`, `sourcing-form.ts` | Explicit off-by-default feature gate, calculator prefill, exact schedule fields, manual actual-dimension editing, quantity units, theoretical estimates, Turnstile refresh, field preservation on failure, idempotent retry, confirmed-201-only reset/success |
| Analytics | `src/lib/sourcing.ts` reuses `analytics.ts` | Five CTA event names, no caller-supplied properties or PII |
| Privacy/terms | `src/pages/privacy.astro`, `terms.astro` | Submission handling, no buyer confirmation mail, 12-month retention plus disclosed seven-day backup grace, monitored fallback contact |
| Tests/tooling | `tests/cta-*.ts`, `worker/e2e/`, separate Worker package/lockfile | Real SQLite transaction failure injection; Chromium → Astro → workerd/D1/R2 with external-provider simulators; isolated local Wrangler config and incomplete review template |

Only calculator-page integration edits are a component import, a gated component insertion and scoping its existing input listener to calculator controls. That prevents CTA typing from marking/recalculating calculator inputs. The calculation implementation, values, data tables, copy, unit conversion, SEO generator and production deploy path are unchanged.

Root dependency manifest/lockfile, the seven baseline test files, both datasets, calculator/units/dimensions/density libraries, `astro.config.mjs`, `scripts/seo.mjs`, `deploy/` and `CODEX-HANDOFF-README.md` are unchanged. Worker dependencies have a separate lockfile.

No admin login, accounts, CRM, APP_PASSWORD, SESSION_SECRET, production D1/API DNS or Pages Functions were added. No real credentials or real inquiry data are included. Test credentials are labeled nonfunctional placeholders; provider responses and contacts are synthetic.

## Persistence and retry invariants

The Worker inserts an inquiry and its notification outbox row in one D1 `batch()`. An outbox insert failure rolls back the inquiry. A successful commit returns 201 even if the mail provider fails, the background job fails or `waitUntil` scheduling fails. Email never decides submission success.

Idempotency fingerprints include normalized material fields and server-computed weights, exclude client totals and challenge tokens, and use a UUID-v4 key with a UNIQUE constraint. Same key/material replays the original inquiry ID; materially different payloads return 409. Concurrent UNIQUE races resolve to the committed winner after rollback. Retries must supply a fresh valid Turnstile token; consumed tokens are rejected even for existing inquiry keys.

Outbox attempts are immediate, +5 minutes, +30 minutes, +2 hours and +12 hours. Attempt five failure becomes `failed`, with a PII-free dead-letter event. Conditional 60-second leases, refreshed for each processed row, protect overlapping cron/foreground attempts. Provider requests time out at 10 seconds. Stable outbox IDs are provider idempotency keys. Email semantics are at-least-once after prolonged uncertainty; provider idempotency has a finite window.

The five-minute cron processes at most 10 due rows and scans at most 10 stale leads, preserving a small D1 query budget. Escalation is unique per inquiry and canceled if the lead is no longer `new`. The chosen SLA clock is **24 UTC weekday hours**, excluding Saturday/Sunday, without office-hour/holiday calendars. Review this interpretation of the brief's approximate business-hours requirement.

## Verification results

- Initial baseline: 7 files, **76/76 passed**, including a rerun on the requested branch.
- Final root suite: 9 files, **136/136 passed** = unchanged 76 baseline + 49 Worker/lifecycle cases + 11 frontend contract/analytics cases.
- Chromium browser suite: **7/7 passed** against real local workerd, D1 and R2, with test-only Turnstile/mail transport responses.
- Frozen root `npm ci` and separate Worker frozen `npm ci`: passed.
- Worker strict TypeScript check and separate CTA frontend strict TypeScript check: passed.
- Default preview build with CTA disabled: passed; CTA form absent from rendered output.
- Explicit local-review CTA-enabled preview build: passed; form and client bundle generated.
- Production-mode build without public CTA flags: passed; production canonical/sitemap/robots remain correct, no preview `_headers`, CTA absent.
- Final retained build: preview mode, CTA off by default.
- `wrangler dev` local service: ready with local D1/R2/limiter. GET → 405, invalid origin → 403, absent Turnstile secret → 403. Local daily scheduled endpoint → 200; migrations/tables and private local R2 backup verified.
- `git diff --check`: passed. Frozen-file comparison and safe credential-pattern scan: passed; branch remains the requested branch.

Browser coverage includes successful form submission, atomic D1 failure with every field preserved, mail failure after commit, cron mail recovery, lost-response idempotent retry, expiry refresh, invalid-challenge recovery, schedule prefill without calculator changes, PII-free analytics, escalation, daily backup/restore and retention on real local platform storage.

## Go/No-Go matrix

| # | Brief requirement | Local evidence / remaining gate |
| --- | --- | --- |
| 1 | Valid submit, atomic rows, 201, owner email received | Real local D1 rows + 201 + provider-adapter notification passed. **Actual owner inbox receipt pending staging secret injection and owner confirmation.** |
| 2 | Forced D1 failure, no success, preserve form | SQLite and real local D1 trigger rollback; browser fields preserved; retry passed |
| 3 | Mail failure after commit keeps 201/retry/no duplicate | Unit failure injection + real local D1/browser + cron recovery passed |
| 4 | Idempotent replay same ID | Unit/concurrency tests and browser lost-response retry passed |
| 5 | Invalid/expired/replayed Turnstile rejected | Controlled siteverify metadata/failure/replay tests and browser refresh passed. **Live challenge/hostname/action/token-expiry behavior remains a staging check.** |
| 6 | Invalid Origin rejected | Exact production-origin and preflight tests; Wrangler local guard passed |
| 7 | Rate limiting returns 429 | Native-binding rejection/failure test passed; real local native binding starts. **Staging native limit/traffic behavior remains to verify.** |
| 8 | Oversize/invalid fields rejected safely | Streamed body cap, JSON/method/type/range/email/country/schedule/UUID/honeypot tests passed |
| 9 | XSS-looking text stored as data/escaped | SQLite persistence, HTML email escaping and browser text-field checks passed |
| 10 | Cron retry recovers transient mail failure | Unit and real workerd/D1 cron tests passed |
| 11 | Stale escalation once | Weekday/weekend/status unit cases and real workerd/D1 cron uniqueness passed |
| 12 | Retention deletion | Atomic SQLite deletion, leap-date case and real workerd/D1 daily deletion passed |
| 13 | Private backup + restore | Real local R2 snapshot → separate local D1 restoration passed; expired-data exclusion and seven-day prune unit tests passed. **Private staging bucket, independent lifecycle and platform recovery retention remain unconfigured.** |
| 14 | CTA analytics without PII | Unit exact payload checks and browser captured events passed |

These results support code review, not a claim that all public-launch gates are already passed.

## Local reproduction and operational requirements

Follow `worker/README.md` for exact commands and ports. The automated browser suite requires no real secrets, starts and stops its own local servers, and never calls real email recipients. Test-only control/restore paths are implemented solely in `worker/e2e/entry.ts`, not the deployable `worker/src/index.ts`.

Manual local Worker development uses `wrangler.local.jsonc` on port 8787 and requires securely supplied Turnstile configuration to accept a real challenge. The frontend requires explicit `PUBLIC_SOURCING_CTA_ENABLED`, `PUBLIC_INQUIRY_API_URL`, and public `PUBLIC_TURNSTILE_SITE_KEY`. Secret values belong only in Worker secrets/ignored `.dev.vars`. Runtime names were checked: `RESEND_API_KEY` and `TURNSTILE_SECRET_KEY` are absent from this machine. No values were requested in chat.

Before public launch, the owner/reviewer must:

1. Review code, UX/privacy copy, quantity/country semantics and the UTC-weekday SLA interpretation.
2. Approve and configure isolated staging D1/R2/rate-limit bindings plus Worker secrets. Verify real Turnstile hostname/action and real owner inbox receipt; run the full matrix there.
3. Keep R2 private and enforce a separate seven-day bucket lifecycle rule independent of cron. Apply/disclose compatible retention for D1 platform recovery history, mail-provider retention and owner mailbox copies. Configure counts-only alerts for dead letters, cron failure and stale leads.
4. Review backup scale limits: snapshots currently materialize the small V1 dataset; restore helper caps 1,000 insert statements and requires a fresh schema. Larger datasets require controlled export/restore tooling. Test an operator recovery run before trusting it for production.
5. Obtain explicit public-enable approval. Only then create production bindings/migrations/API DNS and enable the frontend flag. Existing Pages deploy path must remain intact.

Nothing in this report authorizes deployment. No Pages deployment, Worker publication, remote migration, production DNS/resource update or merge occurred. Pushing the review branch does not authorize deployment.

## Issue #1 / cross-review R2 follow-up

A–C have been corrected for staging preparation. Public launch remains NO-GO.

- **A — script gate:** the script block is now inside `configured`, with a compile-time public-variable guard and dynamic import. Astro hoists processed scripts, so source placement alone was insufficient. `npm run test:build-gates --prefix worker` builds and scans actual `dist/` artifacts for disabled, unset, incomplete and enabled configurations. Each off/incomplete case has exactly one JS asset and one module loader (the calculator), with no sourcing-form bundle or CTA loader. Enabled output contains the sourcing bundle. No generated artifact deletion is used to conceal extra bundles.
- **B — privacy wording:** removed “the sole record of inquiries.” The page now explicitly separates primary D1 retention (12 months then deletion), private backup copies (up to seven additional days), and owner notification copies/mail-provider operational records (their mailbox/provider policies). No unverified indefinite-retention claim is made.
- **C — staging Origin:** selected strategy A before provisioning: local frontend `http://127.0.0.1:4321` against isolated remote staging resources. The review configuration records the exact local Origin, Turnstile hostname `127.0.0.1` and action `sourcing_inquiry`. Production exact-Origin behavior is unchanged; there is no arbitrary or wildcard staging Origin.
- **D — independent R2 lifecycle:** exact additive Wrangler lifecycle commands and read-back criteria are documented in `worker/ops/STAGING.md`. **Not yet configured on an actual staging bucket:** Wrangler reports unauthenticated; credential metadata and required process variables are absent. No staging resource exists that this task has verified. Worker cron cleanup is not claimed as completion of D.

Post-change verification: 136/136 unit tests, including the unchanged 76 baseline; 7/7 local browser tests against workerd/D1/R2; Worker and CTA frontend TypeScript checks; all five actual build-gate scenarios passed. The live-provider matrix remains unrun pending account access and secure staging Worker secrets. Cloud environment draft requirements were saved for `api.cloudflare.com`, `challenges.cloudflare.com`, `api.resend.com`, the Cloudflare API token, non-secret account ID and public Turnstile site key. Draft persistence does not authenticate Wrangler, configure R2, provision resources or execute live tests. Real Turnstile/owner inbox/native staging limiter checks must be recorded separately after prerequisites are supplied.


## Real staging provisioning follow-up

Cloud environment revision 8 activated Cloudflare authentication. Isolated staging D1/R2/Worker provisioning and remote schema migration are complete. Issue #1 item D is now complete at the ops layer: the real staging backup bucket has an enabled independent seven-day lifecycle rule for `daily/`, verified by a separate read-back; its public managed URL is disabled and it has no public custom domain. Production resources and the public frontend were not modified.

See `worker/ops/STAGING_STATUS.md` for exact evidence and remaining gates. The exact staging endpoint hostname was saved as a new cloud network requirement, but runtime endpoint requests remain proxy-blocked until that draft is activated. The staging Worker currently has no provider secrets, and the Cloudflare token cannot access Turnstile widget management. The live-provider matrix, actual owner inbox receipt, native limiter behavior and remote backup/restore therefore remain **unrun**, not passed. Prior “D not configured” and missing-account-access notes above describe the earlier state; this section records the updated state.
