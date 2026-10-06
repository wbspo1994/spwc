# Issue #1: staging operations and live-provider gates

## Current origin strategy: B (owner-authorized human frontend)

The owner authorized a temporary hosted frontend after the local cloud browser could not complete a genuine challenge. This supersedes strategy A for the human test. Use the independent static Worker frontend at the exact origin `https://spwc-cta-human-staging.wbspo1994.workers.dev`, against isolated staging Worker/D1/R2. See [HUMAN_STAGING.md](HUMAN_STAGING.md) for deployment evidence, widget authorization and the stop-for-owner test instructions. The staging Worker configuration now uses:

```json
{
  "ALLOWED_ORIGIN": "https://spwc-cta-human-staging.wbspo1994.workers.dev",
  "TURNSTILE_HOSTNAME": "spwc-cta-human-staging.wbspo1994.workers.dev",
  "TURNSTILE_ACTION": "sourcing_inquiry",
  "BACKUPS_ENABLED": "true"
}
```

The intended production configuration keeps the exact production Origin and production Turnstile hostname. Production does not gain a wildcard or arbitrary-origin override. `wrangler.review.jsonc.example` records this exact hosted staging choice; the previous exact loopback path remains supported only when explicitly selected instead. Local provider-simulator tests are separate from the live staging matrix below.

## Current external prerequisites

Cloud environment revision 8 now provides working Cloudflare account access. The isolated staging D1/R2/Worker have been provisioned and the independent R2 lifecycle verified. See `STAGING_STATUS.md` for real-resource evidence. Remaining prerequisites are staging endpoint network access and the real Turnstile/Resend secrets in the staging Worker.

Cloud environment settings need account access scoped to the intended staging account, with Worker, D1 and R2 provisioning permissions (and Turnstile widget management if provisioning a separate widget). `CLOUDFLARE_API_TOKEN` must be supplied securely there, never in chat or files. Supply the non-secret account ID in environment settings when required. Network access must allow `api.cloudflare.com`, `challenges.cloudflare.com`, `api.resend.com`, and the exact staging Worker hostname once it is known. Draft requirements have been saved; saved configuration alone does not apply credentials or prove readiness.

`TURNSTILE_SECRET_KEY` and `RESEND_API_KEY` belong in the **staging Worker's secrets**, using its secure settings. Proxy-managed credentials in this cloud machine may be placeholders and must never be copied into the Worker as if they were raw keys. The public widget site key is safe in `PUBLIC_TURNSTILE_SITE_KEY`. Never print tokens or provider payloads.

## Provisioning sequence (authorized by issue #1 after A–C commit and green checks)

1. Verify account access with Wrangler and inspect existing resources before creating any. Use isolated names such as `spwc-inquiries-staging` and `spwc-inquiries-backups-staging`. Never select the production D1 database, R2 bucket, Worker or Pages project.
2. Create staging D1/R2 resources if they are absent. Save their identifiers in ignored `worker/wrangler.review.jsonc`; do not commit account IDs or secrets. Apply migrations only to staging D1.
3. Keep the R2 bucket private: no public bucket URL or public custom domain. Add the independent lifecycle rule below, and read it back **before** relying on backups.
4. Configure the staging Worker with the exact selected staging Origin/Turnstile hostname/action. Use an isolated staging endpoint, secure Worker secrets and a real Turnstile widget supporting the local frontend. Do not enable the CTA on production Pages or modify production DNS.
5. Build the temporary staging frontend with `PUBLIC_SOURCING_CTA_ENABLED=true`, `PUBLIC_INQUIRY_API_URL=<exact staging endpoint>`, and the real public widget key. Complete the live matrix and obtain owner inbox confirmation.

## Independent seven-day R2 lifecycle rule

The Worker cron remains defense in depth; it is not the independent bucket rule. The installed Wrangler 4.76.0 CLI supports an additive lifecycle command which reads/preserves existing rules. For the dedicated staging backup bucket, run from the repository root:

```sh
XDG_CONFIG_HOME=/workspace/.config WRANGLER_SEND_METRICS=false \
  worker/node_modules/.bin/wrangler r2 bucket lifecycle add \
  spwc-inquiries-backups-staging spwc-backup-seven-day daily/ \
  --expire-days 7 --force

XDG_CONFIG_HOME=/workspace/.config WRANGLER_SEND_METRICS=false \
  worker/node_modules/.bin/wrangler r2 bucket lifecycle list \
  spwc-inquiries-backups-staging
```

Use the actual isolated staging bucket name if different. Do not replace an unknown bucket-wide lifecycle list. Before retrying, check whether rule `spwc-backup-seven-day` already exists; verify its prefix and expiry instead of blindly adding a duplicate. The read-back must show the rule enabled, prefix `daily/`, and deletion after 7 days. Keep a non-sensitive rule-only verification record in the staging report. Configuration text or CLI help does not establish a configured rule.

This rule expires private backup snapshots independently of Worker Cron execution. D1 primary records expire after 12 months; old snapshot copies can remain for up to seven additional days. Owner mailbox copies/provider operational records follow their applicable policies; their retention is not controlled by D1/R2 deletion.

## Required live-provider matrix and evidence

Record outcomes separately; a local simulator pass must never be relabeled a live pass.

| Item | Live staging evidence |
| --- | --- |
| 1 | Real challenge, 201, staging D1 inquiry + outbox, owner confirms receipt in `wbspo1994@gmail.com` |
| 2 | Staging-only D1 failure injection; no 201/success UI; every field remains; restore the resource after the check |
| 3 | Staging-only mail failure after commit; customer still sees 201; retry/dead-letter recorded; no duplicate inquiry |
| 4 | Lost-response retry with same key and fresh real challenge returns original inquiry ID |
| 5 | Real Turnstile invalid/expired/consumed token rejected; real hostname/action checks enforced |
| 6 | Production Origin and unrelated Origins rejected by the staging Worker; staging preflight returns only the exact configured staging Origin |
| 7 | Exercise the native 10/minute limiter using controlled synthetic traffic; observe 429 and recovery, allowing for coarse distributed limiting |
| 8 | Oversize JSON and invalid normalized fields rejected with safe errors |
| 9 | Synthetic XSS-looking text stored as data, safely displayed/escaped in actual owner mail |
| 10 | Staging Cron recovers a transient provider failure; one durable inquiry remains |
| 11 | Staging-only synthetic stale `new` inquiry produces one SLA notification across repeated cron runs |
| 12 | Staging-only synthetic expired inquiry/outbox purged by the daily job |
| 13 | Private staging R2 snapshot restores into a separate isolated D1 database; expired data excluded; independent seven-day lifecycle verified |
| 14 | Browser CTA analytics contain event names only, without contact fields |

Use synthetic inquiry data. Do not commit challenge tokens, addresses beyond approved recipient/test fixtures, emails, raw IPs or actual inquiry content as evidence. Production/public launch stays NO-GO until review and explicit owner approval, even if staging passes.
