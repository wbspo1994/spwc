# SPWC — Steel Pipe Weight Calculator

A free online calculator for the theoretical weight of steel pipe, built on the
ASME B36.10 / B36.19 pipe schedule data.

**Live site:** https://steelpipe.wbspo.ccwu.cc

## What it does

- Computes theoretical pipe weight per metre / per foot from nominal size,
  schedule, and steel density
- Verified schedule datasets for ASME B36.10 (welded and seamless wrought steel
  pipe) and ASME B36.19 (stainless steel pipe), 2022 editions
- Density override for different steel grades
- Metric / imperial unit conversion
- A methodology page documenting the formula and data sources, so every number
  the calculator produces can be checked by hand

## Tech stack

- [Astro](https://astro.build) 5 + TypeScript (static site)
- Vitest for the calculation test suite (76 tests)
- Deployed to Cloudflare Pages

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # astro build + sitemap/robots generation
npm test         # vitest run
```

## Project layout

- `src/pages/` — routes: calculator, methodology, guides, about, privacy, terms
- `src/lib/` — calculator, dimensions, units, density logic
- `src/data/` — B36.10 / B36.19 schedule datasets (JSON)
- `tests/` — Vitest suites for the calculation core

## License

MIT — see [LICENSE](LICENSE).
