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

Both provider secrets are deployed. Real Resend failure/recovery, native Cron retry and once-only SLA notification, accelerated daily retention purge, private R2 snapshot and restore into a separate remote D1 are verified. The owner confirmed both test emails reached the inbox. Exact-Origin and native limiter/recovery checks passed. The original staging Worker/settings are restored and operator fixtures, snapshots, temporary tables and restore database were cleaned; remote inquiry/outbox counts returned to 0/0.

The public site key and widget hostname were corrected. The owner saved/published the additional challenge destination; runtime revision 16 includes it in the effective allowlist. The proxy still returns `No approved upstream IPv4 address` for that destination. This may be an auxiliary probe and is not a proven cause of the widget failure. Normal clicks were delivered to the genuine widget in headed Chromium, but no usable token was obtained. Successful real-token customer submission, customer D1/mail-failure behavior and remaining token/analytics checks are still pending. Both Worker secrets, original sender, absence of temporary bindings/tables and remote counts 0/0 were rechecked. See [LIVE_MATRIX_STATUS.md](LIVE_MATRIX_STATUS.md) for every outcome and the material operator-seed/accelerated-schedule qualifications.

## Resume sequence

1. Network publication is complete. Obtain a genuine completed challenge in a supported interactive browser, or resolve a confirmed provider/proxy cause. Preserve proxy/TLS verification and re-establish current Chromium CA trust after runtime restart when needed. No further publication or secret rotation is established as necessary.
2. Start the exact local frontend and obtain a real token; execute all remaining customer-path cases, including true expiry/replay, real D1 rollback, 201 despite mail failure and full PII-free analytics.
3. Obtain customer-path owner receipt confirmation, clean test fixtures, restore staging settings and report every outcome separately. Full live sign-off remains incomplete.

No production resource or public frontend CTA was modified. Public launch remains NO-GO.
