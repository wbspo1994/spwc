/**
 * P2-1 (GPT SPWC-R6R): APG tabs keyboard semantics — roving tabindex,
 * ArrowLeft/Right (+Up/Down) activation with focus, Home/End.
 */
import { describe, it, expect, vi } from 'vitest';
import { initTabs, type TabElement, type TabKeyEvent } from '../src/lib/tabs';

interface StubTab extends TabElement {
  listeners: Record<string, Array<(e: TabKeyEvent) => void>>;
  focused: boolean;
  press(key: string): void;
}

function makeTab(id: string, selected: boolean): StubTab {
  const attrs = new Map<string, string>([['aria-selected', String(selected)]]);
  const listeners: Record<string, Array<(e: TabKeyEvent) => void>> = {};
  const tab: StubTab = {
    id,
    listeners,
    focused: false,
    getAttribute: (n) => attrs.get(n) ?? null,
    setAttribute: (n, v) => {
      attrs.set(n, v);
    },
    addEventListener: (t, l) => {
      (listeners[t] ||= []).push(l);
    },
    focus: () => {
      tab.focused = true;
    },
    press: (key: string) => {
      let prevented = false;
      const e: TabKeyEvent = { key, preventDefault: () => (prevented = true) };
      (listeners['keydown'] || []).forEach((l) => l(e));
      expect(prevented).toBe(true);
    },
  };
  return tab;
}

describe('initTabs', () => {
  it('normalizes roving tabindex from the preselected tab', () => {
    const tabs = [makeTab('a', true), makeTab('b', false)];
    initTabs(tabs, () => {});
    expect(tabs[0].getAttribute('tabindex')).toBe('0');
    expect(tabs[1].getAttribute('tabindex')).toBe('-1');
  });

  it('ArrowRight moves selection forward, wraps, focuses, notifies', () => {
    const tabs = [makeTab('a', true), makeTab('b', false)];
    const onSelect = vi.fn();
    initTabs(tabs, onSelect);
    tabs[0].press('ArrowRight');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    expect(tabs[1].getAttribute('tabindex')).toBe('0');
    expect(tabs[0].getAttribute('tabindex')).toBe('-1');
    expect(tabs[1].focused).toBe(true);
    expect(onSelect).toHaveBeenCalledWith(1);
    // wrap
    tabs[1].press('ArrowRight');
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('ArrowLeft moves backward and wraps', () => {
    const tabs = [makeTab('a', true), makeTab('b', false)];
    const onSelect = vi.fn();
    initTabs(tabs, onSelect);
    tabs[0].press('ArrowLeft');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('Home/End jump to first/last tab', () => {
    const tabs = [makeTab('a', false), makeTab('b', true), makeTab('c', false)];
    const onSelect = vi.fn();
    const api = initTabs(tabs, onSelect);
    expect(api.selectedIndex()).toBe(1);
    tabs[1].press('Home');
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    tabs[0].press('End');
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    expect(onSelect).toHaveBeenLastCalledWith(2);
  });

  it('sync() updates attributes without notifying (no recursion)', () => {
    const tabs = [makeTab('a', true), makeTab('b', false)];
    const onSelect = vi.fn();
    const api = initTabs(tabs, onSelect);
    api.sync(1);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('tabindex')).toBe('0');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ignores unrelated keys', () => {
    const tabs = [makeTab('a', true), makeTab('b', false)];
    const onSelect = vi.fn();
    initTabs(tabs, onSelect);
    let prevented = false;
    const e: TabKeyEvent = { key: 'Enter', preventDefault: () => (prevented = true) };
    tabs[0].listeners['keydown'].forEach((l) => l(e));
    expect(prevented).toBe(false);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(onSelect).not.toHaveBeenCalled();
  });
});
