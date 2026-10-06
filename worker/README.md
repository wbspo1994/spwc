# SPWC sourcing API — review branch

This is an isolated Worker, separate from the static Astro Pages deployment. The production frontend CTA is **off by default**. There is no production resource ID, API route, deployment script, account, admin UI, login or CRM here. Keep all work on `codex/worker-d1-cta`; do not merge to `main` or deploy until GPT review and explicit owner approval.

## Local verification

Validated with Node 24.19.0, npm 11.9.0, Wrangler 4.76.0, local workerd/D1/R2 and system Chromium. Root Vitest CTA database tests use Node's SQLite API (Node 24 recommended).

From `/workspace/spwc` (adjust the checkout path on other machines):

```sh
npm ci --cache /workspace/.npm
npm ci --prefix worker --cache /workspace/.npm
npm test -- --maxWorkers=2 --minWorkers=1
npm run typecheck --prefix worker
worker/node_modules/.bin/tsc -p worker/tsconfig.frontend.json
npm run test:build-gates --prefix worker
XDG_CONFIG_HOME=/workspace/.config WRANGLER_SEND_METRICS=false npm run migrate:local --prefix worker
XDG_CONFIG_HOME=/workspace/.config WRANGLER_SEND_METRICS=false npm run test:e2e --prefix worker
ASTRO_TELEMETRY_DISABLED=1 PUBLIC_SITE_URL=https://steelpipe.wbspo.ccwu.cc PUBLIC_NOINDEX=true npm run build
```

The browser suite starts its own isolated frontend and Miniflare/workerd processes on ports 4321, 8788 and 8790; stop your own development frontend before running it. It uses real local D1 transactions and private local R2, and mocks only Turnstile/browser challenges and external email delivery. No network calls to Resend or actual inboxes occur. `worker/e2e/entry.ts` and `server.mjs` are test-only and **must never be production entry points**. The test control server binds to loopback only. Tests generate synthetic contacts and never export real inquiries into the repository.

Playwright uses `CHROMIUM_PATH` when supplied, otherwise `/usr/bin/chromium` on this cloud machine. On other machines, install a compatible browser and set the path. The default Playwright browser CDN is blocked by this environment's network policy; the preinstalled Chromium was used successfully without changing network settings or disabling verification.

For manual Worker development:

```sh
XDG_CONFIG_HOME=/workspace/.config WRANGLER_SEND_METRICS=false npm run dev --prefix worker
```

This uses `wrangler.local.jsonc`, local D1/R2 only, port 8787 and an exact local Origin `http://127.0.0.1:4321`. It fails closed until a Turnstile secret is supplied in ignored `worker/.dev.vars`. Resend failures are harmless to persisted submission success. Never reuse the local configuration to publish a Worker. No secret is needed to run the automated browser suite.

The frontend additionally requires all three public variables to render the CTA:

- `PUBLIC_SOURCING_CTA_ENABLED=true` (default is off).
- `PUBLIC_INQUIRY_API_URL` (isolated API origin).
- `PUBLIC_TURNSTILE_SITE_KEY` (public widget key, not the secret).

Manual local frontend: run `npm run dev -- --host 127.0.0.1 --port 4321` with these public variables, pointing the API to port 8787. Real widget/secret hostname and action must match local settings. Do not enable on the production Pages project during review.

## API and persistence

`POST /v1/inquiries`, JSON only. The flat payload is the form/snapshot fields listed in the brief; quantity is named `quantity_value`. Required SI fields: `od_mm`, `wall_mm`, `density_kg_m3`, `length_m`, `quantity_value`; quantity unit is `pieces` or `total_length` (metres). `destination_country` must be an ISO 3166-1 alpha-2 code. `source_page` is `/steel-pipe-weight-calculator/`. Schedule mode also needs exact `standard_id`, `edition`, `nps`, `schedule_designation`, consistent with the frozen available dataset. Actual mode normalizes schedule metadata to null. `company` and `notes` are optional. A nonempty optional `website` honeypot is rejected. No grade field exists.

A UUID-v4 `idempotency_key` and fresh `turnstile_token` are mandatory. Every retry still verifies Turnstile. The client keeps its key for an unchanged pending payload and renews the challenge after failure. A materially changed request gets a new key. SHA-256 fingerprints use normalized material fields and server-computed weights; tokens, browser totals and idempotency keys are excluded from the fingerprint. Same key/material returns original 201; material conflict is 409. UNIQUE races resolve by reading the committed winner after rollback.

Validation order is method/content type → exact Origin → streamed 16 KiB cap → native Worker limiter → Turnstile → normalization/ranges → independent weight calculation → prepared D1 statements. Native rate limiting is coarse, not exact accounting. Cloudflare's injected connecting IP is used only as the ephemeral limiter key, never stored or logged. There is no in-memory production security bypass or configurable third-party verification URL.

The fixed production Origin is `https://steelpipe.wbspo.ccwu.cc`; the only code-supported override is the isolated local frontend. Preflights allow POST and Content-Type only; no wildcard CORS. The production entry has only the inquiry API, no backup/restore/admin endpoint.

Inquiry + outbox insert use one atomic D1 `batch()`. Only a committed write or a matching committed replay returns 201 `{ inquiry_id }`. Mail attempts are scheduled after commit via `waitUntil`, so provider or background scheduling failure cannot reverse customer success.

## Worker bindings and notification operations

- `DB`: dedicated D1 database, migrations in `../migrations` relative to worker configuration.
- `INQUIRY_RATE_LIMITER`: native Worker rate-limit binding, review default 10/minute per connecting IP.
- `TURNSTILE_SECRET_KEY`: Worker secret; `TURNSTILE_HOSTNAME` required, `TURNSTILE_ACTION=sourcing_inquiry`.
- `RESEND_API_KEY`: Worker secret, read at runtime only; `RESEND_FROM` defaults to `onboarding@resend.dev`.
- `BACKUPS`: **private** dedicated R2 bucket; `BACKUPS_ENABLED=true` for daily snapshots.

An abstract `MailProvider` separates outbox logic from the Resend adapter. Only the owner `wbspo1994@gmail.com` receives mail; Reply-To points to the buyer. All normalized inquiry fields are included, with text and HTML versions. Company/notes are HTML-escaped. Provider errors store only bounded category codes, never response bodies or credentials. No buyer confirmation email is sent.

Attempts: immediate, then delays of 5 min, 30 min, 2 h, 12 h, then dead-letter `failed` after five attempts. Cron every five minutes processes at most 10 due rows (and scans at most 10 stale leads). Atomic conditional 60-second leases avoid overlapping mail attempts; crashed leases recover. Each outbox ID is the provider's stable idempotency key. Resend idempotency has a finite provider window; this is at-least-once notification processing, not a guarantee of globally exactly-once mail after prolonged failures. D1 remains authoritative.

Stale `new` leads get one uniquely keyed escalation at 24 **UTC weekday hours** (Saturday/Sunday excluded; holidays and office opening hours are not modeled). This interpretation of the brief's approximate business-hours requirement needs reviewer acceptance. Handled leads do not escalate; already-queued alerts are canceled if the inquiry is no longer `new`.

Operators need to monitor dead letters, cron failures and unhandled leads through Cloudflare logging/metrics and controlled D1 console queries. Do not paste real inquiry data into Git, issues or PRs. Useful counts-only query:

```sql
SELECT status, COUNT(*) AS count FROM notification_outbox GROUP BY status;
```

No successful HTTP provider response is evidence of actual inbox receipt. Owner-confirmed receipt remains a staging/public-enable gate.

## Retention and private backups

Daily `0 2 * * *` cron deletes expired inquiry/outbox rows atomically, then prunes private snapshots and writes a consistent D1 batch-read snapshot to R2. Retention is 12 calendar months (leap dates clamp). Mail processing skips expired inquiries.

R2 objects under `daily/` expire after seven days through cron cleanup. Before launch, configure an independent **7-day R2 lifecycle rule** and keep the bucket private with no public access. That independent rule is required so cron outages cannot silently prolong retention. The frontend/privacy copy discloses a maximum seven-day operational grace for deleted data. Apply matching retention to D1 platform recovery history, mail-provider data and owner mailbox copies; those controls have not been changed in this task.

`restoreBackup()` is an operator-only library helper, not an API: restores into a fresh isolated schema, excludes expired inquiries and their outbox rows, and clears leases. It refuses more than 1,000 insert statements; larger restores require controlled platform tooling. The actual local workerd/D1/R2 restore path is exercised by the browser suite. Test-only entry points must never be deployed for production restoration. Review snapshot memory/query/result-size limits and use a supported streaming/export process before growing beyond this small V1 dataset.

## Review and launch

`wrangler.review.jsonc.example` is an intentionally incomplete review template, with no resource IDs, routes or secrets. It cannot be used as-is. After review and explicit approval, configure separate staging resources first, use exact intended hostname/action, secure Worker secrets, verify actual owner inbox receipt, exercise all 14 matrix items in staging, configure private backups/lifecycle and recovery retention, then obtain separate approval for public enable. No production command was executed here.

See `../docs/CTA_IMPLEMENTATION_REPORT.md` for the evidence and outstanding gates.

## Issue #1 cross-review corrections

The CTA script is inside the configured block and uses a compile-time dynamic-import gate: moving a processed Astro script alone does not prevent script hoisting. `test:build-gates` checks actual `dist/` output for disabled, unset, incomplete and enabled configurations; disabled production artifacts contain neither a sourcing bundle nor a CTA loader. Privacy explicitly separates D1 retention, backup grace and mailbox/provider policies. Staging uses strategy A (exact local frontend Origin against remote isolated staging resources). See `ops/STAGING.md` for independent R2 lifecycle commands, read-back criteria, credential prerequisites and the live-provider matrix. The lifecycle rule is pending real account access; it has not been configured by writing this document.
