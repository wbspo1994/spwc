# Live staging matrix: partial verification

Observed 2026-10-06 UTC (2026-10-07 Asia/Shanghai). Branch `codex/worker-d1-cta`; starting HEAD `732bd312abd58919e4fb885949e5e7812fb07591`.

**Public launch remains NO-GO. No live inquiry or email was successfully submitted in this run.** The owner authorized synthetic notification emails to `wbspo1994@gmail.com`; authorization does not establish delivery.

## Verified prerequisites and transport

- Running cloud configuration revision 10 includes the exact staging hostname. Cloudflare account API authentication succeeds.
- Real staging API: `https://spwc-inquiries-staging.wbspo1994.workers.dev/v1/inquiries`. Unmocked Playwright APIRequestContext, using the inherited proxy and TLS verification, reaches the Worker. GET returns JSON `405 / Use POST.`
- Python urllib requests received Cloudflare `403 / error code: 1010`; these were not application responses or the earlier proxy tunnel denial. Real Chromium also reaches the Worker after trusting the current environment proxy CA through its existing NSS database. Certificate verification remains enabled.
- The real local frontend runs at exact Origin `http://127.0.0.1:4321`, with the configured public widget key and remote staging API. Chromium must bypass the proxy for loopback only; external traffic remains proxied. The tested Chromium arguments and trust setup are saved in the environment startup draft.
- Re-read the actual R2 lifecycle: enabled `spwc-backup-seven-day`, prefix `daily/`, Age `604800` seconds. Managed public access remains disabled; custom public domains remain absent. Seven elapsed days of actual expiry were not observed.
- Remote Worker secret-list API repeatedly returns `[]`, including after the owner's first confirmation. Binding read-back also contains no secret bindings. This observation means the active staging deployment does not yet have the required provider secrets; it does not establish what was entered in a dashboard draft or another Worker. Confirm the exact Worker and deploy secret changes securely. Do not post values in chat.
- Real Turnstile script loads (302 followed by 200) and creates a challenge iframe. Challenge requests return 400; the frame shows `Troubleshoot`, and the form remains disabled after bounded waits. No real usable token was acquired. Widget management is unavailable with the current account token. Check the configured public site key, matching secret and support for hostname `127.0.0.1` through the owner's widget settings; the precise cause of these 400 responses remains undiagnosed.
- Remote D1 inquiry/outbox counts are both zero. This run performed no inquiry/outbox writes and requires no synthetic-record cleanup.

## Matrix outcomes

| # | Live result | Evidence / outstanding work |
| --- | --- | --- |
| 1 | BLOCKED | No real successful challenge, 201, atomic rows or owner email. Inbox receipt must be confirmed by the owner after a future successful send. |
| 2 | UNRUN | Staging D1 failure injection and browser preservation require a real successful challenge. Prior local simulator coverage is separate. |
| 3 | UNRUN | No post-commit mail failure injection, durable 201 or duplicate check yet. |
| 4 | UNRUN | No original persisted inquiry to exercise a fresh-challenge idempotent replay. |
| 5 | PARTIAL / BLOCKED | Synthetic invalid and missing tokens return safe 403. With the active secret absent, this does **not** prove real siteverify rejection. Actual expiry, replay, hostname/action enforcement remain unrun. |
| 6 | PASS | Unmocked API requests: local Origin OPTIONS returns 204 with only `http://127.0.0.1:4321`; production Origin and `https://example.com` each return 403 on OPTIONS and POST, without Access-Control-Allow-Origin. |
| 7 | PASS | Controlled burst against the real native limiter produced 429 with the safe retry message. After a 70-second recovery window, a new request passed the limiter and reached the challenge gate (403). Responses within the burst were mixed 403/429, consistent with coarse distributed limiting; no exact global 10-request guarantee is claimed. |
| 8 | PARTIAL | Malformed JSON returns safe 400; JSON exceeding 16 KiB returns safe 413; unsupported content type returns 400. Valid-challenge invalid-field validation remains unrun. |
| 9 | UNRUN | Synthetic XSS-looking company data was entered into the browser, but no inquiry persisted or actual mail was sent. Storage/actual-email escaping remains unverified live. |
| 10 | UNRUN | Native Cron retry recovery against the real mail provider remains unrun. |
| 11 | UNRUN | Native Cron stale-lead notification and repeat-run uniqueness remain unrun. |
| 12 | UNRUN | Native daily retention purge remains unrun. |
| 13 | PARTIAL | Actual private staging R2 settings and independent lifecycle verified. Remote snapshot/restore into a separate staging D1 database remain unrun. |
| 14 | PARTIAL | Real browser emitted `sourcing_cta_view`, `sourcing_cta_click`, `sourcing_form_start`; each payload contains only `event`, without contact fields. Success/failure events and the full submission path remain unrun live. |

The origin PASS above uses direct, unmocked API requests with explicit Origin headers. Early browser fixture attempts were inconclusive: Chromium routing can synthesize preflight responses, and browser fetch hides non-exposed CORS headers. Those attempts are excluded from PASS evidence. No Turnstile/provider/Worker response mock was used for the recorded live checks.

## Local regression and next steps

This resumed run also passed all **136 unit tests**, including the unchanged **76 baseline tests**, and the Worker TypeScript check. Previous 7/7 local browser and five build-gate checks remain prior results; they were not rerun or relabeled as live results in this run. Application source, calculator, schema, deployed Worker code and production resources were unchanged.

1. Securely deploy `TURNSTILE_SECRET_KEY` and `RESEND_API_KEY` into **spwc-inquiries-staging**. Verify deployed secret names before retrying provider-dependent tests.
2. Resolve the real widget's 400 challenge responses with the matching site key/secret and exact local hostname. Do not install dummy keys or bypass a challenge to obtain a PASS.
3. Resume the complete matrix in `STAGING.md`, beginning with a real successful submission and owner inbox confirmation. Inject failures only into isolated staging resources; restore configuration and remove synthetic records afterward.
4. Save/publish the cloud environment draft if the updated setup/startup instructions should be retained. This publishes the development environment, not the production website.

All fourteen matrix items must pass before public launch review and explicit owner approval. This partial run is not staging sign-off or launch authorization.
