// @ts-check
import { createNodeState } from './node-objectives.js';
import { createWaveState } from './wave-schedule.js';
import { layoutNodes, planEvents } from './run-layout.js';
import { abilityDefinitions } from '../../data/characters/abilities.js';
import { baClientIds } from '../../data/characters/ba-specialization.js';
import { permanentUpgradeDefinitions, heroTrainingDefinitions } from '../../data/upgrades.js';
import { heroPassives } from '../../data/characters/hero-passives.js';
import { workaroundSeconds } from '../../data/enemies/nodes.js';
import { speechSettings } from '../../data/enemies/phrases.js';
import { loadModifiers } from '../../data/difficulty.js';
import { createGameRng } from '../core/rng.js';

/**
 * The state of one run (`run.state`). Every field exists from the start: systems change
 * values, they never add fields.
 *
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ elapsed: number, duration: number, flip: boolean }} HurtTimer
 * @typedef {{ elapsed: number, duration: number, hit: boolean, flip: boolean, aim: Point,
 *   direction?: Point }} ActorAction
 * @typedef {{ x: number, y: number, hp: number, max: number, speed: number, inv: number,
 *   flip: boolean, facing: Point, walk: number, moving: boolean, hurt: HurtTimer | null,
 *   action: ActorAction | null, slowUntil: number, slowAmount: number,
 *   chainImpactAt: number | null }} Player
 * @typedef {{ damage: number, haste: number, range: number, speed: number, magnet: number,
 *   armor: number, regen: number }} BaseStats
 * Level-ups, passives and trainings add more modifiers by name (crit, weaponSlots, heroEvo...).
 * @typedef {BaseStats & Record<string, number | boolean>} RunStats
 * @typedef {{ x: number, y: number, unit: string, type: 'enemy' | 'boss', hp: number,
 *   max: number, r: number, speed: number, damage: number, boss: boolean, hit: number,
 *   cd: number, phase: number, vx: number, vy: number, heading: number, elite?: boolean,
 *   id: number, summonerId: number | null, nodeId: string | null }} EnemyCore
 * Behaviours keep their own timers on the enemy (summonCd, wcd, speech...).
 * @typedef {EnemyCore & Record<string, unknown>} Enemy
 * @typedef {{ id: string, label: string, kind?: string, bug: string, x: number, y: number, need: number,
 *   status: string, progress: number,
 *   guardianId: number | null }} RunNode
 * @typedef {{ id: string, level: number, cd: number, evolved: boolean, phase: number,
 *   tick?: number }} OwnedWeapon
 * @typedef {{ id: string, name: string, cooldown: number, duration: number, cd: number,
 *   left: number } & Record<string, unknown>} RunAbility
 * @typedef {{ time: number, type: string }} PlannedEvent
 * @typedef {{ type: string, left: number, progress: number, need: number, x?: number,
 *   y?: number, radius?: number }} RunEvent
 * @typedef {{ level: number, cards: string[], picked: string | null,
 *   action: 'pick' | 'skip' | null, rerolls: number, banned: string[] }} OfferRecord
 * @typedef {{ x: number, y: number, v: number, dead?: boolean, pull?: boolean }} Gem
 * @typedef {{ x: number, y: number, value: number, event?: boolean, dead?: boolean }} CodeToken
 * @typedef {{ x: number, y: number, type: string, dead?: boolean }} Pickup
 * Short-lived world objects (shots, effects, hazards, corpses). The player's
 * projectiles are `shots` (the hero's packets) and `wfx` (weapon shots, mines, zones), both
 * moved by the projectile kinds of src/systems/projectiles.js.
 * @typedef {Record<string, unknown>} WorldObject
 * @typedef {{ client: string, bonus: number }} BaSpecialization
 *
 * Caches of the running simulation (counted once per step, read later in the step) and the
 * cosmetic cursors of enemy speech.
 * @typedef {{ crowd: number, guards: Enemy[], attackCycle: number,
 *   speechPhraseIndex: Record<string, number>, speechCursor: number,
 *   nextSpeechAt: number }} RunRuntime
 *
 * The run's game random source (src/core/rng.js), made from the seed.
 * @typedef {ReturnType<typeof createGameRng>} GameRng
 *
 * @typedef {{
 *   t: number, step: number, runId: string, map: string, seed: number, rng: GameRng,
 *   load: number,
 *   healFactor: number,
 *   eventPlan: PlannedEvent[], eventIndex: number, event: RunEvent | null, eventsDone: number,
 *   spawn: number, waveNext: Record<string, number>, bossSpawned: boolean, eliteNext: number,
 *   kills: number, level: number, xp: number, need: number, earned: number,
 *   attack: number, runtime: RunRuntime,
 *   p: Player, stats: RunStats, heroWeaponName: string,
 *   abilities: RunAbility[], weapons: OwnedWeapon[], evoTokens: number, evolutions: number,
 *   upgradeRanks: Record<string, number>, banned: string[],
 *   rerolls: number, skips: number, banishes: number,
 *   offers: OfferRecord[], offersLogged: number,
 *   baSpecialization: BaSpecialization | null,
 *   damageBy: Record<string, number>, lastHitBy: string | null, firstHurtAt: number | null,
 *   foodTaken: number, doneBefore: string[],
 *   enemies: Enemy[], nextEnemyId: number, nodes: RunNode[], gems: Gem[], codes: CodeToken[], pickups: Pickup[],
 *   corpses: WorldObject[], enemyShots: WorldObject[], hazards: WorldObject[],
 *   shots: WorldObject[], wfx: WorldObject[], fx: WorldObject[], texts: WorldObject[],
 *   bossDead: boolean, shake: number,
 *   endless: boolean, endlessStart: number, endlessKills: number,
 *   productionBossNext: number, productionBosses: number,
 *   resultRecorded: boolean, recordedTime: number, statsRecorded: boolean,
 *   statsCounted: { kills: number, codes: number } | null, earnedPaid: number,
 *   recordsImproved: Record<string, string[]> | null,
 * }} RunModel
 */

/** @returns {RunRuntime} */
function createRunRuntime() {
  return {
    // Enemies near the hero and the aura guards, counted once per step.
    crowd: 0,
    guards: [],
    // Length of the hero's current attack cycle (the charge ring).
    attackCycle: 0.2,
    // Who speaks next and which phrase each unit says next; cosmetic only.
    speechPhraseIndex: {},
    speechCursor: 0,
    nextSpeechAt: speechSettings.interval,
  };
}

// How each field of the run is saved (src/systems/run-snapshot.js builds saves from this).
// A saved run continues exactly as the running one would: everything the simulation reads is
// kept, with the references between its objects (src/core/graph-json.js).
//   save    copied into the snapshot as it is
//   reduce  saved in a reduced form: the game random source as its position
//   rebuild not saved: rebuilt by start() from the hero, map and seed, cosmetic leftovers
//           (corpses, effects, floating texts, screen shake) and ending bookkeeping
/** @type {Record<keyof RunModel, 'save' | 'reduce' | 'rebuild'>} */
export const runFields = {
  t: 'save',
  step: 'save',
  runId: 'save',
  map: 'rebuild', // kept at the snapshot's top level
  seed: 'save',
  rng: 'reduce',
  load: 'save',
  healFactor: 'save',
  eventPlan: 'rebuild',
  eventIndex: 'save',
  event: 'save',
  eventsDone: 'save',
  spawn: 'save',
  waveNext: 'save',
  bossSpawned: 'save',
  eliteNext: 'save',
  kills: 'save',
  level: 'save',
  xp: 'save',
  need: 'save',
  earned: 'save',
  attack: 'save',
  p: 'save',
  stats: 'save',
  heroWeaponName: 'rebuild',
  abilities: 'save',
  weapons: 'save',
  evoTokens: 'save',
  evolutions: 'save',
  upgradeRanks: 'save',
  banned: 'save',
  rerolls: 'save',
  skips: 'save',
  banishes: 'save',
  offers: 'save',
  offersLogged: 'save',
  baSpecialization: 'save',
  damageBy: 'save',
  lastHitBy: 'save',
  firstHurtAt: 'save',
  foodTaken: 'save',
  doneBefore: 'save',
  enemies: 'save',
  nextEnemyId: 'save',
  nodes: 'save',
  gems: 'save',
  codes: 'save',
  pickups: 'save',
  corpses: 'rebuild', // cosmetic
  enemyShots: 'save',
  hazards: 'save',
  shots: 'save',
  wfx: 'save',
  fx: 'rebuild', // cosmetic
  texts: 'rebuild', // cosmetic
  bossDead: 'save',
  shake: 'rebuild', // cosmetic
  endless: 'save',
  endlessStart: 'save',
  endlessKills: 'save',
  productionBossNext: 'save',
  productionBosses: 'save',
  resultRecorded: 'rebuild', // a run that has ended is never saved
  recordedTime: 'save',
  statsRecorded: 'save',
  statsCounted: 'save',
  earnedPaid: 'save',
  recordsImproved: 'rebuild',
  runtime: 'save',
};
const fieldsOf = (/** @type {string} */ kind) =>
  Object.keys(runFields).filter((key) => runFields[/** @type {keyof RunModel} */ (key)] === kind);
// Fields a snapshot copies as they are, and fields it saves in a reduced form.
export const persistentKeys = fieldsOf('save');
export const reducedKeys = fieldsOf('reduce');

/**
 * A new run with every field in place.
 * @param {{ hero: string, heroDef: { hp: number, speed: number, weapon: string, keyClient?: boolean },
 *   levels: Record<string, number>, load: number, seed: number, runId: string, map: string,
 *   schedule: Parameters<typeof createWaveState>[0] & Parameters<typeof planEvents>[0],
 *   arenaSize: number, baClient?: string, doneBefore?: string[] }} options
 * @returns {RunModel}
 */
export function createRunModel({
  hero,
  heroDef,
  levels,
  load,
  seed,
  runId,
  map,
  schedule,
  arenaSize,
  baClient,
  doneBefore = [],
}) {
  const mods = loadModifiers(load);
  /** @type {RunModel} */
  const s = {
    t: 0,
    step: 0,
    // Identifies the run in the statistics, so a second ending never adds a game.
    runId,
    map,
    // The seed fixes the node layout, bug placement and event order of this run.
    seed,
    // Every random decision of the simulation draws from here.
    rng: createGameRng(seed),
    load,
    healFactor: Math.max(0, 1 + mods.heal),
    eventPlan: planEvents(schedule, seed),
    eventIndex: 0,
    event: null,
    eventsDone: 0,
    ...createWaveState(schedule),
    kills: 0,
    level: 1,
    xp: 0,
    need: 8,
    earned: 0,
    // Hero attack timer.
    attack: 0.2,
    p: {
      x: arenaSize / 2,
      y: arenaSize / 2,
      hp: heroDef.hp,
      max: heroDef.hp,
      speed: heroDef.speed,
      inv: 0,
      flip: false,
      facing: { x: 1, y: 0 },
      walk: 0,
      moving: false,
      hurt: null,
      action: null,
      slowUntil: 0,
      slowAmount: 0,
      chainImpactAt: null,
    },
    stats: {
      damage: 1,
      haste: 1,
      range: 1,
      speed: 1,
      magnet: 75,
      armor: 0,
      regen: 0,
    },
    heroWeaponName: heroDef.weapon,
    abilities: abilityDefinitions[hero].map((a) => ({ ...a, cd: 0, left: 0 })),
    weapons: [],
    // Bug archives waiting for an eligible weapon, and weapons evolved so far.
    evoTokens: 0,
    evolutions: 0,
    upgradeRanks: {},
    banned: [],
    // Level-up controls: one of each per run, permanent ranks add more.
    rerolls: 1,
    skips: 1,
    banishes: 1,
    offers: [],
    offersLogged: 0,
    baSpecialization: heroDef.keyClient
      ? {
          client: baClient && baClientIds.includes(baClient) ? baClient : baClientIds[0],
          bonus: 0,
        }
      : null,
    damageBy: {},
    lastHitBy: null,
    firstHurtAt: null,
    foodTaken: 0,
    // Achievements already done, to list what this run opens.
    doneBefore,
    enemies: [],
    // Ids of spawned enemies: summons and node objectives refer to enemies by id.
    nextEnemyId: 1,
    nodes: createNodeState(workaroundSeconds * (1 + mods.workaround), layoutNodes(map, seed)),
    gems: [],
    codes: [],
    pickups: [],
    corpses: [],
    enemyShots: [],
    hazards: [],
    shots: [],
    wfx: [],
    fx: [],
    texts: [],
    bossDead: false,
    shake: 0,
    endless: false,
    endlessStart: 0,
    endlessKills: 0,
    productionBossNext: 0,
    productionBosses: 0,
    // Bookkeeping of the run's endings (a run continued in production ends again).
    resultRecorded: false,
    recordedTime: 0,
    statsRecorded: false,
    statsCounted: null,
    earnedPaid: 0,
    // Which run statistics the last ending improved (for the result screen and tests).
    recordsImproved: null,
    runtime: createRunRuntime(),
  };
  applyPermanentUpgrades(s, hero, levels);
  return s;
}

/** @param {RunStats} stats @param {string} key @param {number} value */
const addStat = (stats, key, value) => (stats[key] = Number(stats[key] || 0) + value);

/**
 * Shop ranks, then the hero's innate passive and its training, applied to a new run. Every
 * permanent upgrade names what it raises with `stat`: the hero's health, the head start,
 * a level-up control or a run stat.
 * @param {RunModel} s
 * @param {string} hero
 * @param {Record<string, number>} levels
 */
export function applyPermanentUpgrades(s, hero, levels) {
  for (const [id, def] of Object.entries(permanentUpgradeDefinitions)) {
    const rank = levels[id] || 0,
      stat = def.stat;
    if (stat === 'hp') {
      s.p.max += rank * def.factor;
      s.p.hp += rank * def.factor;
    } else if (stat === 'headStart') {
      // Enough experience for the first level-ups, taken one by one as usual.
      for (let i = 0, need = s.need; i < rank * def.factor; i++) {
        s.xp += need;
        need = Math.floor(need * 1.23 + 3);
      }
    } else if (stat === 'rerolls' || stat === 'skips' || stat === 'banishes')
      s[stat] += rank * def.factor;
    else addStat(s.stats, stat, rank * def.factor);
  }
  const passives = /** @type {Record<string, { stats: Record<string, number> }>} */ (heroPassives);
  for (const [key, value] of Object.entries(passives[hero]?.stats || {}))
    addStat(s.stats, key, value);
  const training = heroTrainingDefinitions[hero];
  if (training)
    addStat(s.stats, training.stat, training.factor * (levels['training_' + hero] || 0));
}
