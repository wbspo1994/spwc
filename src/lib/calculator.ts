/**
 * SPWC calculation core — geometric theoretical weight.
 *
 * R4 baseline: single weight mode. Full precision through the entire
 * computation; rounding happens ONLY at display time, never between steps.
 * Do NOT multiply a displayed (rounded) value to derive batch totals.
 */

// Exact conversion constants
export const KG_PER_LB = 0.45359237;
export const M_PER_FT = 0.3048;
export const MM_PER_IN = 25.4;

/** 1 kg/m expressed in lb/ft */
export const KG_M_TO_LB_FT = (1 / KG_PER_LB) / (1 / M_PER_FT); // ≈ 0.671968975

export interface PipeInputs {
  /** outside diameter, mm */
  odMm: number;
  /** wall thickness, mm */
  wallMm: number;
  /** length per piece, m */
  lengthM: number;
  /** number of pieces */
  pieces: number;
  /** material density, kg/m³ — always an explicit, labeled assumption */
  densityKgM3: number;
}

export interface PipeResults {
  /** inside diameter, mm */
  idMm: number;
  /** metal cross-section area, mm² */
  areaMm2: number;
  /** mass per metre, kg/m */
  kgPerM: number;
  /** mass per foot, lb/ft */
  lbPerFt: number;
  /** mass per piece, kg */
  perPieceKg: number;
  /** total mass, kg */
  totalKg: number;
  /** total mass, metric tonnes */
  totalTonnes: number;
}

export class PipeInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PipeInputError';
  }
}

export function validateInputs(i: PipeInputs): void {
  const { odMm, wallMm, lengthM, pieces, densityKgM3 } = i;
  for (const [name, v] of Object.entries({ odMm, wallMm, lengthM, pieces, densityKgM3 })) {
    if (!Number.isFinite(v)) throw new PipeInputError(`${name} must be a finite number`);
    if (v <= 0) throw new PipeInputError(`${name} must be positive, got ${v}`);
  }
  if (odMm <= 2 * wallMm) {
    throw new PipeInputError(`wall thickness (${wallMm} mm) must be less than half the OD (${odMm} mm)`);
  }
  if (!Number.isInteger(pieces)) {
    throw new PipeInputError(`pieces must be an integer, got ${pieces}`);
  }
}

/**
 * Theoretical pipe weight from geometry. All values full precision.
 */
export function pipeWeight(i: PipeInputs): PipeResults {
  validateInputs(i);
  const { odMm, wallMm, lengthM, pieces, densityKgM3 } = i;
  const idMm = odMm - 2 * wallMm;
  // A = π/4 × (OD² − ID²), mm²
  const areaMm2 = (Math.PI / 4) * (odMm * odMm - idMm * idMm);
  // kg/m = A(mm²) × 1e-6 (m²/mm²) × ρ(kg/m³) × 1 (m)
  const kgPerM = areaMm2 * 1e-6 * densityKgM3;
  const lbPerFt = kgPerM * KG_M_TO_LB_FT;
  const perPieceKg = kgPerM * lengthM;
  const totalKg = perPieceKg * pieces;
  const totalTonnes = totalKg / 1000;
  return { idMm, areaMm2, kgPerM, lbPerFt, perPieceKg, totalKg, totalTonnes };
}

/** Display formatting — the ONLY place rounding happens. */
export function formatWeight(kgPerM: number, digits = 2): string {
  return kgPerM.toFixed(digits);
}
export function formatTonnes(t: number, digits = 3): string {
  return t.toFixed(digits);
}
