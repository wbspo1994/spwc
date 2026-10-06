# Staging provisioning evidence

Date: 2026-10-07 (Asia/Shanghai). Branch: `codex/worker-d1-cta`.

## Completed on real Cloudflare resources

- Cloud environment revision 8 injected the account configuration and API authentication; account API requests succeeded.
- Created isolated D1 `spwc-inquiries-staging`. Applied `0001_inquiries.sql` remotely to this database only. Queried schema and confirmed `inquiries`, `notification_outbox`, and `d1_migrations`.
- Created isolated R2 `spwc-inquiries-backups-staging`.
- Configured and independently read back the R2 bucket lifecycle rule below. Existing lifecycle rules were preserved.
- Verified the staging bucket's managed public URL is disabled and no public custom domains are attached.
- Deployed only `spwc-inquiries-staging` at `https://spwc-inquiries-staging.wbspo1994.workers.dev`.
- Read back deployed D1/R2/native-rate-limit bindings. The limiter uses a fresh account namespace after checking existing namespaces; no existing Worker settings were changed.
- Read back cron schedules `*/5 * * * *` and `0 2 * * *` and the enabled staging endpoint. Preview URLs remain disabled.
- The staging Worker uses exact Origin `http://127.0.0.1:4321`, Turnstile hostname `127.0.0.1`, and action `sourcing_inquiry` (strategy A).

Verified R2 rule:

```json
{
  "id": "spwc-backup-seven-day",
  "enabled": true,
  "conditions": { "prefix": "daily/" },
  "deleteObjectsTransition": {
    "condition": { "type": "Age", "maxAge": 604800 }
  }
}
```

This is an actual bucket rule, independent of Worker Cron cleanup. Issue #1 item D's bucket configuration is now complete. Age-based expiry behavior over seven elapsed days is not claimed to have been observed during this task.

Account IDs, database IDs, native namespace IDs and any credentials are kept out of Git. The deployed resource configuration exists only in ignored `worker/wrangler.review.jsonc`.

## Current live follow-up

Cloud environment revision 10 activated the staging hostname. Real Chromium and unmocked Playwright API requests now reach the Worker through the inherited proxy with TLS verification. Exact-Origin rejection and native limiter/recovery checks passed. Safe malformed/oversize payload rejection and three PII-free browser analytics events were observed.

Provider-dependent checks remain blocked: repeated remote secret-list requests still return no deployed secrets, and the real Turnstile challenge returns 400 without a usable token. No inquiry persisted or real email was sent. The owner has authorized test notifications to the existing owner recipient. See [LIVE_MATRIX_STATUS.md](LIVE_MATRIX_STATUS.md) for the complete fourteen-item status and transport diagnosis; the earlier proxy tunnel rejection is resolved.

## Resume sequence

1. Securely add and **deploy** `TURNSTILE_SECRET_KEY` and `RESEND_API_KEY` in the exact staging Worker. Verify deployed names, never values.
2. Check the configured real widget's site key, matching secret, and allowed local hostname `127.0.0.1`; resolve its challenge 400 responses. Do not bypass verification or substitute test keys.
3. Resume the full matrix in `STAGING.md`, obtaining owner inbox confirmation after a successful real submission. Clean up synthetic staging records and restore any failure-injection changes.

No production Pages, production DNS, production database/bucket, or existing Worker was modified. No public frontend CTA was enabled. Public launch remains NO-GO.
