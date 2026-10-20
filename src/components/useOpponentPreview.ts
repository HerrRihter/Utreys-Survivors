import { useEffect, type RefObject } from 'react';
import type { PreviewKit } from '../app/types';

// Animates the bestiary: every unit card and the radar map, drawn by the page's preview kit.
export function useOpponentPreview({
  kit,
  motion,
  frozen,
  reverse,
  singleUnitAttacking,
  canvasRefs,
  canvasMapRef,
  phaseRef,
  radarRef,
  map,
}: {
  kit: PreviewKit;
  motion: 'walk' | 'attack' | 'hurt';
  frozen: boolean;
  reverse: boolean;
  singleUnitAttacking: Record<string, number>;
  canvasRefs: RefObject<Map<string, HTMLCanvasElement>>;
  canvasMapRef: RefObject<HTMLCanvasElement | null>;
  phaseRef: RefObject<number>;
  radarRef: RefObject<number>;
  map: string;
}) {
  useEffect(() => {
    let animId: number;
    let phase = phaseRef.current;
    let lastTime = performance.now();

    const loop = (t: number) => {
      // The first frame's timestamp can predate lastTime, so never let the clock run backwards:
      // a negative phase makes phase % delay negative and the blast preview's arc radius with it.
      const dt = Math.min(0.05, Math.max(0, (t - lastTime) / 1000 || 0));
      lastTime = t;
      if (!frozen) phase += dt;
      phaseRef.current = phase;

      for (const unit of kit.units) {
        const g = canvasRefs.current.get(unit)?.getContext('2d');
        if (!g) continue;
        const attacking = (singleUnitAttacking[unit] || 0) > phase;
        kit.drawOpponent(g, unit, { motion: attacking ? 'attack' : motion, phase, reverse });
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [kit, motion, frozen, reverse, singleUnitAttacking]);

  // Mini-map radar animation render
  useEffect(() => {
    const g = canvasMapRef.current?.getContext('2d');
    if (!g) return;

    let animId: number;
    let t = radarRef.current;
    const renderMap = () => {
      if (!frozen) t += 0.035;
      radarRef.current = t;
      kit.drawRadar(g, map, t);
      animId = requestAnimationFrame(renderMap);
    };

    renderMap();
    return () => cancelAnimationFrame(animId);
  }, [kit, frozen, map]);
}
