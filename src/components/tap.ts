import type { MouseEvent, PointerEvent } from 'react';

// When the button last fired on a finger's touch; its own click right after is skipped.
const touchedAt = new WeakMap<EventTarget, number>();

// Props for an in-game button that works while another finger holds the movement stick.
// Mobile browsers make no click from a second finger, so a touch fires on pointerdown;
// a mouse click and the keyboard (Enter, Space) still fire through onClick.
export function tap(action: () => void) {
  return {
    onPointerDown(event: PointerEvent<HTMLButtonElement>) {
      // The canvas below would start the stick with this finger.
      event.stopPropagation();
      if (event.pointerType === 'mouse' || event.currentTarget.disabled) return;
      touchedAt.set(event.currentTarget, event.timeStamp);
      action();
    },
    onClick(event: MouseEvent<HTMLButtonElement>) {
      const at = touchedAt.get(event.currentTarget);
      if (at !== undefined && event.timeStamp - at < 1000) return;
      action();
    },
  };
}
