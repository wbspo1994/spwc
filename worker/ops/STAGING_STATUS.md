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

## Still blocked / not passed

- The cloud machine's HTTP request to the new staging endpoint was rejected by its egress proxy (`Tunnel connection failed: 403 Forbidden`). The exact hostname `spwc-inquiries-staging.wbspo1994.workers.dev` has been added to a saved network draft, preserving existing allowed domains. That draft must be saved/published and propagated before endpoint checks can run here.
- The staging Worker's secret-list API returned no secrets. `TURNSTILE_SECRET_KEY` and `RESEND_API_KEY` have not been provisioned there. No invented or test key was installed in the deployed Worker.
- Cloudflare API access to both the Turnstile widget list and the configured widget returned 403 / code 10000. The current token's successful Worker/D1/R2 access does not grant Turnstile widget access. Existing widgets were not modified.
- Configure the correct real widget's secret and the owner's existing Resend sending key securely in **staging Worker settings**. The Turnstile secret must match the public widget key configured for the local frontend. Proxy-managed cloud secret placeholders must not be copied into Worker secrets as raw keys.
- Actual endpoint responses, live Turnstile success/expiry/replay, owner inbox receipt, native rate-limit behavior, live cron retry/escalation/retention and remote R2 backup/restore are **unrun**. Provisioned bindings/cron metadata and prior local simulator results do not establish those live outcomes.

## Resume sequence

1. Save/publish the cloud environment network draft containing the exact staging endpoint hostname. Verify it is present in the running network policy and that HTTP requests reach the Worker.
2. Add `TURNSTILE_SECRET_KEY` and `RESEND_API_KEY` to `spwc-inquiries-staging` securely through its Worker settings. Do not post secrets in chat. Confirm secret names and challenge configuration without displaying values.
3. Run the local frontend against the staging API with the real public widget key and execute each live matrix item in `STAGING.md`. Owner inbox receipt requires owner confirmation; HTTP mail acceptance alone is insufficient.
4. Record live outcomes and clean up synthetic staging inquiries after testing. Public launch remains NO-GO until explicit review and owner approval.

No production Pages, production DNS, production database/bucket, or existing Worker was modified. No public frontend CTA was enabled. Only isolated staging resource writes and read-only inspections of existing resource metadata occurred.
