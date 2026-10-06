import { describe, it, expect } from 'vitest';
import b3619 from '../src/data/b36.19-2022.json';
import type { DimensionDataset } from '../src/lib/dimensions';
import { PRODUCTION_STATUSES } from '../src/lib/dimensions';

const dataset = b3619 as DimensionDataset;

describe('B36.19-2022 dataset integrity', () => {
  it('has 60 records (15 NPS × 4 schedules)', () => {
    expect(dataset.records).toHaveLength(60);
  });
  it('every record carries full provenance', () => {
    for (const r of dataset.records) {
      expect(r.standardId).toBe('ASME B36.19');
      expect(r.edition).toBe('2022');
      expect(r.sourceDocument.length).toBeGreaterThan(0);
      expect(r.sourceRecordRef.length).toBeGreaterThan(0);
      expect(r.verifiedBy.length).toBeGreaterThan(0);
      expect(r.verificationMethod.length).toBeGreaterThan(0);
      expect(['official_source_verified', 'cross_checked_manufacturer', 'cross_checked_secondary', 'cross_checked_indirect', 'pending', 'failed']).toContain(r.verificationStatus);
    }
  });
  it('all records carry a production-grade verification level (R5: no bare "verified")', () => {
    // Owner decision 2026-10-06: the $74 standard text was declined; the
    // documented dual-source cross-check is the accepted verification bar.
    // R5: the bare label "verified" overstated the evidence — records now
    // carry explicit levels, and only non-pending levels go live.
    for (const r of dataset.records) {
      expect(PRODUCTION_STATUSES).toContain(r.verificationStatus);
      expect(r.verificationMethod.length).toBeGreaterThan(50);
    }
  });
  it('spot check: NPS 4 40S = 114.3 × 6.02 mm (matches plan sample B)', () => {
    const r = dataset.records.find((x) => x.nps === '4' && x.scheduleDesignation === '40S')!;
    expect(r.odMm).toBe(114.3);
    expect(r.wallMm).toBe(6.02);
  });
  it('40S/80S designations never collide with B36.10 40/80 namespace', () => {
    const designations = new Set(dataset.records.map((r) => r.scheduleDesignation));
    expect(designations.has('40')).toBe(false);
    expect(designations.has('80')).toBe(false);
  });
  it('all walls positive and less than OD/2', () => {
    for (const r of dataset.records) {
      expect(r.wallMm).toBeGreaterThan(0);
      expect(r.wallMm).toBeLessThan(r.odMm / 2);
    }
  });
});
