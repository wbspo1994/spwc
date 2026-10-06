/**
 * SPWC site-mode resolution — shared by Astro pages (Layout.astro),
 * scripts/seo.mjs (robots.txt / sitemap.xml / _headers), and vitest.
 *
 * Corrected indexability model (GPT SPWC-R6R, R6-P0-SEO1):
 * Google documents that `noindex` only works when the crawler can FETCH the
 * page. `robots.txt: Disallow: /` blocks the fetch, so Googlebot can never
 * read the noindex tag — and a blocked URL can still surface in Search when
 * discovered via links. Therefore:
 *   - preview/non-production builds: pages carry meta noindex (+ X-Robots-Tag
 *     via _headers), and robots.txt MUST NOT Disallow:/ — crawling stays
 *     allowed so the noindex directive is actually readable.
 *   - production builds: no noindex, canonical + sitemap on the real domain,
 *     robots.txt allows crawling.
 *   - fail-closed: placeholder/unset PUBLIC_SITE_URL can never produce a
 *     production-mode build.
 * Truly private previews should additionally be password-protected at the
 * hosting layer (Cloudflare Pages / Access) — a static build cannot enforce
 * that; see the deployment checklist in the frozen brief.
 */

export const SITE_MODES = ['preview', 'production'];

/**
 * A URL that can never be a production origin: unset, example.*, localhost,
 * or other non-public hosts. Any of these forces preview mode.
 */
export function isPlaceholderUrl(siteUrl) {
  const u = String(siteUrl || '').trim();
  if (!u) return true;
  const host = u
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .replace(/:\d+$/, '') // strip port (localhost:4321 -> localhost)
    .toLowerCase();
  return (
    /(^|\.)example\.(com|net|org|edu)$/.test(host) || // RFC 2606 reserved
    host.includes('example.pages.dev') || // default placeholder origin
    host === 'localhost' ||
    host.startsWith('127.') ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    host.endsWith('.test') ||
    host.endsWith('.invalid')
  );
}

/**
 * Resolve the build mode. Production requires ALL of:
 *  - PUBLIC_SITE_URL set to a non-placeholder https origin, AND
 *  - PUBLIC_NOINDEX !== 'true'.
 * Everything else is preview (fail-closed).
 */
export function resolveSiteMode({ siteUrl, noindexFlag } = {}) {
  if (noindexFlag === 'true') return 'preview';
  if (isPlaceholderUrl(siteUrl)) return 'preview';
  return 'production';
}

export function shouldNoindex(mode) {
  return mode !== 'production';
}

/**
 * robots.txt content for a build mode.
 * Preview deliberately ALLOWS crawling: the noindex signal (meta +
 * X-Robots-Tag) must be fetchable to be honored. Disallow:/ in preview was
 * the R6-P0-SEO1 defect — it does not de-index, it blinds the de-index signal.
 */
export function robotsTxtFor(mode, siteUrl) {
  const clean = String(siteUrl || '').replace(/\/$/, '');
  if (mode === 'production') {
    return `User-agent: *\nAllow: /\n\nSitemap: ${clean}/sitemap.xml\n`;
  }
  return (
    `# SPWC preview build — crawling allowed so that the noindex directive\n` +
    `# (meta robots + X-Robots-Tag via _headers) is readable by crawlers.\n` +
    `# Do NOT add Disallow here: a disallowed page's noindex can never be seen.\n` +
    `User-agent: *\nAllow: /\n`
  );
}

/**
 * Cloudflare Pages `_headers` content. Preview only: defense-in-depth
 * X-Robots-Tag so non-HTML assets also carry the signal. Production builds
 * must not ship this file.
 */
export function previewHeaders() {
  return (
    `# SPWC preview build — belt and braces with the meta noindex.\n` +
    `/*\n` +
    `  X-Robots-Tag: noindex, nofollow\n`
  );
}
