import { useEffect } from 'react';

// The engine owns visibility of these DOM islands. Observe that boundary rather
// than duplicating the session's modal state in React.
export function useGameDialogs() {
  useEffect(() => {
    const panels = ['runHeroSelect', 'levelup', 'paused', 'end', 'shop', 'achievements', 'settings']
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => Boolean(node));
    let active: HTMLElement | undefined;
    let returnFocus: HTMLElement | null = null;
    const controls = (panel: HTMLElement) =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]',
        ),
      ).filter((node) => node.getClientRects().length > 0);
    for (const panel of panels) {
      const dialog = panel.querySelector<HTMLElement>('[role="dialog"]') || panel;
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      const title = dialog.querySelector('h2');
      if (title) {
        title.id ||= `${panel.id}-title`;
        dialog.setAttribute('aria-labelledby', title.id);
      }
      panel.tabIndex = -1;
    }
    function synchronize() {
      const next = panels.find((panel) => !panel.classList.contains('hidden'));
      if (next === active) return;
      if (active && !next) {
        if (returnFocus?.isConnected && returnFocus.getClientRects().length) returnFocus.focus();
        returnFocus = null;
      }
      if (next) {
        if (!active) returnFocus = document.activeElement as HTMLElement | null;
        (controls(next)[0] || next).focus();
      }
      active = next;
    }
    const observer = new MutationObserver(synchronize);
    for (const panel of panels)
      observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
    function trap(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !active) return;
      const items = controls(active);
      const first = items[0] || active;
      const last = items.at(-1) || active;
      if (
        event.shiftKey &&
        (document.activeElement === first || !active.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !active.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', trap, true);
    synchronize();
    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', trap, true);
    };
  }, []);
}
