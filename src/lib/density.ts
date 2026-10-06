/**
 * Density presets — R4 baseline.
 *
 * Rules:
 * - Every preset carries provenance. No preset without a source.
 * - Carbon steel may ship with 7850 kg/m³ as a clearly labeled typical estimate.
 * - Stainless MUST NOT have one generic hidden density implying all grades
 *   are equal. 304/316 presets only with recorded provenance; otherwise the
 *   user enters a custom density explicitly.
 * - Density data is stored separately from dimensional-standard data.
 */

export interface DensityPreset {
  id: string;
  label: string;
  densityKgM3: number;
  /** how the UI must describe this value, e.g. "typical estimate" */
  assumptionLabel: string;
  source: string;
  verifiedAt: string; // ISO date
}

export const DENSITY_PRESETS: DensityPreset[] = [
  {
    id: 'carbon-steel',
    label: 'Carbon steel',
    densityKgM3: 7850,
    assumptionLabel: 'typical estimate',
    source: 'Common engineering reference value; labeled as estimate, user-overridable.',
    verifiedAt: '2026-10-06',
  },
];

/**
 * Resolve the density to use. Returns the value plus the label the UI
 * MUST display next to the result (R4: "density assumption always visible").
 */
export function resolveDensity(
  presetId: string | null,
  customKgM3: number | null,
): { densityKgM3: number; assumptionLabel: string } {
  if (customKgM3 !== null) {
    if (!Number.isFinite(customKgM3) || customKgM3 <= 0) {
      throw new Error(`custom density must be a positive finite number, got ${customKgM3}`);
    }
    return { densityKgM3: customKgM3, assumptionLabel: 'user-specified' };
  }
  const preset = DENSITY_PRESETS.find((p) => p.id === presetId);
  if (!preset) {
    throw new Error(
      `unknown density preset "${presetId}". Stainless presets require recorded provenance; use a custom density instead.`,
    );
  }
  return { densityKgM3: preset.densityKgM3, assumptionLabel: preset.assumptionLabel };
}
