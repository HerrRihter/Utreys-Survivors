import { keyLabel } from './format.js';

/**
 * @typedef {{ icon: string, name: string, group: string, detail: string, desc: string,
 *   isNew: boolean, evolves: boolean, kind: string }} LevelCard
 * @returns {LevelCard[]}
 */
export function levelUpView({ run }) {
  return run.choice.map((u) => ({
    icon: u.icon,
    name: u.name,
    group: u.group || '',
    detail: u.detail || '',
    desc: u.desc,
    isNew: !!u.isNew,
    evolves: !!u.evolves,
    kind: u.kind || 'supply',
  }));
}

// Counters and key names for the level-up controls.
export function levelControlsView({ run, settings }) {
  const s = run.state;
  if (!s) return null;
  const b = settings.bindings;
  return {
    rerolls: s.rerolls || 0,
    skips: s.skips || 0,
    banishes: s.banishes || 0,
    banishArmed: !!run.banishArmed,
    keyboard: !run.touchOnly,
    keys: run.touchOnly
      ? null
      : { reroll: keyLabel(b.reroll), skip: keyLabel(b.skip), banish: keyLabel(b.banish) },
  };
}
