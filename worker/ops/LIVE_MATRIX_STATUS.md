# Live staging matrix

Updated 2026-10-07 Asia/Shanghai. Branch `codex/worker-d1-cta`; latest follow-up started at HEAD `2a4ee89dd874e9a5cea8e34d866e32e5c97afc9b`.

**Public launch remains NO-GO.** Real email delivery and native Cron recovery have been verified, including owner inbox confirmation. The updated cloud network configuration is active, but the genuine Turnstile widget still has not produced a usable token in this execution environment. Its failure cause is not established; this is not a complete fourteen-item sign-off.

## Real provider and operations evidence

- Both `TURNSTILE_SECRET_KEY` and `RESEND_API_KEY` are present in the active staging Worker, confirmed through secret-list and binding read-back. No values were read, printed or copied. The owner authorized test messages only to `wbspo1994@gmail.com`.
- The Worker made real siteverify requests. A synthetic invalid token produced HTTP 200 from siteverify with `success: false` and `invalid-input-response`; the application returned safe 403. This proves a real rejection path, not positive validation of a matching widget token.
- Three explicitly operator-seeded synthetic fixtures were created through prepared staging D1 operations: a normal notification probe, a stale `new` lead, and a record expiring during this run. **These were not customer API submissions and do not prove a durable customer 201 or submission atomicity.**
- A temporary staging-only wrapper delegated HTTP requests to the unchanged application handler. It used the existing native five-minute Cron to invoke the unchanged daily handler with its daily cron discriminator. It introduced no public control/restore endpoint and no provider or challenge mock. A pass-through fetch observer recorded only provider status, owner-recipient/HTML-escape/idempotency-key booleans and safe siteverify result categories; it returned actual provider responses unchanged.
- Temporarily setting staging `RESEND_FROM` to an unverified sender caused real Resend HTTP 403 for both the normal probe and the SLA alert. The original sender `onboarding@resend.dev` was restored, with both secrets preserved. The two fixtures' retry due times were advanced through controlled operator queries for the next native trigger; the observed first backoff itself was five minutes. This was temporary sender configuration failure, not a simulated network response.
- Native runs occurred at **05:40:45, 05:45:45 and 05:50:45 Asia/Shanghai** (21:40:45, 21:45:45, 21:50:45 UTC on October 6). First attempts received provider 403. The next run received provider 200; both outbox rows became `sent`, attempt count 2, cleared `last_error`.
- The owner explicitly confirmed **both** `[SPWC Inquiry]` and `[SPWC SLA alert]` arrived in `wbspo1994@gmail.com`. Only one stale-alert outbox row existed across repeated native runs; the third run did not send it again.
- The probe's real outgoing HTML contained escaped synthetic `img` and `script` text, no corresponding active tags, and a stable provider idempotency key. The provider accepted that payload and the owner confirmed its email arrived. The stored synthetic strings were data; no actual customer content was committed.
- The third native run deleted the expired inquiry and its outbox. Both queried counts were zero.
- The first real private R2 snapshot contained the fixture which later expired. `restoreBackup` read that old R2 object and restored into a separate fresh remote D1 database: expected 2 valid inquiries, restored 2, expired fixture count 0, active leases 0. This exercised real D1/R2 bindings and expiration filtering in the actual restore helper.
- Independent bucket lifecycle was re-read: enabled `spwc-backup-seven-day`, prefix `daily/`, deletion Age `604800` seconds. Managed public access is disabled and public custom domains are absent. Seven elapsed days of physical expiry were not observed.

The daily handler was accelerated for this test through a temporary wrapper running on the real native scheduler. This does **not** claim an observation of the nominal daily 02:00 UTC schedule over a day, or of week-long R2 expiration. The configured production-candidate handler was restored afterward.

## Client and abuse checks

- Unmocked API requests to the real staging Worker confirm local Origin `http://127.0.0.1:4321` preflight 204 with only that allow-origin value. Production Origin and `https://example.com` each return 403 on OPTIONS and POST without an allow-origin header.
- Malformed JSON returns safe 400; JSON exceeding 16 KiB returns safe 413. Earlier method/content-type checks also returned expected 405/400.
- A controlled concurrent burst of 60 invalid-token requests produced 52 challenge rejections and **8 native 429 responses**. After a 70-second recovery window, a new request passed the limiter and reached challenge rejection 403. An earlier sequential burst did not produce 429; this coarse distributed binding is not a global exact-accounting guarantee.
- A real browser against the local frontend emitted `sourcing_cta_view`, `sourcing_cta_click`, `sourcing_form_start`; every payload contained only `event`. Challenge failure/refresh preserved entered fields and calculator results. Successful/failed submission event coverage remains pending the customer path.
- Initial challenge error 400020 was resolved by updating the public site key in the running environment (revision 14). The subsequent 110200 hostname error was resolved after the owner added `127.0.0.1` to the matching widget. The next real challenge requested `brunhild.challenges.cloudflare.com`, which the environment proxy rejected with `ERR_TUNNEL_CONNECTION_FAILED`.
- The owner saved and published that exact destination. Current runtime metadata confirms revision **16**, with `brunhild.challenges.cloudflare.com` in the effective allowlist. Its HTTPS CONNECT nevertheless receives proxy HTTP 403 with **`No approved upstream IPv4 address`**. This is not evidence of an unpublished draft or a missing allowlist entry. It may be an auxiliary challenge probe; its causal role in widget failure has not been established.
- Retried the actual widget after publication with proxy CA trust and TLS verification intact. Its main `challenges.cloudflare.com` frame loads. Diagnosed an initial coordinate-click error: the component was partly below the viewport, so the click never entered its iframe. A normal Playwright frame-element click scrolls it into view and delivers trusted pointerdown, pointerup and click events to the real frame. Both standard headless and headed Chromium were examined; headed Chromium used the installed Xorg dummy display, without suppressing automation identifiers or altering the challenge. The widget still did not provide a usable token. One interaction/keyboard sequence showed the application's safe verification-failure message; another normal-click observation timed out without an error callback. No successful challenge or customer API submission is claimed.
- No TLS verification, proxy policy or challenge was bypassed; no dummy token/key was installed. Do not repeat network publication or rotate otherwise-working secrets solely on this evidence.
- A prepared customer-success run using the normal headed frame click stopped at the real-token gate after 45 seconds. It never submitted the form, created no inquiry, and did not reach mail delivery or the subsequent idempotency checks. The remaining customer fault-injection cases were not run without that prerequisite.

## Fourteen-item matrix

| # | Live outcome | Evidence / remaining requirement |
| --- | --- | --- |
| 1 | PARTIAL / BLOCKED | Real owner mail accepted and received for an operator-seeded probe. Real challenge + customer 201 + atomic inquiry/outbox still unrun. |
| 2 | BLOCKED | Staging-only outbox-insert trigger and browser preservation check prepared; execution requires a genuine token. Prior local failure injection passed separately. |
| 3 | PARTIAL / BLOCKED | Real mail failure, durable operator fixture, retry and delivery recovery verified. Customer-visible 201 after mail failure remains unrun. |
| 4 | BLOCKED | Original-ID replay/lost-response retry with fresh real challenges remains unrun. |
| 5 | PARTIAL | Real invalid-token siteverify rejection verified. Genuine token consumption, expiry, accepted hostname/action and successful refresh remain pending. |
| 6 | PASS | Exact local preflight and production/unrelated-Origin rejection against the unmocked staging API. |
| 7 | PASS | Native 429 observed in controlled burst and recovery verified. |
| 8 | PARTIAL | Safe malformed/oversize rejection passed. Normalized-field rejection following a genuine challenge remains unrun. |
| 9 | PASS (operator probe) | Real D1 synthetic XSS data, escaped real outgoing HTML, provider acceptance and owner receipt verified. Customer-submission variant remains blocked. |
| 10 | PASS (operator probe) | Actual native Cron recovered the real provider failure; both fixtures ended `sent` after 2 attempts. Retry due times were advanced for this bounded test. |
| 11 | PASS | One SLA alert outbox across three native runs; one received alert, with no additional third-run send. |
| 12 | PASS (accelerated daily handler) | Real native-scheduled daily-handler purge removed the expired inquiry/outbox. Nominal 02:00 UTC timing was not observed. |
| 13 | PASS (accelerated daily handler) | Actual private R2 snapshot restored into a separate real D1; expired data excluded and leases cleared. Independent lifecycle read-back verified. |
| 14 | PARTIAL | Three real browser events, no contact payload fields; submission success/failure events still pending. |

PASS qualifications above are material: they must not be removed or converted into customer-path PASS until those checks run. No local provider simulator result is relabeled as live.

## Restoration, cleanup and regression

- Re-deployed the original application handler from this branch to **staging only**, with original sender, existing D1/R2/native namespace bindings and both secrets preserved. Temporary restore binding/observer code is removed.
- Cron configuration remains exactly `*/5 * * * *` and `0 2 * * *`.
- Deleted exactly the three test-created R2 snapshot keys and verified each object absent. Deleted the separate test-created restore D1 after removing its Worker binding. Deleted synthetic operator inquiries/outbox and dropped both temporary control tables. Remote inquiry/outbox counts returned to **0/0**.
- After the revision-16 follow-up, remote bindings still contain both provider secrets, original sender `onboarding@resend.dev`, and no temporary restore binding. Inquiry/outbox counts remain **0/0**, with no temporary fault trigger or operations control tables.
- No production Pages, DNS, Worker, database, bucket or public CTA was changed. No application source, calculator, dependency lockfile or schema migration was changed.
- Most recent regression on unchanged application code passed: **136/136 unit tests**, including all **76 unchanged baseline tests**; Worker and frontend TypeScript; **7/7 local browser tests**; all **five actual build-gate scenarios**. Final CTA-disabled production output contains one calculator JS asset and no sourcing-form bundle. The revision-16 follow-up changes only reports and ignored diagnostic helpers; it did not repeat these suites. Report diff whitespace validation passed. Local mock-provider tests remain separate from the live results above.

## Resume

Network publication is complete. The remaining prerequisite is a genuine challenge which can complete in a supported interactive browser, or a confirmed provider/proxy diagnosis resolving this environment's failure. An ordinary desktop browser can run the exact local frontend against staging without obtaining Worker secret values; its public widget key must match the configured widget. Restore current proxy CA trust in Chromium if an environment restart replaces its NSS state; keep TLS verification and proxy routing enabled. Use the actual frame element's normal click/scroll behavior rather than stale viewport coordinates. Do not fabricate a token, bypass the challenge or treat an operator-seeded inquiry as customer-path success.

Continue the remaining genuine customer cases: successful submission and owner receipt; atomic D1 failure with every field preserved; lost-response/idempotency/material conflict; actual consumed/expired tokens; valid-challenge invalid fields; real mail failure retaining customer 201 and native recovery; all five PII-free frontend event types. Temporary local helpers/evidence are ignored under `worker/.wrangler/live`; tokens remain memory-only. Always recheck branch and deployed staging settings and clean up new fixtures afterward.

Full live sign-off, GPT review and explicit owner approval are required before any public launch. Current result remains **NO-GO**.
