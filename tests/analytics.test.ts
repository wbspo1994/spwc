/**
 * Calculator analytics event layer (frozen brief §13, GPT SPWC-R6R P1).
 * No DOM required: the transport surface is injectable.
 */
import { describe, it, expect } from 'vitest';
import { trackEvent, CALCULATOR_EVENTS, type AnalyticsTarget } from '../src/lib/analytics';

function fakeTarget() {
  const pushed: Array<Record<string, unknown>> = [];
  const dispatched: Array<{ type: string; detail?: unknown }> = [];
  const target: AnalyticsTarget = {
    dataLayer: pushed,
    dispatchEvent: (e) => {
      dispatched.push(e);
      return true;
    },
    CustomEvent: function (this: { type: string; detail?: unknown }, type: string, opts?: { detail?: unknown }) {
      this.type = type;
      this.detail = opts?.detail;
    } as unknown as AnalyticsTarget['CustomEvent'],
  };
  return { target, pushed, dispatched };
}

describe('trackEvent', () => {
  it('pushes to dataLayer and dispatches spwc:analytics', () => {
    const { target, pushed, dispatched } = fakeTarget();
    trackEvent('calculator_use', { mode: 'actual' }, target);
    expect(pushed).toEqual([{ event: 'calculator_use', mode: 'actual' }]);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].type).toBe('spwc:analytics');
    expect((dispatched[0].detail as Record<string, unknown>)['event']).toBe('calculator_use');
  });

  it('never throws when no transport exists', () => {
    expect(() => trackEvent('schedule_select', { a: 1 }, {})).not.toThrow();
    expect(() => trackEvent('schedule_select')).not.toThrow();
  });

  it('exposes exactly the five frozen-brief calculator events', () => {
    expect([...CALCULATOR_EVENTS].sort()).toEqual(
      ['calculator_use', 'density_override', 's_schedule_select', 'schedule_select', 'schedule_unavailable'].sort(),
    );
  });
});
