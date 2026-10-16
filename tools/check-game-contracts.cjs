'use strict';
const assert = require('node:assert/strict');

function validateSchedules(schedules, maps, units) {
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
    shape(schedule.normal, ['firstDelay', 'stages'], id + '.normal');
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
        ['time', 'interval', 'minInterval', 'timeFactor', 'batch', 'batchEvery', 'cap', 'weights'],
        id + '.stage',
      );
      positive(stage.interval, 'interval');
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
      shape(events, ['times', 'types', 'friday', 'incident', 'rush'], id + '.events');
      fail(Array.isArray(events.times) && events.times.length > 0, 'event times');
      events.times.forEach((time, i) => {
        positive(time, 'event time');
        if (i) fail(time > events.times[i - 1], 'event times must be ordered');
      });
      fail(
        Array.isArray(events.types) &&
          events.types.length > 0 &&
          events.types.every((type) => ['friday', 'incident', 'rush'].includes(type)),
        'event types',
      );
      shape(events.friday, ['duration', 'count', 'message'], 'friday');
      shape(events.incident, ['duration', 'hold', 'radius', 'distance', 'message'], 'incident');
      shape(events.rush, ['duration', 'tokens', 'need', 'message'], 'rush');
      positive(events.friday.duration, 'friday.duration');
      integer(events.friday.count, 1, 'friday.count');
      positive(events.incident.hold, 'incident.hold');
      fail(events.incident.hold < events.incident.duration, 'incident hold fits its duration');
      positive(events.incident.radius, 'incident.radius');
      positive(events.incident.distance, 'incident.distance');
      integer(events.rush.need, 1, 'rush.need');
      fail(events.rush.tokens >= events.rush.need, 'rush has enough tokens');
      positive(events.rush.duration, 'rush.duration');
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
        ],
        id + '.boss',
      );
      if ('hpScale' in schedule.boss) positive(schedule.boss.hpScale, 'boss.hpScale');
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
  for (const [id, hero] of Object.entries(heroDefinitions)) {
    assert(['sector', 'chain', 'packet', 'scan'].includes(hero.attack), 'Hero contract: attack');
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
      ['melee', 'projectile', 'pulse'].includes(unit.attack ?? 'melee'),
      `Unit contract: ${id}.attack`,
    );
    if (unit.frontDamageMultiplier != null)
      assert(
        unit.frontDamageMultiplier > 0 && unit.frontDamageMultiplier <= 1,
        `Unit contract: ${id}.armor`,
      );
    if (unit.attack === 'projectile') assert(unit.range > 20, `Unit contract: ${id}.range`);
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
