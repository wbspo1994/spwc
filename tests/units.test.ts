import { describe, it, expect } from 'vitest';
import { toMm, fromMm, toM, fromM, formatInputValue, MM_PER_IN, M_PER_FT } from '../src/lib/units';

describe('unit conversion (P0-1)', () => {
  it('constants are exact by definition', () => {
    expect(MM_PER_IN).toBe(25.4);
    expect(M_PER_FT).toBe(0.3048);
  });
  it('mm <-> in round-trips without drift', () => {
    for (const mm of [114.3, 21.34, 6.02, 0.5, 1000]) {
      expect(fromMm(toMm(mm / MM_PER_IN, 'in'), 'in')).toBeCloseTo(mm / MM_PER_IN, 12);
      expect(toMm(fromMm(mm, 'in'), 'in')).toBeCloseTo(mm, 12);
    }
  });
  it('m <-> ft round-trips without drift', () => {
    for (const m of [6, 6.096, 12, 0.5]) {
      expect(toM(fromM(m, 'ft'), 'ft')).toBeCloseTo(m, 12);
    }
  });
  it('identity conversions are exact', () => {
    expect(toMm(114.3, 'mm')).toBe(114.3);
    expect(toM(6, 'm')).toBe(6);
  });
  it('known conversions', () => {
    expect(toMm(4.5, 'in')).toBeCloseTo(114.3, 10);
    expect(fromMm(114.3, 'in')).toBeCloseTo(4.5, 10);
    expect(toM(20, 'ft')).toBeCloseTo(6.096, 10);
  });
  it('formatInputValue keeps round-trip precision', () => {
    // 114.3 mm -> in -> formatted -> parsed -> mm must return 114.3
    const asIn = formatInputValue(fromMm(114.3, 'in'), 'in');
    expect(toMm(parseFloat(asIn), 'in')).toBeCloseTo(114.3, 6);
  });
  it('rejects non-finite before conversion (caller contract)', () => {
    expect(Number.isFinite(toMm(NaN, 'in'))).toBe(false);
  });
});
