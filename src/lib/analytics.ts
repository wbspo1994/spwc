/**
 * SPWC analytics event layer — calculator track (frozen brief §13).
 *
 * Events (calculator-only; sourcing CTA events belong to the Worker/D1 track):
 *   calculator_use        — a successful calculation produced a new result
 *   schedule_select       — user picked a schedule option (any standard)
 *   s_schedule_select     — schedule picked within ASME B36.19 (stainless)
 *   schedule_unavailable  — the selected combo is visibly unavailable
 *   density_override      — user switched to / edited a custom density
 *
 * Transport: pushes to window.dataLayer (GTM-compatible) when present and
 * always dispatches a `spwc:analytics` CustomEvent so a future provider can
 * listen without GTM. Never throws; no-ops outside a browser or when no
 * transport exists. No PII is ever attached — props are dimension/choice
 * metadata only.
 */

export const CALCULATOR_EVENTS = [
  'calculator_use',
  'schedule_select',
  's_schedule_select',
  'schedule_unavailable',
  'density_override',
] as const;

export type CalculatorEventName = (typeof CALCULATOR_EVENTS)[number];

/** Minimal host surface we touch — injectable for tests. */
export interface AnalyticsTarget {
  dataLayer?: Array<Record<string, unknown>>;
  dispatchEvent?: (event: { type: string; detail?: unknown }) => boolean;
  CustomEvent?: new (type: string, opts?: { detail?: unknown }) => { type: string; detail?: unknown };
}

function defaultTarget(): AnalyticsTarget {
  const g = globalThis as unknown as Record<string, unknown>;
  return {
    dataLayer: Array.isArray(g['dataLayer'])
      ? (g['dataLayer'] as Array<Record<string, unknown>>)
      : undefined,
    dispatchEvent:
      typeof g['dispatchEvent'] === 'function'
        ? (g['dispatchEvent'] as AnalyticsTarget['dispatchEvent'])
        : undefined,
    CustomEvent:
      typeof g['CustomEvent'] === 'function'
        ? (g['CustomEvent'] as AnalyticsTarget['CustomEvent'])
        : undefined,
  };
}

export function trackEvent(
  name: CalculatorEventName | string,
  props: Record<string, unknown> = {},
  target: AnalyticsTarget = defaultTarget(),
): void {
  try {
    const payload = { event: name, ...props };
    if (target.dataLayer && Array.isArray(target.dataLayer)) {
      target.dataLayer.push(payload);
    }
    if (target.dispatchEvent && target.CustomEvent) {
      target.dispatchEvent(new target.CustomEvent('spwc:analytics', { detail: payload }));
    }
  } catch {
    // Analytics must never break the calculator.
  }
}
