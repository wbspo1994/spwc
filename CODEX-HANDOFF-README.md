# SPWC — Codex Handoff (Worker + D1 CTA track)

Date: 2026-10-07. Prepared by Muse/Black per [GPT SPWC-CTA-HANDOFF].

## 1. What this package is

Complete SPWC (steel pipe weight calculator) frontend source tree, as used to
produce the current production deployment. Codex owns the Worker + D1
sourcing-CTA implementation track from here. Muse/Black stays as
product/commercial/SEO reviewer and does NOT make CTA code changes.

## 2. Production state (FROZEN — do not redesign the calculator)

- Production domain: https://steelpipe.wbspo.ccwu.cc
- Cloudflare Pages project: `spwc` (account ID on file with Muse; do not
  commit account IDs or tokens to the repo)
- Current serving deployment: `7ebe9d61` (12 files; = ec82b0e8 + Google
  Search Console verification HTML)
- Previous: `ec82b0e8` (recovery deployment that fixed the all-500 incident)
- `d433ba4f` was the broken deployment (wrong asset hash algorithm);
  retained for forensics, superseded.
- Calculator behavior, datasets, copy, and SEO are production-GO and frozen.
  Your work adds the CTA; it does not redesign the calculator.

## 3. Build & deploy

- Build: `npm run build` → `astro build && node scripts/seo.mjs`
  (seo.mjs generates sitemap.xml + robots.txt at build time)
- Required env at build time: `PUBLIC_SITE_URL=https://steelpipe.wbspo.ccwu.cc`
  (drives production site-mode: no noindex, canonical/sitemap/robots use the
  production domain)
- Deploy script (fixed 2026-10-07): `deploy/cf-pages-deploy.py`
  Uses Cloudflare Pages Direct Upload API. Asset keys MUST be
  `blake3(base64(file_bytes) + ext_without_dot).hexdigest()[:32]`
  (byte-exact port of workers-sdk hash.ts). SHA-256 keys cause universal
  HTTP 500 — this was the root cause of the 2026-10-07 incident.
- Tests: `npx vitest run` → 7 files, 76/76 passing (2026-10-07).

## 4. Source layout

- `src/pages/` — 8 routes: index, steel-pipe-weight-calculator (the
  calculator), methodology, guides/china-pipe-sourcing-standards, about,
  privacy, terms, 404 (+ __test.astro dev page, not linked)
- `src/lib/` — calculator.ts, dimensions.ts, units.ts, density.ts,
  site-mode.mjs, tabs.ts (a11y), analytics.ts
- `src/data/` — b36.10-2022.json, b36.19-2022.json (verified schedule data)
- `src/layouts/Layout.astro` — shared layout
- `public/` — static files copied verbatim (currently: Google site
  verification HTML)
- `scripts/seo.mjs` — build-time sitemap/robots generator
- `tests/` — 7 vitest files
- `docs/data-sources-research.md` — dataset provenance notes

## 5. Analytics (existing, reuse for CTA)

`src/lib/analytics.ts` — pushes to `window.dataLayer` + `spwc:analytics`
CustomEvent, no PII. Existing events:
`calculator_use`, `schedule_select`, `schedule_unavailable`,
`density_override`, `s_schedule_select`.
CTA analytics must not include email/company/notes in payloads.

## 6. Copy Codex may need to touch for CTA launch

- `src/pages/about.astro` — sourcing-assistance capability boundary copy
  ("What we can do / cannot do (yet)", "Typically within 2 business days")
- `src/pages/privacy.astro`, `src/pages/terms.astro` — update only what the
  CTA launch requires (inquiry data handling, 12-month retention).

## 7. CTA integration constraints (frozen baseline)

- Isolated API Worker + D1; do NOT convert the static Pages site into a
  coupled backend.
- Suggested API origin: `https://api.steelpipe.wbspo.ccwu.cc`, CORS allowlist
  = `https://steelpipe.wbspo.ccwu.cc` only.
- D1 is the single source of truth. Customer-visible success depends ONLY on
  durable D1 persistence — never on email delivery.
- Server-side: origin check, body cap, rate limit, Turnstile verify,
  field validation, recompute theoretical weight server-side (never trust
  browser totals), prepared statements, idempotency keys.
- Notification target: wbspo1994@gmail.com. Current email infra: Resend
  account (wbspo1994@gmail.com), sending-only API key `spwc-worker`,
  sandbox sender `onboarding@resend.dev` (delivers to account owner only —
  sufficient for V1 owner notifications; no domain verification needed).
- 12-month inquiry retention; backups must respect retention.
- No CRM/admin UI in V1 (email + D1 console suffice).
- Full 14-item Go/No-Go test matrix in [GPT SPWC-CTA-R0].

## 8. No git repo

This project has no git history. Import this archive as the initial commit
of your repo/local Codex workspace.
