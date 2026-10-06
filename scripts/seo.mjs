#!/usr/bin/env node
/**
 * Post-build SEO files: sitemap.xml + robots.txt (+ _headers in preview) in dist/.
 * URLs come from PUBLIC_SITE_URL (never hardcoded). Run via `npm run build`.
 *
 * Indexability model (GPT SPWC-R6R, R6-P0-SEO1 — corrected):
 *  - preview builds: pages carry meta noindex; robots.txt MUST stay crawlable
 *    (Allow:/) so crawlers can actually read the noindex signal. Disallow:/
 *    does NOT de-index — it prevents Googlebot from ever seeing the noindex
 *    tag, and blocked URLs can still appear in Search via discovered links.
 *    A _headers file adds X-Robots-Tag: noindex, nofollow as defense in depth.
 *  - production builds (real PUBLIC_SITE_URL, no PUBLIC_NOINDEX): indexable,
 *    canonical/sitemap on the production origin, robots.txt allows + sitemap.
 *  - fail-closed: placeholder/unset PUBLIC_SITE_URL can never yield a
 *    production-mode build (see src/lib/site-mode.mjs).
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSiteMode, robotsTxtFor, previewHeaders } from '../src/lib/site-mode.mjs';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const siteUrl = (process.env.PUBLIC_SITE_URL || 'https://example.pages.dev').replace(/\/$/, '');
const mode = resolveSiteMode({ siteUrl, noindexFlag: process.env.PUBLIC_NOINDEX });

const routes = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/steel-pipe-weight-calculator/', priority: '1.0', changefreq: 'weekly' },
  { path: '/methodology/', priority: '0.8', changefreq: 'monthly' },
  { path: '/guides/china-pipe-sourcing-standards/', priority: '0.8', changefreq: 'monthly' },
  { path: '/about/', priority: '0.5', changefreq: 'monthly' },
  { path: '/privacy/', priority: '0.3', changefreq: 'yearly' },
  { path: '/terms/', priority: '0.3', changefreq: 'yearly' },
];

const today = new Date().toISOString().slice(0, 10);
const sitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  routes
    .map(
      (r) =>
        `  <url><loc>${siteUrl}${r.path}</loc><lastmod>${today}</lastmod>` +
        `<changefreq>${r.changefreq}</changefreq><priority>${r.priority}</priority></url>`,
    )
    .join('\n') +
  `\n</urlset>\n`;

writeFileSync(join(dist, 'sitemap.xml'), sitemap);
writeFileSync(join(dist, 'robots.txt'), robotsTxtFor(mode, siteUrl));

if (mode === 'preview') {
  // Cloudflare Pages honors _headers in the publish directory.
  writeFileSync(join(dist, '_headers'), previewHeaders());
  console.log(`seo: mode=preview — wrote sitemap.xml + robots.txt (crawlable, no Disallow) + _headers (X-Robots-Tag noindex) for ${siteUrl}`);
} else {
  console.log(`seo: mode=production — wrote sitemap.xml + robots.txt for ${siteUrl}`);
}
