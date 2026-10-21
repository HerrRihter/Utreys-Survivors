import { unitDefinitions } from '../../data/enemies/units.js';
import { drawNodes } from './node-objectives.js';
import { drawEnemySpeech } from './enemy-speech.js';
import { cameraOrigin } from './camera.js';
import { drawEdgeArrows } from './edge-arrows.js';
import { drawEvent } from './events.js';
import { drawDoor } from './learning.js';
import { roomNodes } from '../systems/queries/learning.js';
import { drawPickup, drawEliteAura, drawGem, drawCodeToken } from './pickups.js';
import { drawFx } from './fx.js';
import { drawWeapons } from './weapons.js';
import { drawAbilities } from './abilities.js';
import { drawShot, drawEnemyShot } from './projectiles.js';
import { inBox } from '../core/math.js';

// Actors draw from the lowest y up; equal depths keep their update order, the hero last.
const byDepth = (a, b) => a.y - b.y;
// Draws one frame: arena floor, pickups, telegraphs, actors in depth order, effects and text.
export const SceneRenderer = {
  create({ ctx, floor, view, run, world, corpses, enemies, sprite, settings, cosmetic }) {
    const visible = [];
    const bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    let cachedVignette = null,
      cachedVignetteW = 0,
      cachedVignetteH = 0;
    function getVignette(w, h) {
      if (cachedVignette && cachedVignetteW === w && cachedVignetteH === h) return cachedVignette;
      cachedVignetteW = w;
      cachedVignetteH = h;
      cachedVignette = ctx.createRadialGradient(w / 2, h / 2, 150, w / 2, h / 2, 600);
      cachedVignette.addColorStop(0, 'transparent');
      cachedVignette.addColorStop(1, '#08171188');
      return cachedVignette;
    }
    function background(cx, cy) {
      ctx.fillStyle = '#0a1619';
      ctx.fillRect(0, 0, view.W, view.H);
      ctx.save();
      ctx.translate(-cx, -cy);
      floor.draw(ctx, world.arena, {
        x: cx - 20,
        y: cy - 20,
        width: view.W + 40,
        height: view.H + 40,
      });
      ctx.restore();
    }
    function draw() {
      const s = run.state,
        p = s ? s.p : { x: 1100, y: 1010 },
        { x: cx, y: cy } = cameraOrigin(p, view.W, view.H, world.arena.size, world.arena.rooms);
      ctx.save();
      if (s && s.shake && run.mode === 'play' && settings.shake !== false)
        ctx.translate((cosmetic() * 2 - 1) * s.shake, (cosmetic() * 2 - 1) * s.shake);
      background(cx, cy);
      ctx.save();
      ctx.translate(-cx, -cy);
      if (s) {
        bounds.minX = cx - 50;
        bounds.maxX = cx + view.W + 50;
        bounds.minY = cy - 50;
        bounds.maxY = cy + view.H + 50;
        // The learning map's rooms share the arena: only the room in play is drawn.
        drawNodes(ctx, roomNodes(s), s.enemies, s.t);
        drawDoor(ctx, s);
        drawEvent(ctx, s);
        for (const h of s.hazards || []) {
          if (!inBox(h, bounds, h.r)) continue;
          enemies.hazard(ctx, h);
        }
        corpses.draw(ctx, s.corpses, bounds);
        for (const h of s.codes) {
          if (!inBox(h, bounds)) continue;
          drawCodeToken(ctx, h.x, h.y);
        }
        for (const g of s.gems) {
          if (!inBox(g, bounds)) continue;
          drawGem(ctx, g);
        }
        for (const a of s.pickups) {
          if (!inBox(a, bounds)) continue;
          drawPickup(ctx, a, s.t);
        }
        for (const e of s.enemies) {
          if (!inBox(e, bounds, 70)) continue;
          if (e.elite) drawEliteAura(ctx, e, s.t);
          enemies.telegraph(ctx, e);
        }
        drawAbilities(ctx, s);
        drawWeapons(ctx, s, bounds, 'ground');
        // Sort only what can appear on screen.
        visible.length = 0;
        for (const e of s.enemies) if (inBox(e, bounds, 100)) visible.push(e);
        visible.push(p);
        visible.sort(byDepth);
        for (const e of visible) {
          const hero = e === p;
          // The hero's and enemies' art draws its own shadow.
          if (hero)
            sprite(
              ctx,
              run.selected,
              e.x,
              e.y,
              3,
              e.flip,
              p.inv > 0 && Math.floor(p.inv * 15) % 2 === 0,
              e,
            );
          else if (e.elite) {
            // Elites are drawn larger around their feet.
            ctx.save();
            ctx.translate(e.x, e.y);
            ctx.scale(1.3, 1.3);
            ctx.translate(-e.x, -e.y);
            enemies.draw(ctx, e);
            ctx.restore();
          } else enemies.draw(ctx, e);
          if (hero) {
            const aim = p.action?.direction || p.facing;
            ctx.save();
            ctx.translate(e.x, e.y);
            ctx.rotate(Math.atan2(aim.y, aim.x));
            ctx.fillStyle = '#00e5ff88';
            ctx.beginPath();
            ctx.moveTo(35, 0);
            ctx.lineTo(26, -5);
            ctx.lineTo(26, 5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = '#00e5ff';
            ctx.fillRect(e.x - 3, e.y - 45, 6, 2);
          } else if (e.hp < e.max && !e.boss) {
            const unitR = unitDefinitions[e.unit]?.r || 18;
            ctx.fillStyle = '#08171a';
            ctx.fillRect(e.x - 13, e.y - (unitR + 22), 26, 4);
            ctx.fillStyle = '#ff5252';
            ctx.fillRect(e.x - 12, e.y - (unitR + 21), (24 * Math.max(0, e.hp)) / e.max, 2);
          }
        }
        for (const b of s.enemyShots) drawEnemyShot(ctx, b);
        for (const b of s.shots) drawShot(ctx, b);
        drawWeapons(ctx, s, bounds, 'air');
        drawFx(ctx, s.fx);
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        for (const t of s.texts) {
          if (!inBox(t, bounds)) continue;
          ctx.globalAlpha = Math.min(1, t.life * 3);
          ctx.fillStyle = '#08171a';
          ctx.fillText(t.v, t.x + 1, t.y + 1);
          ctx.fillStyle = typeof t.v === 'string' ? '#64ffda' : '#00e5ff';
          ctx.fillText(t.v, t.x, t.y);
        }
        ctx.globalAlpha = 1;
        drawEnemySpeech(ctx, s, {
          x: cx,
          y: cy,
          width: view.W,
          height: view.H,
        });
      }
      ctx.restore();
      const vignette = getVignette(view.W, view.H);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, view.W, view.H);
      if (s) drawEdgeArrows(ctx, s, cx, cy, view.W, view.H);
      ctx.restore();
    }
    return { background, draw };
  },
};
