import { useEffect, useRef } from 'react';
import { useSession } from '../session';

// Holding the button this long switches the hidden Penza mode instead of the sound.
const PENZA_HOLD_MS = 5000;
// The click that ends a completed hold does not also toggle the sound. Kept outside the
// component because the mode switch can re-mount the button under the finger.
let skipClick = false;

export function SoundButton({ id, enabled }: { id: string; enabled: boolean }) {
  const session = useSession();
  const penza = Boolean(session.views.settings().penza);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const release = () => {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  };
  useEffect(() => release, []);
  return (
    <button
      id={id}
      className="small"
      type="button"
      aria-label="Переключить звук"
      aria-pressed={enabled}
      onPointerDown={() => {
        release();
        skipClick = false;
        hold.current = setTimeout(() => {
          hold.current = null;
          skipClick = true;
          session.commands.togglePenza();
        }, PENZA_HOLD_MS);
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      // A long touch would open the browser's menu instead of finishing the hold.
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => {
        if (skipClick) {
          skipClick = false;
          return;
        }
        session.commands.toggleSound();
      }}
    >
      {penza ? 'ПЕНЗА' : 'ЗВУК'}: {enabled ? 'ВКЛ' : 'ВЫКЛ'}
    </button>
  );
}
