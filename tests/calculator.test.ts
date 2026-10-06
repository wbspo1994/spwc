import { describe, it, expect } from 'vitest';
import {
  pipeWeight,
  PipeInputError,
  KG_M_TO_LB_FT,
  formatWeight,
} from '../src/lib/calculator';
import { resolveDensity, DENSITY_PRESETS } from '../src/lib/density';
import { findRecord, recordKey, type DimensionDataset } from '../src/lib/dimensions';

const REL_TOL = 1e-9;
function closeTo(actual: number, expected: number) {
  expect(Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-300)).toBeLessThan(REL_TOL);
}

describe('Sample A — default actual dimensions (plan §7.1)', () => {
  // D=114.3 mm, t=6 mm, L=6 m, N=10, ρ=7850
  const r = pipeWeight({ odMm: 114.3, wallMm: 6, lengthM: 6, pieces: 10, densityKgM3: 7850 });
  it('ID', () => closeTo(r.idMm, 102.3));
  it('area', () => closeTo(r.areaMm2, 2041.406906302648));
  it('kg/m', () => closeTo(r.kgPerM, 16.025044214476));
  it('lb/ft', () => closeTo(r.lbPerFt, 10.768332537367));
  it('per piece', () => closeTo(r.perPieceKg, 96.150265286855));
  it('total', () => closeTo(r.totalKg, 961.502652868547));
  it('tonnes', () => closeTo(r.totalTonnes, 0.961502652869));
  it('no premature rounding: total derived from full precision', () => {
    // The old wrong values (96.18 / 961.8) came from rounding early.
    expect(r.totalKg).not.toBeCloseTo(961.8, 1);
  });
});

describe('Sample B — schedule metric-baseline (plan §7.2)', () => {
  // OD=114.3, t=6.02, L=20ft=6.096m, N=10, ρ=7850
  const r = pipeWeight({ odMm: 114.3, wallMm: 6.02, lengthM: 6.096, pieces: 10, densityKgM3: 7850 });
  it('ID', () => closeTo(r.idMm, 102.26));
  it('kg/m', () => closeTo(r.kgPerM, 16.075491783643));
  it('lb/ft', () => closeTo(r.lbPerFt, 10.802231738718));
  it('per piece', () => closeTo(r.perPieceKg, 97.996197913090));
  it('total', () => closeTo(r.totalKg, 979.961979130903));
});

describe('Sample C — simple geometry (plan §7.3)', () => {
  // D=100, t=5, L=1, N=1, ρ=7850
  const r = pipeWeight({ odMm: 100, wallMm: 5, lengthM: 1, pieces: 1, densityKgM3: 7850 });
  it('ID', () => closeTo(r.idMm, 90));
  it('area', () => closeTo(r.areaMm2, 1492.256510455152));
  it('kg/m', () => closeTo(r.kgPerM, 11.714213607073));
});

describe('unit conversion sanity', () => {
  it('kg/m → lb/ft factor', () => {
    expect(KG_M_TO_LB_FT).toBeCloseTo(0.671968975, 9);
  });
});

describe('input validation', () => {
  const good = { odMm: 100, wallMm: 5, lengthM: 6, pieces: 10, densityKgM3: 7850 };
  it('rejects zero/negative', () => {
    expect(() => pipeWeight({ ...good, wallMm: 0 })).toThrow(PipeInputError);
    expect(() => pipeWeight({ ...good, odMm: -1 })).toThrow(PipeInputError);
  });
  it('rejects wall >= OD/2', () => {
    expect(() => pipeWeight({ ...good, odMm: 100, wallMm: 50 })).toThrow(PipeInputError);
  });
  it('rejects non-integer pieces', () => {
    expect(() => pipeWeight({ ...good, pieces: 2.5 })).toThrow(PipeInputError);
  });
  it('rejects non-finite', () => {
    expect(() => pipeWeight({ ...good, lengthM: Infinity })).toThrow(PipeInputError);
  });
});

describe('display rounding is separate from computation', () => {
  it('formats without touching the core value', () => {
    const r = pipeWeight({ odMm: 114.3, wallMm: 6, lengthM: 6, pieces: 10, densityKgM3: 7850 });
    expect(formatWeight(r.kgPerM)).toBe('16.03');
    expect(r.kgPerM).not.toBe(16.03); // core keeps full precision
  });
});

describe('density semantics (R4)', () => {
  it('carbon steel preset is a labeled typical estimate', () => {
    const p = DENSITY_PRESETS.find((x) => x.id === 'carbon-steel')!;
    expect(p.densityKgM3).toBe(7850);
    expect(p.assumptionLabel).toBe('typical estimate');
  });
  it('no generic stainless preset exists', () => {
    expect(DENSITY_PRESETS.some((x) => x.id.includes('stainless'))).toBe(false);
  });
  it('unknown preset throws — use custom instead', () => {
    expect(() => resolveDensity('ss304', null)).toThrow();
  });
  it('custom density is labeled user-specified', () => {
    const d = resolveDensity(null, 8000);
    expect(d).toEqual({ densityKgM3: 8000, assumptionLabel: 'user-specified' });
  });
});

describe('schedule-agnostic model: no aliasing', () => {
  const dataset: DimensionDataset = {
    standardId: 'ASME B36.10',
    edition: '2022',
    sourceStatement: 'test',
    checkDate: '2026-10-06',
    records: [
      {
        standardId: 'ASME B36.10', edition: '2022', sourceDocument: 't', sourceRecordRef: 't',
        nps: '4', scheduleDesignation: '40', odMm: 114.3, wallMm: 6.02,
        availability: 'available', verifiedBy: 't', verifiedAt: '2026-10-06',
        verificationMethod: 't', verificationStatus: 'verified',
      },
    ],
  };
  it('finds exact schedule', () => {
    expect(findRecord(dataset, '4', '40')?.wallMm).toBe(6.02);
  });
  it('does not alias 40S to 40', () => {
    expect(findRecord(dataset, '4', '40S')).toBeUndefined();
  });
  it('record keys distinguish 40 and 40S', () => {
    expect(recordKey('ASME B36.10', '2022', '4', '40')).not.toBe(
      recordKey('ASME B36.19', '2022', '4', '40S'),
    );
  });
});

describe('GPT SPWC-R6R worked-example display regression', () => {
  // 114.3 mm OD x 6 mm wall x 6 m x 10 pcs @ 7850 kg/m3 — the exact values
  // GPT independently recomputed. If the rendered example differs materially,
  // treat it as a regression.
  const r = pipeWeight({ odMm: 114.3, wallMm: 6, lengthM: 6, pieces: 10, densityKgM3: 7850 });
  it('kg/m', () => expect(r.kgPerM.toFixed(4)).toBe('16.0250'));
  it('lb/ft', () => expect(r.lbPerFt.toFixed(4)).toBe('10.7683'));
  it('per piece', () => expect(r.perPieceKg.toFixed(4)).toBe('96.1503'));
  it('total kg', () => expect(r.totalKg.toFixed(4)).toBe('961.5027'));
  it('tonnes', () => expect(r.totalTonnes.toFixed(4)).toBe('0.9615'));
});
