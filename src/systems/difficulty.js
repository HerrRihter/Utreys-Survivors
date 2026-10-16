import { loadModifiers, production } from '../../data/difficulty.js';

// Minutes spent in the endless mode; 0 before the player chose to continue.
export const productionMinutes = (s) =>
  s.endless ? Math.max(0, Math.floor((s.t - s.endlessStart) / 60)) : 0;

// Modifiers in force right now: the run's load level plus production growth.
export const runModifiers = (s) => loadModifiers(s.load || 1, productionMinutes(s));

// Enemy stats on spawn. `bosses` is the number of production CRPTs before this one.
export function scaleEnemy(e, m, bosses = 0) {
  const hp = 1 + m.hp + (e.boss ? m.bossHp + production.bossGrowth * bosses : 0);
  e.hp = e.max = Math.round(e.hp * hp);
  e.speed *= 1 + m.speed;
  e.damage = Math.max(1, Math.round(e.damage * (1 + m.damage)));
  return e;
}

// An elite copy of a unit: five times the health, bigger, harder hits, and an update bundle on death.
export const elite = { hp: 5, size: 1.3, damage: 1.5, speed: 0.9, xp: 5 };
export function makeElite(e) {
  e.elite = true;
  e.hp = e.max = Math.round(e.max * elite.hp);
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
