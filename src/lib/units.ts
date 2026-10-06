/**
 * Unit conversion for calculator inputs. All internal computation is SI
 * (mm for diameters/walls, m for length). Conversions are exact by
 * definition (1 in = 25.4 mm, 1 ft = 0.3048 m); rounding happens only
 * when formatting a value for display in an input field.
 */

export const MM_PER_IN = 25.4;
export const M_PER_FT = 0.3048;

export type LengthUnit = 'mm' | 'in';
export type SpanUnit = 'm' | 'ft';

export function toMm(value: number, unit: LengthUnit): number {
  return unit === 'in' ? value * MM_PER_IN : value;
}

export function fromMm(valueMm: number, unit: LengthUnit): number {
  return unit === 'in' ? valueMm / MM_PER_IN : valueMm;
}

export function toM(value: number, unit: SpanUnit): number {
  return unit === 'ft' ? value * M_PER_FT : value;
}

export function fromM(valueM: number, unit: SpanUnit): number {
  return unit === 'ft' ? valueM / M_PER_FT : valueM;
}

/**
 * Format a converted value for an <input> field: enough decimals to
 * survive a unit round-trip without visible drift, no trailing noise.
 */
export function formatInputValue(value: number, unit: LengthUnit | SpanUnit): string {
  const decimals = unit === 'mm' ? 3 : 4;
  return String(Number(value.toFixed(decimals)));
}
