import { MenuPortraits } from '../ui/menu-portraits.js';

// Hero portraits in menus: React attaches canvases, the frame loop animates them in the menu.
export function createPortraits({ document, sprite }) {
  const portraits = MenuPortraits.create({ document, sprite, artStatus: () => 'canvas-v1' });
  const attached = new Map();
  let phase = -1;
  function attach(target, hero, { animated = true } = {}) {
    portraits.fit(target, hero, 0);
    if (animated) attached.set(target, hero);
    return () => attached.delete(target);
  }
  function animate(now) {
    const next = Math.floor(now / 190) % 8;
    if (next === phase) return;
    phase = next;
    for (const [target, hero] of attached) portraits.fit(target, hero, phase);
  }
  return { attach, animate };
}
