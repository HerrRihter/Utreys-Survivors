'use strict';
const assert = require('node:assert/strict');

// Fields each kind of mid-run event needs besides the common ones (src/systems/run-events.js).
const eventFields = {
  siege: ['count', 'distance'],
  hold: ['hold', 'radius', 'distance'],
  collect: ['tokens', 'need', 'near', 'far'],
};

function validateSchedules(
  schedules,
  maps,
  units,
  pickups = require('../data/pickups.js').pickupDefinitions,
) {
  const fail = (condition, message) => assert(condition, 'Game contract: ' + message);
  const shape = (value, keys, label) => {
    fail(value && typeof value === 'object' && !Array.isArray(value), label + ' must be an object');
    assert.deepEqual(
      Object.keys(value).sort(),
      [...keys].sort(),
      'Game contract: fields of ' + label,
    );
  };
  const number = (value, minimum, label) =>
    fail(Number.isFinite(value) && value >= minimum, label + ' out of range');
  const positive = (value, label) =>
    fail(Number.isFinite(value) && value > 0, label + ' must be positive');
  const integer = (value, minimum, label) => {
    number(value, minimum, label);
    fail(Number.isInteger(value), label + ' must be integral');
  };
  const unit = (id) => fail(Object.hasOwn(units, id), 'unknown unit ' + id);
  const stages = (list, label) => {
    fail(
      Array.isArray(list) && list.length > 0 && list[0].time === 0,
      label + ' must start at zero',
    );
    list.forEach((stage, index) => {
      number(stage.time, 0, label + '.time');
      if (index) fail(stage.time > list[index - 1].time, label + ' must be strictly ordered');
    });
  };
  assert.deepEqual(
    Object.keys(schedules).sort(),
    Object.keys(maps).sort(),
    'Game contract: maps and wave schedules must match',
  );
  for (const [id, schedule] of Object.entries(schedules)) {
    const inactive = schedule.active === false;
    shape(
      schedule,
      [
        ...(inactive ? ['active'] : ['elites', 'events']),
        'normal',
        'recurring',
        'boss',
        'notifications',
      ],
      id,
    );
    if (Object.hasOwn(schedule, 'active'))
      fail(typeof schedule.active === 'boolean', id + '.active must be boolean');
    shape(
      schedule.normal,
      inactive ? ['firstDelay', 'stages'] : ['firstDelay', 'shares', 'stages'],
      id + '.normal',
    );
    if (!inactive)
      for (const [role, share] of Object.entries(schedule.normal.shares || {}))
        fail(
          ['shooter', 'tank', 'light'].includes(role) && share > 0 && share <= 1,
          id + '.normal.shares.' + role,
        );
    number(schedule.normal.firstDelay, 0, id + '.firstDelay');
    fail(Array.isArray(schedule.normal.stages), id + '.normal.stages must be an array');
    if (inactive)
      fail(
        schedule.normal.stages.length === 0,
        id + ' inactive schedule must not have normal waves',
      );
    else stages(schedule.normal.stages, id + '.normal.stages');
    for (const stage of schedule.normal.stages) {
      shape(
        stage,
        [
          'time',
          'interval',
          'minInterval',
          'timeFactor',
          'batch',
          'batchEvery',
          'cap',
          'strength',
          'weights',
        ],
        id + '.stage',
      );
      positive(stage.interval, 'interval');
      positive(stage.strength, 'strength');
      positive(stage.minInterval, 'minInterval');
      fail(stage.minInterval <= stage.interval, 'minInterval exceeds interval');
      number(stage.timeFactor, 0, 'timeFactor');
      integer(stage.batch, 1, 'batch');
      integer(stage.cap, 1, 'cap');
      if (stage.batchEvery !== null) positive(stage.batchEvery, 'batchEvery');
      fail(Array.isArray(stage.weights) && stage.weights.length > 0, 'weights must not be empty');
      const seen = new Set();
      for (const pair of stage.weights) {
        fail(Array.isArray(pair) && pair.length === 2, 'weight must be [unit, weight]');
        const [name, weight] = pair;
        unit(name);
        positive(weight, 'weight');
        fail(!seen.has(name), 'duplicate weighted unit ' + name);
        seen.add(name);
      }
    }
    fail(Array.isArray(schedule.recurring), 'recurring must be an array');
    if (inactive)
      fail(
        schedule.recurring.length === 0,
        id + ' inactive schedule must not have recurring units',
      );
    const recurring = new Set();
    for (const spec of schedule.recurring) {
      shape(spec, ['unit', 'first', 'populationCap', 'stages', 'message'], id + '.recurring');
      unit(spec.unit);
      fail(!recurring.has(spec.unit), 'duplicate recurring unit ' + spec.unit);
      recurring.add(spec.unit);
      number(spec.first, 0, 'first');
      if (spec.populationCap !== null) integer(spec.populationCap, 1, 'populationCap');
      fail(typeof spec.message === 'string', 'message must be a string');
      stages(spec.stages, id + '.' + spec.unit);
      for (const stage of spec.stages) {
        shape(stage, ['time', 'every', 'cap'], 'recurring stage');
        positive(stage.every, 'every');
        integer(stage.cap, 1, 'cap');
      }
      if (inactive)
        fail(
          schedule.boss === null &&
            Array.isArray(schedule.notifications) &&
            schedule.notifications.length === 0,
          id + ' inactive schedule must not define active content',
        );
    }
    if (!inactive) {
      shape(schedule.elites, ['first', 'every'], id + '.elites');
      number(schedule.elites.first, 0, 'elites.first');
      positive(schedule.elites.every, 'elites.every');
      const events = schedule.events;
      const types = Object.keys(events).filter((key) => key !== 'times' && key !== 'types');
      fail(Array.isArray(events.times) && events.times.length > 0, 'event times');
      events.times.forEach((time, i) => {
        positive(time, 'event time');
        if (i) fail(time > events.times[i - 1], 'event times must be ordered');
      });
      fail(
        Array.isArray(events.types) &&
          events.types.length > 0 &&
          events.types.every((type) => types.includes(type)),
        'event types',
      );
      for (const type of types) {
        const spec = events[type];
        const fields = eventFields[spec?.kind];
        fail(fields, `event ${type}.kind`);
        const reward = spec.reward;
        shape(
          spec,
          [
            'kind',
            'duration',
            'message',
            'label',
            'success',
            'failed',
            'reward',
            ...fields,
            ...('marker' in spec ? ['marker'] : []),
          ],
          'event ' + type,
        );
        positive(spec.duration, type + '.duration');
        for (const text of ['message', 'label', 'success', 'failed'])
          fail(typeof spec[text] === 'string' && spec[text], `${type}.${text}`);
        fail(
          reward &&
            (Number.isSafeInteger(reward.codes) && reward.codes > 0
              ? Object.keys(reward).length === 1
              : Object.keys(reward).length === 1 && Object.hasOwn(pickups, reward.pickup)),
          type + '.reward',
        );
        if (spec.kind === 'siege') {
          integer(spec.count, 1, type + '.count');
          positive(spec.distance, type + '.distance');
        } else if (spec.kind === 'hold') {
          positive(spec.hold, type + '.hold');
          fail(spec.hold < spec.duration, type + ' hold fits its duration');
          positive(spec.radius, type + '.radius');
          positive(spec.distance, type + '.distance');
        } else {
          integer(spec.need, 1, type + '.need');
          fail(spec.tokens >= spec.need, type + ' has enough tokens');
          fail(spec.near > 0 && spec.far > spec.near, type + ' token distances');
        }
      }
    }
    if (schedule.boss !== null) {
      shape(
        schedule.boss,
        [
          'unit',
          'condition',
          'message',
          'sound',
          ...('hpScale' in schedule.boss ? ['hpScale'] : []),
          ...('heal' in schedule.boss ? ['heal'] : []),
        ],
        id + '.boss',
      );
      if ('hpScale' in schedule.boss) positive(schedule.boss.hpScale, 'boss.hpScale');
      if ('heal' in schedule.boss)
        fail(schedule.boss.heal > 0 && schedule.boss.heal <= 1, 'boss.heal must be a share');
      unit(schedule.boss.unit);
      fail(schedule.boss.condition === 'all-nodes-resolved', 'boss condition');
      fail(
        typeof schedule.boss.message === 'string' && typeof schedule.boss.sound === 'string',
        'boss messages',
      );
    }
    fail(Array.isArray(schedule.notifications), 'notifications must be an array');
    for (const notification of schedule.notifications) {
      shape(notification, ['time', 'message'], 'notification');
      number(notification.time, 0, 'notification time');
      fail(typeof notification.message === 'string', 'notification message');
    }
  }
  return Object.keys(schedules).length;
}

function checkGameContracts() {
  const { heroDefinitions } = require('../data/characters/heroes.js');
  const { abilityDefinitions } = require('../data/characters/abilities.js');
  const { heroUnlockPrices, heroTrainingDefinitions } = require('../data/upgrades.js');
  assert.deepEqual(
    Object.keys(abilityDefinitions).sort(),
    Object.keys(heroDefinitions).sort(),
    'Hero contract: abilities',
  );
  assert.deepEqual(
    Object.keys(heroUnlockPrices).sort(),
    Object.keys(heroDefinitions)
      .filter((id) => id !== 'utrace')
      .sort(),
    'Hero contract: unlock prices',
  );
  const { attackKinds } = require('../src/systems/hero-attacks.js');
  const { heroEvolutions } = require('../data/weapons.js');
  assert.deepEqual(
    Object.keys(heroEvolutions).sort(),
    Object.keys(heroDefinitions).sort(),
    'Hero contract: evolutions',
  );
  const { abilityKinds } = require('../src/systems/abilities/index.js');
  for (const ability of Object.values(abilityDefinitions).flat())
    assert(Object.hasOwn(abilityKinds, ability.kind), 'Ability contract: kind of ' + ability.id);
  for (const [id, hero] of Object.entries(heroDefinitions)) {
    assert(Object.hasOwn(attackKinds, hero.attack), 'Hero contract: attack ' + id);
    for (const field of ['hp', 'speed', 'interval', 'wind', 'damage', 'range', 'push'])
      assert(Number.isFinite(hero[field]) && hero[field] > 0, `Hero contract: ${id}.${field}`);
    assert.equal(abilityDefinitions[id].length, 2, 'Hero contract: two abilities');
    assert(heroTrainingDefinitions[id], 'Hero contract: training');
    if (id !== 'utrace')
      assert(
        Number.isSafeInteger(heroUnlockPrices[id]) && heroUnlockPrices[id] > 0,
        'Hero contract: price',
      );
  }
  // Event kinds of the contract are the ones the event system knows.
  const { eventKinds } = require('../src/systems/run-events.js');
  assert.deepEqual(Object.keys(eventKinds).sort(), Object.keys(eventFields).sort(), 'Event kinds');
  // Pickups: known kinds and icons; drops name pickup types.
  const { pickupDefinitions, dropTable } = require('../data/pickups.js');
  const pickupKinds = ['upgrade', 'pull', 'blast', 'stun', 'heal'];
  const pickupIcons = ['crate', 'magnet', 'bomb', 'snowflake', 'capsule'];
  for (const [id, pickup] of Object.entries(pickupDefinitions)) {
    assert(pickupKinds.includes(pickup.kind), 'Pickup contract: kind of ' + id);
    assert(pickupIcons.includes(pickup.icon), 'Pickup contract: icon of ' + id);
  }
  for (const type of [dropTable.elite, dropTable.food.type, ...dropTable.rare.map((d) => d.type)])
    assert(Object.hasOwn(pickupDefinitions, type), 'Drop contract: unknown pickup ' + type);
  dropTable.rare.forEach((drop, i) =>
    assert(drop.below > (i ? dropTable.rare[i - 1].below : 0), 'Drop contract: rare order'),
  );
  // Every weapon names a kind the weapon system knows.
  const { weaponDefinitions } = require('../data/weapons.js');
  const { weaponKinds } = require('../src/systems/weapons/index.js');
  for (const [id, weapon] of Object.entries(weaponDefinitions))
    assert(Object.hasOwn(weaponKinds, weapon.kind), `Weapon contract: ${id}.kind ${weapon.kind}`);
  // Node 24 can require synchronous ES modules; no duplicate JSON representation.
  const { waveSchedules } = require('../data/enemies/waves.js');
  const { mapDefinitions } = require('../data/maps/maps.js');
  const { unitDefinitions } = require('../data/enemies/units.js');
  const { nodeDefinitions } = require('../data/enemies/nodes.js');
  validateUnits(unitDefinitions);
  const { unitArt } = require('../src/rendering/art/enemy-art.js');
  const { clientEmblems } = require('../src/rendering/art/client-emblems.js');
  for (const id of [...Object.keys(unitArt), ...Object.keys(clientEmblems)])
    assert(Object.hasOwn(unitDefinitions, id), 'Art contract: art for unknown unit ' + id);
  assert.equal(
    new Set(nodeDefinitions.map((node) => node.id)).size,
    nodeDefinitions.length,
    'Node contract: duplicate component',
  );
  assert.equal(
    new Set(nodeDefinitions.map((node) => node.bug)).size,
    nodeDefinitions.length,
    'Node contract: duplicate bug',
  );
  for (const node of nodeDefinitions) {
    assert(
      unitDefinitions[node.bug]?.miniboss && !unitDefinitions[node.bug].boss,
      'Node contract: guardian must be a miniboss',
    );
    assert(
      node.x > 100 && node.x < 2000 && node.y > 100 && node.y < 2100,
      'Node contract: position outside arena',
    );
  }
  return validateSchedules(waveSchedules, mapDefinitions, unitDefinitions);
}
function validateUnits(units) {
  for (const [id, unit] of Object.entries(units)) {
    for (const field of ['hp', 'damage', 'r', 'range', 'wind', 'cooldown', 'xp'])
      assert(Number.isFinite(unit[field]) && unit[field] > 0, `Unit contract: ${id}.${field}`);
    assert(Number.isFinite(unit.speed) && unit.speed >= 0, `Unit contract: ${id}.speed`);
    for (const field of ['name', 'mark'])
      assert(
        typeof unit[field] === 'string' && unit[field].trim(),
        `Unit contract: ${id}.${field}`,
      );
    assert(/^#[0-9a-f]{6}$/i.test(unit.color), `Unit contract: ${id}.color`);
    assert(
      ['melee', 'projectile', 'pulse', 'mortar'].includes(unit.attack ?? 'melee'),
      `Unit contract: ${id}.attack`,
    );
    if (unit.frontDamageMultiplier != null)
      assert(
        unit.frontDamageMultiplier > 0 && unit.frontDamageMultiplier <= 1,
        `Unit contract: ${id}.armor`,
      );
    if (unit.attack === 'projectile') assert(unit.range > 20, `Unit contract: ${id}.range`);
    if (unit.attack === 'mortar') assert(unit.mortar, `Unit contract: ${id}.mortar`);
    if (unit.shots != null) {
      assert(unit.attack === 'projectile', `Unit contract: ${id}.shots needs projectile`);
      assert(
        Number.isInteger(unit.shots.count) && unit.shots.count > 0,
        `Unit contract: ${id}.shots`,
      );
    }
    // Optional role fields: every number they hold is finite and positive (shares up to 1).
    const role = {
      dash: ['trigger', 'wind', 'speed', 'time', 'cooldown'],
      mortar: ['radius', 'delay', 'count'],
      heal: ['every', 'radius', 'amount'],
      aura: ['radius', 'reduction'],
      deathBlast: ['radius', 'delay', 'damage'],
      enrage: ['below', 'speed', 'cooldown'],
      slow: ['amount', 'duration'],
      summon: ['count', 'every', 'max'],
      pools: ['every', 'count', 'radius', 'life', 'damage', 'reach'],
    };
    for (const [field, keys] of Object.entries(role)) {
      if (unit[field] == null) continue;
      for (const key of keys)
        assert(
          Number.isFinite(unit[field][key]) && unit[field][key] > 0,
          `Unit contract: ${id}.${field}.${key}`,
        );
    }
    for (const share of [unit.aura?.reduction, unit.heal?.amount, unit.slow?.amount])
      if (share != null) assert(share < 1, `Unit contract: ${id} share below 1`);
    for (const list of [unit.summon?.units, ...(unit.phases || []).map((p) => p.summon?.units)])
      if (list)
        for (const other of list)
          assert(units[other] && !units[other].boss, `Unit contract: ${id} summons ${other}`);
    if (unit.phases != null) {
      assert(unit.boss, `Unit contract: ${id}.phases needs a boss`);
      unit.phases.forEach((phase, i) => {
        assert(phase.at > 0 && phase.at < 1, `Unit contract: ${id}.phases.at`);
        if (i) assert(phase.at < unit.phases[i - 1].at, `Unit contract: ${id}.phases order`);
      });
    }
    if (unit.burst != null) {
      const { reach, ring, sound } = unit.burst;
      assert((unit.attack ?? 'melee') === 'melee', `Unit contract: ${id}.burst needs melee`);
      assert(Number.isFinite(reach) && reach >= 0, `Unit contract: ${id}.burst.reach`);
      assert(ring && ring.r > 0 && ring.life > 0, `Unit contract: ${id}.burst.ring`);
      assert(/^#[0-9a-f]{6}$/i.test(ring.color), `Unit contract: ${id}.burst.ring.color`);
      assert(typeof sound === 'string' && sound, `Unit contract: ${id}.burst.sound`);
    }
  }
}
if (require.main === module) console.log('Game contracts OK:', checkGameContracts(), 'maps');
module.exports = { validateUnits, validateSchedules, checkGameContracts };
