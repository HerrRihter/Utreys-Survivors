import { abilityRunning } from '../systems/queries/abilities.js';

const TAU = Math.PI * 2;

// Running abilities by kind (data/characters/abilities.js `kind`): the ring of a boost around
// the hero, the regression zone where it was cast and the marks over enemies under a truce.
const abilityPainters = {
  boost(g, s, a) {
    if (!a.ring || !abilityRunning(s, a)) return;
    g.strokeStyle = a.ring;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(s.p.x, s.p.y, 32, 0, TAU);
    g.stroke();
  },
  field(g, s, a) {
    if (!a.origin) return;
    g.globalAlpha = Math.min(1, a.left / 0.4);
    g.fillStyle = '#79edbd1c';
    g.strokeStyle = '#79edbd';
    g.lineWidth = 2;
    g.setLineDash?.([8, 6]);
    g.beginPath();
    g.arc(a.origin.x, a.origin.y, a.radius, 0, TAU);
    g.fill();
    g.stroke();
    g.setLineDash?.([]);
    g.globalAlpha = 1;
  },
  truce(g, s, a) {
    if (!abilityRunning(s, a)) return;
    g.strokeStyle = '#f7ce70aa';
    g.lineWidth = 2;
    for (const e of s.enemies) {
      if (e.hp <= 0 || !(e.pacifiedUntil > s.t)) continue;
      g.beginPath();
      g.arc(e.x, e.y - e.r - 14, 5, 0, TAU);
      g.stroke();
    }
  },
};

export function drawAbilities(g, s) {
  if (!s?.abilities) return;
  for (const a of s.abilities) if (a.left > 0) abilityPainters[a.kind]?.(g, s, a);
}
