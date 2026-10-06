/**
 * GPT SPWC-R6R build tests for the corrected indexability model (R6-P0-SEO1).
 * These assert the decision logic + file generators that determine build
 * output, so a future regression in either is caught before deploy.
 */
import { describe, it, expect } from 'vitest';
import {
  isPlaceholderUrl,
  resolveSiteMode,
  shouldNoindex,
  robotsTxtFor,
  previewHeaders,
} from '../src/lib/site-mode.mjs';

describe('C — placeholder/unset domain fails closed to preview', () => {
  const bad = [
    undefined,
    '',
    'https://example.pages.dev',
    'https://example.com/',
    'http://localhost:4321',
    'https://127.0.0.1:3000',
    'https://staging.local',
  ];
  for (const siteUrl of bad) {
    it(`forces preview for ${JSON.stringify(siteUrl)}`, () => {
      expect(isPlaceholderUrl(siteUrl)).toBe(true);
      expect(resolveSiteMode({ siteUrl })).toBe('preview');
      expect(shouldNoindex(resolveSiteMode({ siteUrl }))).toBe(true);
    });
  }
  it('a real domain is not a placeholder', () => {
    expect(isPlaceholderUrl('https://pipes.example-site.com')).toBe(false);
  });
});

describe('B — production build is indexable and origin-correct', () => {
  const url = 'https://pipes.example-site.com';
  const mode = resolveSiteMode({ siteUrl: url });
  it('resolves production for a real PUBLIC_SITE_URL', () => {
    expect(mode).toBe('production');
  });
  it('emits no noindex signal', () => {
    expect(shouldNoindex(mode)).toBe(false);
  });
  it('robots.txt allows crawling and points at the production sitemap', () => {
    const robots = robotsTxtFor(mode, url);
    expect(robots).toContain('Allow: /');
    expect(robots).not.toContain('Disallow:');
    expect(robots).toContain(`Sitemap: ${url}/sitemap.xml`);
  });
});

describe('A — preview build: noindex readable, never Disallow:/', () => {
  const mode = resolveSiteMode({ siteUrl: 'https://example.pages.dev' });
  it('resolves preview', () => {
    expect(mode).toBe('preview');
  });
  it('PUBLIC_NOINDEX=true forces preview even on a real domain', () => {
    expect(
      resolveSiteMode({ siteUrl: 'https://pipes.example-site.com', noindexFlag: 'true' }),
    ).toBe('preview');
  });
  it('robots.txt stays crawlable so the noindex tag can be read', () => {
    const robots = robotsTxtFor(mode, 'https://example.pages.dev');
    expect(robots).toContain('Allow: /');
    // The R6-P0-SEO1 defect: Disallow:/ blinds the noindex signal.
    expect(robots).not.toMatch(/Disallow:\s*\//);
  });
  it('preview _headers carries X-Robots-Tag noindex as defense in depth', () => {
    expect(previewHeaders()).toContain('X-Robots-Tag: noindex');
  });
});
