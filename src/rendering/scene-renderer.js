import { drawNodes } from './node-objectives.js';
import { drawEnemySpeech } from './enemy-speech.js';
import { neonStroke } from './neon.js';
import { orderActors } from './depth-order.js';
import { cameraOrigin } from './camera.js';

// The datacenter has no depth-sorted scenery; orderActors still merges it when a map does.
const noScenery = [];
// Draws one frame: arena floor, pickups, telegraphs, actors in depth order, effects and text.
export const SceneRenderer = {
  create({
    ctx,
    view,
    run,
    world,
    corpses,
    heroes,
    enemies,
    abilities,
    sprite,
    settings,
    math,
    performance,
  }) {
    const visible = [];
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
      world.arena.drawGround(ctx, {
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
        { x: cx, y: cy } = cameraOrigin(p, view.W, view.H, world.arena.size);
      ctx.save();
      if (s && s.shake && run.mode === 'play' && settings.shake !== false)
        ctx.translate(math.rand(-s.shake, s.shake), math.rand(-s.shake, s.shake));
      background(cx, cy);
      ctx.save();
      ctx.translate(-cx, -cy);
      if (s) {
        const minX = cx - 50,
          maxX = cx + view.W + 50,
          minY = cy - 50,
          maxY = cy + view.H + 50;
        drawNodes(ctx, s.nodes);
        corpses.draw(ctx, s.corpses, cx, cy, view.W, view.H);
        for (const h of s.codes) {
          if (h.x < minX || h.x > maxX || h.y < minY || h.y > maxY) continue;
          heroes.codeToken(ctx, h.x, h.y);
        }
        for (const g of s.gems) {
          if (g.x < minX || g.x > maxX || g.y < minY || g.y > maxY) continue;
          ctx.fillStyle = '#142d25';
          ctx.fillRect(g.x - 4, g.y, 9, 5);
          ctx.fillStyle = g.v > 3 ? '#d4e890' : '#8bd3ac';
          ctx.beginPath();
          ctx.moveTo(g.x, g.y - 6);
          ctx.lineTo(g.x + 4, g.y - 1);
          ctx.lineTo(g.x, g.y + 4);
          ctx.lineTo(g.x - 4, g.y - 1);
          ctx.fill();
          ctx.fillStyle = '#d2f6c5';
          ctx.fillRect(g.x - 1, g.y - 4, 2, 3);
        }
        for (const a of s.pickups) {
          if (a.x < minX || a.x > maxX || a.y < minY || a.y > maxY) continue;
          // Futuristic data/energy recovery capsule
          ctx.fillStyle = '#00e5ff';
          ctx.fillRect(a.x - 7, a.y - 5, 14, 10);
          ctx.fillStyle = '#0a192f';
          ctx.fillRect(a.x - 5, a.y - 3, 10, 6);
          ctx.fillStyle = '#64ffda';
          ctx.fillRect(a.x - 3, a.y - 1, 6, 2);
        }
        for (const e of s.enemies) {
          if (e.x < minX - 70 || e.x > maxX + 70 || e.y < minY - 70 || e.y > maxY + 70) continue;
          enemies.telegraph(ctx, e);
        }
        abilities.draw(ctx);
        // Sort only what can appear on screen.
        visible.length = 0;
        for (const e of s.enemies)
          if (e.x >= minX - 100 && e.x <= maxX + 100 && e.y >= minY - 100 && e.y <= maxY + 100)
            visible.push(e);
        const actors = orderActors(noScenery, visible, p, run.selected);
        for (const e of actors) {
          if (
            !e.player &&
            (e.x < minX - 100 || e.x > maxX + 100 || e.y < minY - 100 || e.y > maxY + 100)
          )
            continue;
          const size = e.boss ? 3.5 : e.player ? 3 : 2.5;
          ctx.fillStyle = '#14291e66';
          ctx.beginPath();
          ctx.ellipse(e.x, e.y, (12 * size) / 2, (4 * size) / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          const bob = e.player
            ? p.moving
              ? Math.sin(s.step * 15) * 1.7
              : 0
            : Math.sin(s.step * 9 + e.phase) * 1.4;
          if (e.player)
            sprite(
              ctx,
              e.type,
              e.x,
              e.y,
              size,
              e.flip,
              bob,
              p.inv > 0 && Math.floor(p.inv * 15) % 2 === 0,
              e.phase || 0,
              e,
            );
          else enemies.draw(ctx, e);
          if (e.player) {
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
            const unitR = enemies.units[e.unit]?.r || 18;
            ctx.fillStyle = '#08171a';
            ctx.fillRect(e.x - 13, e.y - (unitR + 22), 26, 4);
            ctx.fillStyle = '#ff5252';
            ctx.fillRect(e.x - 12, e.y - (unitR + 21), (24 * Math.max(0, e.hp)) / e.max, 2);
          }
        }
        for (const b of s.enemyShots) enemies.projectile(ctx, b);
        for (const b of s.shots) {
          const g = ctx;
          g.save();
          g.translate(b.x, b.y);
          g.rotate(Math.atan2(b.vy, b.vx));
          g.fillStyle = b.color || '#009dbb';
          g.fillRect(-10, -6, 20, 12);
          g.beginPath();
          g.rect(-10, -6, 20, 12);
          neonStroke(g, b.color || '#00e5ff', 1, 5);
          g.fillStyle = '#ffffff';
          for (let i = 0; i < 4; i++) g.fillRect(-7 + i * 4, -4, 2, 8);
          g.restore();
        }
        for (const f of s.fx) {
          ctx.save();
          ctx.globalAlpha = f.life / f.max;
          if (f.kind === 'link') {
            ctx.strokeStyle = f.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(f.x, f.y);
            ctx.lineTo(f.toX, f.toY);
            neonStroke(ctx, f.color, 4, 10);
            const g = ctx;
            const progress = 1 - f.life / f.max;
            g.fillStyle = '#d1fff1';
            for (let i = 0; i < 3; i++) {
              const t = (progress * 2 + i / 3) % 1;
              const x = f.x + (f.toX - f.x) * t;
              const y = f.y + (f.toY - f.y) * t;
              g.fillRect(x - 3, y - 3, 6, 6);
            }
            g.beginPath();
            g.arc(f.toX, f.toY, 8, 0, Math.PI * 2);
            neonStroke(g, f.color, 2, 5);
          } else if (f.kind === 'scan' || f.kind === 'scanTarget') {
            const g = ctx;
            const r = f.r;
            g.beginPath();
            g.rect(f.x - r, f.y - r, r * 2, r * 2);
            neonStroke(g, f.color, 2, 6);
            if (f.kind === 'scan') {
              const y = f.y - r + 2 * r * (1 - f.life / f.max);
              g.fillStyle = '#79edbd12';
              g.fillRect(f.x - r, f.y - r, r * 2, r * 2);
              g.beginPath();
              g.moveTo(f.x - r, y);
              g.lineTo(f.x + r, y);
              neonStroke(g, f.color, 3, 5);
            } else {
              g.beginPath();
              g.moveTo(f.x - 6, f.y);
              g.lineTo(f.x + 6, f.y);
              g.moveTo(f.x, f.y - 6);
              g.lineTo(f.x, f.y + 6);
              neonStroke(g, f.color, 1, 3);
            }
          } else if (f.kind === 'spark') {
            ctx.fillStyle = f.color || '#00e5ff';
            ctx.fillRect(f.x, f.y, 3, 3);
          } else {
            ctx.strokeStyle =
              f.color ||
              (f.kind === 'slash' ? '#00e5ff' : f.kind === 'ring' ? '#64ffda' : '#ff5252');
            ctx.lineWidth = f.kind === 'slash' ? 7 : 3;
            ctx.beginPath();
            const r = f.r * (1 - (f.life / f.max) * 0.3);
            ctx.arc(
              f.x,
              f.y,
              r,
              f.kind === 'slash' ? f.angle - (f.half || Math.PI / 4) : 0,
              f.kind === 'slash' ? f.angle + (f.half || Math.PI / 4) : Math.PI * 2,
            );
            neonStroke(ctx, ctx.strokeStyle, f.kind === 'slash' ? 3 : 1.5, 6);
            if (f.kind === 'slash') {
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(
                f.x,
                f.y,
                r - 12,
                f.angle - (f.half || Math.PI / 4),
                f.angle + (f.half || Math.PI / 4),
              );
              ctx.stroke();
            }
          }
          ctx.restore();
        }
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        for (const t of s.texts) {
          if (t.x < minX || t.x > maxX || t.y < minY || t.y > maxY) continue;
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
      } else {
        for (let i = 0; i < 14; i++)
          sprite(
            ctx,
            run.selected,
            1300 + (i % 5) * 47,
            890 + Math.floor(i / 5) * 60,
            2,
            i % 2 === 0,
            Math.sin(performance.now() / 300 + i),
          );
      }
      ctx.restore();
      const vignette = getVignette(view.W, view.H);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, view.W, view.H);
      ctx.restore();
    }
    return { background, draw };
  },
};
