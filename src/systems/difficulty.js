import { loadModifiers, production } from '../../data/difficulty.js';
import { unitDefinitions } from '../../data/enemies/units.js';

// Minutes spent in the endless mode; 0 before the player chose to continue.
export const productionMinutes = (s) =>
  s.endless ? Math.max(0, Math.floor((s.t - s.endlessStart) / 60)) : 0;

// Modifiers in force right now: the run's load level, production growth and the Penza run.
export const runModifiers = (s) => loadModifiers(s.load, productionMinutes(s), s.penza);

// Enemy stats on spawn. `bosses` is the number of production CRPTs before this one.
export function scaleEnemy(e, m, bosses = 0) {
  const hp = 1 + m.hp + (e.boss ? m.bossHp + production.bossGrowth * bosses : 0);
  e.hp = e.max = Math.round(e.hp * hp);
  // Speed bonuses stop at +50%: past that nothing can be outrun, only luck decides.
  e.speed *= Math.min(1 + m.speed, 1.5);
  e.damage = Math.max(1, Math.round(e.damage * (1 + m.damage)));
  return e;
}

// An elite copy of a unit: four times the health but at least `minHp` (scaled like the unit),
// bigger, harder hits, and an update bundle on death. The floor keeps an elite L3 as worth
// fighting as an elite tank.
export const elite = { hp: 4, minHp: 800, size: 1.3, damage: 1.4, speed: 0.9, xp: 5 };
export function makeElite(e) {
  const base = unitDefinitions[e.unit]?.hp || e.max;
  e.elite = true;
  e.hp = e.max = Math.round(Math.max(e.max * elite.hp, elite.minHp * (e.max / base)));
  e.r *= elite.size;
  e.damage = Math.round(e.damage * elite.damage);
  e.speed *= elite.speed;
  return e;
}

// Normal wave numbers after load modifiers.
export function scaleWave(wave, m) {
  return {
    ...wave,
    interval: wave.interval * Math.max(0.3, 1 + m.interval),
    batch: Math.ceil(wave.batch * (1 + m.batch)),
    cap: Math.round(wave.cap * (1 + m.cap)),
  };
}
