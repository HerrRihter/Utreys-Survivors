import { abilityActive } from '../systems/queries/abilities.js';

const TAU = Math.PI * 2;

// Running abilities: the overclock/registry ring around the hero, the QA regression zone and
// the marks over enemies under BA's negotiations.
export function drawAbilities(g, s) {
  if (!s) return;
  const p = s.p;
  if (abilityActive(s, 'potion') || abilityActive(s, 'registry')) {
    g.strokeStyle = abilityActive(s, 'registry') ? '#6de2cd' : '#6ca99a';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(p.x, p.y, 32, 0, TAU);
    g.stroke();
  }
  const regress = s.abilities?.find((a) => a.id === 'regress' && a.left > 0 && a.origin);
  if (regress) {
    g.globalAlpha = Math.min(1, regress.left / 0.4);
    g.fillStyle = '#79edbd1c';
    g.strokeStyle = '#79edbd';
    g.lineWidth = 2;
    g.setLineDash?.([8, 6]);
    g.beginPath();
    g.arc(regress.origin.x, regress.origin.y, regress.radius, 0, TAU);
    g.fill();
    g.stroke();
    g.setLineDash?.([]);
    g.globalAlpha = 1;
  }
  if (abilityActive(s, 'negotiate')) {
    g.strokeStyle = '#f7ce70aa';
    g.lineWidth = 2;
    for (const e of s.enemies) {
      if (e.hp <= 0 || !(e.pacifiedUntil > s.t)) continue;
      g.beginPath();
      g.arc(e.x, e.y - e.r - 14, 5, 0, TAU);
      g.stroke();
    }
  }
}
