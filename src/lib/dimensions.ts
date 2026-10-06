/**
 * Schedule-agnostic dimensional data model — R4 baseline.
 *
 * Key invariants:
 * - `scheduleDesignation` is a plain string ('40', '80', '5S', ...).
 *   '40' and '40S' are DIFFERENT identifiers. No aliasing, ever.
 * - Provenance is normalized at record level (sourceDocument +
 *   sourceRecordRef + verification metadata), not duplicated per cell.
 * - `availability`: a missing/unverified combination is an explicit product
 *   state ('unavailable'), never a guessed row.
 */

/**
 * Verification levels (R5: "verified" alone overstated the evidence).
 * Ordered strongest-first. Only non-pending levels may back production data —
 * per the frozen brief, pending/failed records never go live.
 */
export type VerificationStatus =
  | 'official_source_verified' // checked row-by-row against the authoritative source text
  | 'cross_checked_manufacturer' // secondary chart + independent manufacturer source agree
  | 'cross_checked_secondary' // two independent edition-named secondary sources agree
  | 'cross_checked_indirect' // secondary chart + edition change-record reasoning only
  | 'pending' // collected, not yet verified — never goes live
  | 'failed'; // verification failed — never goes live

/** Statuses that are allowed to back production data. */
export const PRODUCTION_STATUSES: VerificationStatus[] = [
  'official_source_verified',
  'cross_checked_manufacturer',
  'cross_checked_secondary',
  'cross_checked_indirect',
];

/** Public-facing label per level. Never imply official ASME row-level
 * verification unless the row was checked against the source text. */
export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  official_source_verified: 'Verified against the official source',
  cross_checked_manufacturer: 'Cross-checked against a manufacturer source',
  cross_checked_secondary: 'Cross-checked against independent sources',
  cross_checked_indirect: 'Cross-checked (indirect evidence)',
  pending: 'Pending verification',
  failed: 'Failed verification',
};
export type Availability = 'available' | 'unavailable';

export interface DimensionRecord {
  standardId: 'ASME B36.10' | 'ASME B36.19';
  edition: string; // e.g. '2022'
  sourceDocument: string;
  sourceRecordRef: string; // table/page/row reference within the source
  nps: string; // e.g. '4', '1/2'
  scheduleDesignation: string; // e.g. '40', '80', '5S', '10S' — never aliased
  odMm: number;
  wallMm: number;
  availability: Availability;
  verifiedBy: string;
  verifiedAt: string; // ISO date
  verificationMethod: string;
  verificationStatus: VerificationStatus;
}

export interface DimensionDataset {
  standardId: DimensionRecord['standardId'];
  edition: string;
  sourceStatement: string; // rendered on the page per R4
  checkDate: string;
  records: DimensionRecord[];
}

/** Lookup key — schedule designations compared EXACTLY. */
export function recordKey(standardId: string, edition: string, nps: string, schedule: string): string {
  return `${standardId}|${edition}|${nps}|${schedule}`;
}

export function findRecord(
  dataset: DimensionDataset,
  nps: string,
  scheduleDesignation: string,
): DimensionRecord | undefined {
  return dataset.records.find(
    (r) => r.nps === nps && r.scheduleDesignation === scheduleDesignation,
  );
}
