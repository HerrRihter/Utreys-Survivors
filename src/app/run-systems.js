import { EnemySpawning } from '../systems/enemy-spawning.js';
import { CombatSystem } from '../systems/combat.js';
import { AbilitySystem } from '../systems/abilities.js';
import { RunEvents } from '../systems/run-events.js';
import { WeaponSystem } from '../systems/weapons.js';

// The game systems one simulation drives, each with exactly the collaborators it uses.
export function createRunSystems({
  run,
  world,
  corpses,
  progression,
  audio,
  cosmetic,
  toast,
  settings,
}) {
  const combat = CombatSystem.create({
    run,
    corpses,
    wallet: progression.wallet,
    records: progression.records,
    world,
    audio,
    cosmetic,
    toast,
    settings,
  });
  const weapons = WeaponSystem.create({ run, world, damage: combat.damage, audio });
  const abilities = AbilitySystem.create({
    run,
    world,
    damage: combat.damage,
    records: progression.records,
    audio,
  });
  const spawning = EnemySpawning.create({ run, world, toast, audio });
  const runEvents = RunEvents.create({
    run,
    world,
    spawning,
    wallet: progression.wallet,
    toast,
    audio,
  });
  return { combat, weapons, abilities, spawning, runEvents };
}
