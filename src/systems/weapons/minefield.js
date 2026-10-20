import { weaponDefinitions } from '../../../data/weapons.js';

// Mines dropped at the hero that blow up when an enemy comes near. An evolution multiplies
// the drops (`countFactor`) and the field (`limitFactor`); its `chain` lets a blast set off
// mines within `reach` blast radii after `delay` seconds.
export const minefield = {
  fire(c, s, w, v, st, evo) {
    const limit = v.limit * (evo?.limitFactor ?? 1);
    const drops = v.count * (evo?.countFactor ?? 1);
    let live = 0;
    for (const f of s.wfx) if (f.kind === 'landmine' && f.tag === w.id) live++;
    for (let i = 0; i < drops && live < limit; i++, live++)
      s.wfx.push({
        kind: 'landmine',
        tag: w.id,
        x: s.p.x + (drops > 1 ? c.math.rand(-22, 22) : 0),
        y: s.p.y + (drops > 1 ? c.math.rand(-14, 14) : 0),
        arm: 0.4,
        life: v.life,
        radius: v.radius * st.range,
        damage: v.damage * st.damage,
        chain: evo?.chain ?? null,
        color: weaponDefinitions[w.id].color,
      });
  },
  effects: {
    landmine(c, s, f, dt) {
      f.life -= dt;
      f.arm -= dt;
      if (f.arm > 0) return;
      if (f.trigger === undefined) {
        for (const e of s.enemies)
          if (e.hp > 0 && Math.hypot(e.x - f.x, e.y - f.y) < e.r + 22) {
            f.trigger = 0;
            break;
          }
      }
      if (f.trigger !== undefined) {
        f.trigger -= dt;
        if (f.trigger <= 0) explode(c, s, f);
      }
    },
  },
};

function explode(c, s, f) {
  if (f.life <= 0) return;
  f.life = 0;
  c.hitArea(s, f.x, f.y, f.radius, f.damage, 160, f.tag);
  s.fx.push({
    kind: 'ring',
    x: f.x,
    y: f.y - 4,
    r: f.radius,
    life: 0.3,
    max: 0.3,
    color: f.color,
  });
  c.audio.effect('hit');
  if (!f.chain) return;
  for (const other of s.wfx)
    if (
      other.kind === f.kind &&
      other.life > 0 &&
      other.trigger === undefined &&
      Math.hypot(other.x - f.x, other.y - f.y) < f.radius * f.chain.reach
    )
      other.trigger = f.chain.delay;
}
