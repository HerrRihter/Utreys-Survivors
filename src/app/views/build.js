import { effectiveStats } from '../../systems/queries/abilities.js';
import { decimal, percent, withEmptySlots } from './format.js';

// The run's weapons, passives and final stats, for the pause panel and the level-up.

// Final numbers of the run's character with every bonus and active ability applied.
export function runStats(s) {
  const st = effectiveStats(s);
  const rows = [
    { label: 'Здоровье', value: `${Math.ceil(s.p.hp)} / ${decimal(s.p.max)}` },
    { label: 'Урон', value: percent(st.damage) },
    { label: 'Темп оружия', value: percent(st.haste) },
    { label: 'Темп атаки героя', value: percent(st.haste * (1 + (st.punchTempo || 0))) },
    { label: 'Область', value: percent(st.range) },
    { label: 'Скорость', value: percent(st.speed) },
    { label: 'Броня', value: String(st.armor || 0) },
    { label: 'Реген', value: decimal((st.regen || 0) * s.healFactor) + ' HP/с' },
    { label: 'Притяжение', value: String(Math.round(st.magnet)) },
  ];
  if (st.crit) rows.push({ label: 'Крит', value: percent(st.crit) });
  return rows;
}

export function buildView({ run, upgrades }) {
  const s = run.state;
  if (!s) return null;
  return {
    ...withEmptySlots(upgrades.build(run.selected, s)),
    stats: runStats(s),
    archives: s.evoTokens || 0,
  };
}
