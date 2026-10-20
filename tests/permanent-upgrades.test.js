import assert from 'node:assert/strict';
import { createRunModel, applyPermanentUpgrades } from '../src/systems/run-model.js';
import { getWaveSchedule } from '../src/systems/wave-schedule.js';
import { heroDefinitions } from '../data/characters/heroes.js';
import { heroPassives } from '../data/characters/hero-passives.js';
import {
  permanentUpgrades,
  permanentUpgradeDefinitions,
  heroTrainingDefinitions,
  levelUpControls,
} from '../data/upgrades.js';
import { test } from 'vitest';

// The start of a run as game-flow and upgrades.permanent computed it before the permanent
// upgrades moved into one place. Kept verbatim as the reference the new code must match.
test('permanent-upgrades', async () => {
  function previousStart(hero, levels) {
    const def = heroDefinitions[hero],
      health = def.hp + levels.health * permanentUpgradeDefinitions.health.factor;
    const s = {
      xp: 0,
      need: 8,
      stats: {
        damage: 1 + levels.power * permanentUpgradeDefinitions.power.factor,
        haste: 1,
        range: 1,
        speed: 1 + levels.speed * permanentUpgradeDefinitions.speed.factor,
        magnet: 75,
        armor: 0,
        regen: 0,
      },
      p: { hp: health, max: health },
    };
    for (const key of levelUpControls) s[key] = 1 + (levels[key] || 0);
    const add = (key, value) => (s.stats[key] = (s.stats[key] || 0) + value);
    for (const key of ['haste', 'range', 'magnet', 'armor', 'regen', 'greed', 'luck']) {
      const factor = permanentUpgradeDefinitions[key]?.factor;
      if (factor !== undefined) add(key, (levels[key] || 0) * factor);
    }
    for (const [key, value] of Object.entries(heroPassives[hero]?.stats || {})) add(key, value);
    const training = heroTrainingDefinitions[hero];
    if (training) add(training.stat, training.factor * (levels['training_' + hero] || 0));
    for (let i = 0, need = s.need; i < (levels.headStart || 0); i++) {
      s.xp += need;
      need = Math.floor(need * 1.23 + 3);
    }
    return s;
  }

  const ids = Object.keys(permanentUpgrades);
  const zero = Object.fromEntries(ids.map((id) => [id, 0]));
  const full = Object.fromEntries(ids.map((id) => [id, permanentUpgrades[id].max]));
  let seed = 99;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const sets = [zero, full, { ...zero, health: 3, power: 2, speed: 1 }, { ...zero, headStart: 1 }];
  for (let n = 0; n < 40; n++)
    sets.push(
      Object.fromEntries(
        ids.map((id) => [id, Math.floor(random() * (permanentUpgrades[id].max + 1))]),
      ),
    );

  const schedule = getWaveSchedule('empty');
  for (const hero of Object.keys(heroDefinitions))
    for (const levels of sets) {
      const s = createRunModel({
        hero,
        heroDef: heroDefinitions[hero],
        levels,
        load: 1,
        seed: 1,
        runId: 'test',
        map: 'empty',
        schedule,
        arenaSize: 2200,
      });
      const old = previousStart(hero, levels);
      const label = hero + ' ' + JSON.stringify(levels);
      assert.deepEqual(s.stats, old.stats, label + ': stats');
      assert.equal(s.p.max, old.p.max, label + ': max HP');
      assert.equal(s.p.hp, old.p.hp, label + ': HP');
      assert.equal(s.xp, old.xp, label + ': head start');
      for (const key of levelUpControls) assert.equal(s[key], old[key], label + ': ' + key);
    }

  // Every permanent upgrade is applied through its `stat`: one rank changes the run.
  for (const id of Object.keys(permanentUpgradeDefinitions)) {
    const base = createRunModel({
      hero: 'utrace',
      heroDef: heroDefinitions.utrace,
      levels: zero,
      load: 1,
      seed: 1,
      runId: 'test',
      map: 'empty',
      schedule,
      arenaSize: 2200,
    });
    const snap = () =>
      JSON.stringify([base.stats, base.p.max, base.xp, base.rerolls, base.skips, base.banishes]);
    const before = snap();
    applyPermanentUpgrades(base, 'nobody', { [id]: 1 });
    assert.notEqual(snap(), before, id + ' changes the run');
  }
  console.log(
    'PASS: permanent upgrades in one place match the previous start for ' +
      sets.length * Object.keys(heroDefinitions).length +
      ' hero/level sets',
  );
});
