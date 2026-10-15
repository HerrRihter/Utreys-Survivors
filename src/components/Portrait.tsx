import { useEffect, useRef } from 'react';
import { useSession } from './session';

// Hero portrait canvas; the session paints it and animates it while the menu is open.
export function Portrait({ hero, width, height }: { hero: string; width: number; height: number }) {
  const session = useSession();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const detach = session.commands.attachPortrait(ref.current, hero);
    return () => {
      detach();
    };
  }, [session, hero]);
  return <canvas ref={ref} width={width} height={height} data-portrait={hero} />;
}
