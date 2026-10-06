import { describe, it, expect } from 'vitest';
import b3610 from '../src/data/b36.10-2022.json';
import b3619 from '../src/data/b36.19-2022.json';
import type { DimensionDataset, DimensionRecord } from '../src/lib/dimensions';
import { PRODUCTION_STATUSES } from '../src/lib/dimensions';

const d10 = b3610 as DimensionDataset;
const d19 = b3619 as DimensionDataset;

function find(ds: DimensionDataset, nps: string, sched: string): DimensionRecord | undefined {
  // EXACT designation match — the production lookup rule. '40' must never
  // resolve a '40S' record, even where their dimensions coincide.
  return ds.records.find((r) => r.nps === nps && r.scheduleDesignation === sched);
}

describe('40/40S and 80/80S divergence (R4 anti-confusion rule)', () => {
  it('known structural divergences: walls differ beyond rounding noise', () => {
    // (nps, B36.10 sched, B36.19 sched, min expected wall delta mm)
    const cases: Array<[string, string, string, number]> = [
      ['10', '80', '80S', 1.0], // 15.09 vs 12.70
      ['12', '40', '40S', 0.5], // 10.31 vs 9.52
      ['12', '80', '80S', 1.0], // 17.48 vs 12.70
    ];
    for (const [nps, s10, s19, minDelta] of cases) {
      const a = find(d10, nps, s10)!;
      const b = find(d19, nps, s19)!;
      expect(a, `${nps} ${s10} exists`).toBeDefined();
      expect(b, `${nps} ${s19} exists`).toBeDefined();
      expect(Math.abs(a.wallMm - b.wallMm)).toBeGreaterThan(minDelta);
    }
  });

  it('NPS 5 Sch 80 vs 80S (9.53 vs 9.52) is rounding noise, not a structural divergence', () => {
    const a = find(d10, '5', '80')!;
    const b = find(d19, '5', '80S')!;
    expect(Math.abs(a.wallMm - b.wallMm)).toBeLessThanOrEqual(0.05);
  });

  it("cross-standard designations never resolve: '40' != '40S', '80' != '80S'", () => {
    for (const nps of ['1/2', '4', '10', '12']) {
      expect(find(d10, nps, '40S')).toBeUndefined();
      expect(find(d10, nps, '80S')).toBeUndefined();
      expect(find(d19, nps, '40')).toBeUndefined();
      expect(find(d19, nps, '80')).toBeUndefined();
    }
  });

  it('a silent 40<->40S substitution would corrupt weight at NPS 12 Sch 80', () => {
    // Demonstrates the stakes: wall 17.48 vs 12.70 on OD 323.8
    const correct = find(d10, '12', '80')!;
    const wrong = find(d19, '12', '80S')!;
    const area = (od: number, w: number) => (Math.PI / 4) * (od * od - (od - 2 * w) ** 2);
    const relErr =
      Math.abs(area(correct.odMm, wrong.wallMm) - area(correct.odMm, correct.wallMm)) /
      area(correct.odMm, correct.wallMm);
    expect(relErr).toBeGreaterThan(0.25); // >25% weight error — must never happen silently
  });

  it('every shipped record carries a production-grade verification level', () => {
    for (const ds of [d10, d19]) {
      for (const r of ds.records) {
        expect(PRODUCTION_STATUSES).toContain(r.verificationStatus);
        expect(r.verificationMethod.length).toBeGreaterThan(50);
      }
    }
  });
});
