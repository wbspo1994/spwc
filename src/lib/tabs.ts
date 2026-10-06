/**
 * Accessible tabs controller — APG tabs pattern with automatic activation.
 *
 * Framework-free: operates on a minimal element interface so the keyboard
 * semantics (roving tabindex, arrow/Home/End) are unit-testable without a DOM.
 * The host page owns the visual panel switching; this module owns the tab
 * attributes and keyboard behavior.
 *
 * R6 (GPT SPWC-R6R P1/P2): aria-controls, tabpanel roles (set in markup),
 * roving tabindex, Left/Right (+Up/Down) arrow activation, Home/End.
 */

export interface TabElement {
  id: string;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, listener: (event: TabKeyEvent) => void): void;
  focus(): void;
}

export interface TabKeyEvent {
  key: string;
  preventDefault(): void;
}

export interface TabsApi {
  /** Sync aria-selected + roving tabindex without notifying (no recursion). */
  sync(index: number): void;
  selectedIndex(): number;
}

export function initTabs(
  tabs: TabElement[],
  onSelect: (index: number) => void,
): TabsApi {
  if (tabs.length === 0) throw new Error('initTabs needs at least one tab');
  let current = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
  if (current < 0) current = 0;

  const sync = (index: number): void => {
    current = ((index % tabs.length) + tabs.length) % tabs.length;
    tabs.forEach((t, i) => {
      const selected = i === current;
      t.setAttribute('aria-selected', String(selected));
      // Roving tabindex: only the selected tab is in the tab order.
      t.setAttribute('tabindex', selected ? '0' : '-1');
    });
  };

  sync(current);

  tabs.forEach((tab) => {
    tab.addEventListener('keydown', (e: TabKeyEvent) => {
      let next: number | null = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = current + 1;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = current - 1;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      sync(next);
      tabs[current].focus();
      onSelect(current);
    });
  });

  return { sync, selectedIndex: () => current };
}
