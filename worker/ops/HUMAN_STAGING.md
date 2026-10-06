# Temporary frontend for owner human testing

Authorized 2026-10-07 (Asia/Shanghai). Review branch: `codex/worker-d1-cta`.

Exact test URL:

https://spwc-cta-human-staging.wbspo1994.workers.dev/steel-pipe-weight-calculator/

## Isolation and deployment evidence

- Independent static Worker: `spwc-cta-human-staging`. No Pages project, production Worker, DNS, domain, sitemap or production link was changed. The existing API token returns 403 for Pages; a separate static Worker uses the already authorized Worker deployment capability.
- Build flags: `PUBLIC_SITE_URL=https://spwc-cta-human-staging.wbspo1994.workers.dev`, `PUBLIC_NOINDEX=true`, `PUBLIC_SOURCING_CTA_ENABLED=true`, `PUBLIC_INQUIRY_API_URL=https://spwc-inquiries-staging.wbspo1994.workers.dev`, and the existing matching public widget key. No Worker secret is embedded in the frontend.
- All eight built HTML pages contain meta `noindex, nofollow` and staging canonical URLs. Every served response, including redirects and errors, adds `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`. This is public temporary testing, not an authenticated/private site.
- The static publish package omits `sitemap.xml`, Google production verification HTML and Pages control files. `/sitemap.xml` returns 404. Staging robots permits crawling so noindex can be read, with no sitemap advertisement. Production files/build scripts are unchanged.
- The exact publish handler was exercised locally for calculator, robots and missing sitemap. Cloudflare API read-back confirmed the uploaded script byte-for-byte and enabled workers.dev routing; deployment preview URLs are disabled. The cloud proxy currently denies a direct request to the new hostname (403); therefore a successful public HTTP/browser fetch is **not yet independently observed** from this cloud executor. The new hostname and startup instructions were saved in the cloud configuration draft for future verification. Draft saving is separate from runtime activation; owner browser access does not require publishing that draft.
- Staging API allows exactly `https://spwc-cta-human-staging.wbspo1994.workers.dev`, with Turnstile hostname `spwc-cta-human-staging.wbspo1994.workers.dev` and unchanged action `sourcing_inquiry`. Live preflight returns 204 with exactly that allow-origin. Production, former local and suffix-spoof Origins return 403 without allow-origin.
- Only staging Origin/hostname bindings and the minimal explicit Origin path were changed. Both provider secrets, sender, D1/R2/native limiter bindings and existing cron schedules were independently verified unchanged. Inquiry/outbox counts remain 0/0 before owner testing.
- 137/137 unit tests passed, including all unchanged 76 baseline tests and a new exact staging/preflight isolation test. Worker and frontend TypeScript passed; actual enabled/noindex frontend build passed. No calculator logic, datasets or source SEO behavior changed.

## Turnstile prerequisite

The API token returns 403 for widget management. We cannot inspect or update the provider widget's allowed hostnames with it. In the existing staging site key's **Hostname Management**, the owner must add:

`spwc-cta-human-staging.wbspo1994.workers.dev`

Use the hostname only, without scheme, port or path; preserve other widget settings/hostnames. Do not replace either secret or use test keys. The API's exact hostname check is already updated. Provider widget authorization remains owner-managed/unconfirmed until the owner verifies it.

## Owner testing — stop here

1. Add the widget hostname if it is not already present, then open the exact URL above in an ordinary desktop browser.
2. Confirm the calculator and sourcing form load. Use synthetic inquiry details, complete the real Turnstile and submit once.
3. Record whether the success screen shows an inquiry ID, and whether the corresponding owner notification arrives at `wbspo1994@gmail.com`. There is no buyer confirmation email. Report any visible error and whether entered fields remain; never share challenge tokens or secret values.
4. Wait for follow-up before more submissions or fault injection. The agent stops for this owner test; successful real-token validation, durable customer 201 and the remaining customer live matrix are not yet signed off.

Operator can verify the returned inquiry ID in staging D1 and its outbox without exposing inquiry contents in reports. Cleanup must target only agreed synthetic test IDs, preserving any owner-submitted evidence until reviewed. Do not apply test faults during this owner session.

## Rebuild / retirement

Rebuild the static frontend with the flags above and the securely configured **public** widget key using `npm run build`. Deploy only the separate staging Worker. The local ignored helper/evidence directory is `worker/.wrangler/live`; resource IDs and credentials must not enter Git. API source must be bundled as ESM and deployed only to `spwc-inquiries-staging`, keeping existing secrets/bindings/crons.

When owner testing/review is complete, retire only `spwc-cta-human-staging` and restore the agreed staging Origin/hostname through controlled staging settings. A public production enable remains NO-GO pending full review and explicit owner approval.
