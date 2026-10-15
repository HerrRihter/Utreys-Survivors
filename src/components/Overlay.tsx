import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

const focusable =
  'button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]';

// Full-screen game panel. Modal panels take focus on open, keep Tab inside and give focus
// back to the element that opened them when they close.
export function Overlay({
  id,
  children,
  modal = true,
  style,
}: {
  id: string;
  children: ReactNode;
  modal?: boolean;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = ref.current;
    if (!modal || !panel) return;
    const returnFocus = document.activeElement as HTMLElement | null;
    const controls = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(focusable)).filter(
        (node) => node.getClientRects().length > 0,
      );
    (controls()[0] || panel).focus();
    function trap(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !panel) return;
      const items = controls();
      const first = items[0] || panel;
      const last = items.at(-1) || panel;
      const outside = !panel.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', trap, true);
    return () => {
      document.removeEventListener('keydown', trap, true);
      if (returnFocus?.isConnected && returnFocus.getClientRects().length) returnFocus.focus();
    };
  }, [modal]);
  return (
    <div
      id={id}
      ref={ref}
      className="overlay"
      tabIndex={-1}
      style={modal ? { zIndex: 40, ...style } : style}
    >
      {children}
    </div>
  );
}
