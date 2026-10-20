import { drawNodes } from '../rendering/node-objectives.js';
import { drawEnemySpeech } from '../rendering/enemy-speech.js';
import { enemyPhrases, speechSettings } from '../../data/enemies/phrases.js';
import { createNodeState } from '../systems/node-objectives.js';
import { useEffect, type RefObject } from 'react';
import { unitDefinitions } from '../../data/enemies/units.js';
import { Enemies } from '../entities/enemies.js';
import { createArenas } from '../world/arenas.js';
import { createArenaFloor } from '../rendering/arena-floor.js';
import { ALL_UNIT_KEYS } from './opponent-details';

export function useOpponentPreview({
  motion,
  frozen,
  reverse,
  singleUnitAttacking,
  canvasRefs,
  canvasMapRef,
  phaseRef,
  radarRef,
}: {
  motion: 'walk' | 'attack' | 'hurt';
  frozen: boolean;
  reverse: boolean;
  singleUnitAttacking: Record<string, number>;
  canvasRefs: RefObject<Map<string, HTMLCanvasElement>>;
  canvasMapRef: RefObject<HTMLCanvasElement | null>;
  phaseRef: RefObject<number>;
  radarRef: RefObject<number>;
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

      for (const unit of ALL_UNIT_KEYS) {
        const canvas = canvasRefs.current.get(unit);
        if (!canvas) continue;
        const g = canvas.getContext('2d');
        if (!g) continue;

        const u = (unitDefinitions as typeof unitDefinitions)[unit];
        if (!u) continue;

        g.clearRect(0, 0, canvas.width, canvas.height);
        g.imageSmoothingEnabled = false;

        // Draw datacenter grid background inside preview
        g.fillStyle = '#08171a';
        g.fillRect(0, 0, canvas.width, canvas.height);
        g.strokeStyle = '#123038';
        g.lineWidth = 1;
        g.beginPath();
        for (let x = 0; x < canvas.width; x += 25) {
          g.moveTo(x, 0);
          g.lineTo(x, canvas.height);
        }
        for (let y = 0; y < canvas.height; y += 25) {
          g.moveTo(0, y);
          g.lineTo(canvas.width, y);
        }
        g.stroke();

        const cx = canvas.width / 2;
        const cy = canvas.height * 0.65;
        const isSingleAttacking = (singleUnitAttacking[unit] || 0) > phase;
        const effectiveMotion = isSingleAttacking ? 'attack' : motion;

        const bob = effectiveMotion === 'walk' ? Math.sin(phase * 8) * 3 : 0;
        const lunge =
          effectiveMotion === 'attack'
            ? (reverse ? -1 : 1) * Math.max(0, Math.sin(phase * 6) * 14)
            : 0;
        const shudder = effectiveMotion === 'hurt' ? Math.sin(phase * 28) * 2.5 : 0;
        const isHit = effectiveMotion === 'hurt' && Math.sin(phase * 12) > 0.1 ? 1 : 0;

        const aimX = cx + (reverse ? -130 : 130);
        const mockEnemy = {
          x: cx + lunge + shudder,
          y: cy + bob,
          unit,
          animationTime: phase,
          heading: reverse ? Math.PI : 0,
          hit: isHit,
          action:
            effectiveMotion === 'attack'
              ? {
                  aim: { x: aimX, y: cy },
                  hit: false,
                }
              : null,
        };

        if (effectiveMotion === 'attack') {
          // Role previews: the charger's lunge line and the artillery mark.
          if ('dash' in u && u.dash)
            Enemies.telegraph(g, {
              ...mockEnemy,
              action: null,
              dash: { phase: 'wind', dx: reverse ? -1 : 1, dy: 0 },
            });
          else Enemies.telegraph(g, mockEnemy);
          if ('mortar' in u && u.mortar)
            Enemies.hazard(g, {
              kind: 'blast',
              x: aimX,
              y: cy,
              r: u.mortar.radius,
              t: phase % u.mortar.delay,
              delay: u.mortar.delay,
              color: u.color,
            });

          // Unique functioning attack actions and projectiles
          if ('burst' in u && u.burst) {
            g.strokeStyle = u.burst.ring.color;
            g.beginPath();
            g.arc(cx, cy, u.burst.ring.r, 0, Math.PI * 2);
            g.stroke();
          } else if ('attack' in u && u.attack === 'pulse') {
            const waveR = 24 + ((phase * 80) % u.range);
            const waveAlpha = Math.max(0, 1 - waveR / u.range) * 0.75;
            g.strokeStyle =
              u.color +
              Math.round(waveAlpha * 255)
                .toString(16)
                .padStart(2, '0');
            g.lineWidth = 3;
            g.beginPath();
            g.arc(cx, cy - 16, waveR, 0, Math.PI * 2);
            g.stroke();
          } else if ('frontDamageMultiplier' in u) {
            g.strokeStyle = u.color + 'd9';
            g.lineWidth = 3.5;
            g.beginPath();
            const arcAngle = reverse ? Math.PI : 0;
            g.arc(cx + (reverse ? -26 : 26), cy - 14, 22, arcAngle - 1.1, arcAngle + 1.1);
            g.stroke();
          } else if ('attack' in u && u.attack === 'projectile') {
            const prog = (phase * 1.8) % 1;
            const px = cx + (reverse ? -1 : 1) * (prog * 115);
            Enemies.projectile(g, { x: px, y: cy - 10, kind: unit });
          }
        }

        Enemies.draw(g, mockEnemy);
        const phrases = enemyPhrases[unit];
        const cycle = Math.floor(phase / 10);
        if (phrases?.length && phase % 10 < speechSettings.duration) {
          drawEnemySpeech(
            g,
            {
              t: phase,
              enemies: [
                {
                  ...mockEnemy,
                  hp: 1,
                  speech: {
                    text: phrases[cycle % phrases.length],
                    until: cycle * 10 + speechSettings.duration,
                  },
                },
              ],
            },
            { x: 0, y: 0, width: canvas.width, height: canvas.height },
          );
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [motion, frozen, reverse, singleUnitAttacking]);

  // Mini-map radar animation render
  useEffect(() => {
    const canvas = canvasMapRef.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;

    let animId: number;
    let t = radarRef.current;
    const arenas = createArenas();
    const floor = createArenaFloor();

    const renderMap = () => {
      if (!frozen) t += 0.035;
      radarRef.current = t;
      const world = arenas.get('empty');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.setTransform(0.25, 0, 0, 0.25, 0, 0);
      floor.draw(g, world);
      drawNodes(g, createNodeState());

      // Radar pulses from core
      const pulse = 24 + ((t * 22) % 75);
      const pulseAlpha = Math.max(0, 1 - (pulse - 24) / 75) * 0.45;
      g.strokeStyle = `rgba(0, 229, 255, ${pulseAlpha})`;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(1100, 1100, pulse, 0, Math.PI * 2);
      g.stroke();

      // Center Core
      g.fillStyle = '#00e5ff';
      g.beginPath();
      g.arc(1100, 1100, 22, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 3;
      g.stroke();

      g.setTransform(1, 0, 0, 1, 0, 0);
      animId = requestAnimationFrame(renderMap);
    };

    renderMap();
    return () => cancelAnimationFrame(animId);
  }, [frozen]);
}
