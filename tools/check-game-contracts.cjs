'use strict';
const assert = require('node:assert/strict');

function validateSchedules(schedules, maps, units) {
  const fail = (condition, message) => assert(condition, 'Game contract: ' + message);
  const shape = (value, keys, label) => {
    fail(value && typeof value === 'object' && !Array.isArray(value), label + ' must be an object');
    assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), 'Game contract: fields of ' + label);
  };
  const number = (value, minimum, label) => fail(Number.isFinite(value) && value >= minimum, label + ' out of range');
  const positive = (value, label) => fail(Number.isFinite(value) && value > 0, label + ' must be positive');
  const integer = (value, minimum, label) => {number(value, minimum, label);fail(Number.isInteger(value), label + ' must be integral');};
  const unit = id => fail(Object.hasOwn(units, id), 'unknown unit ' + id);
  const stages = (list, label) => {
    fail(Array.isArray(list) && list.length > 0 && list[0].time === 0, label + ' must start at zero');
    list.forEach((stage, index) => {
      number(stage.time, 0, label + '.time');
      if (index) fail(stage.time > list[index-1].time, label + ' must be strictly ordered');
    });
  };
  assert.deepEqual(Object.keys(schedules).sort(), Object.keys(maps).sort(), 'Game contract: maps and wave schedules must match');
  for (const [id, schedule] of Object.entries(schedules)) {
    const inactive=schedule.active===false;
    shape(schedule, [...(inactive?['active']:[]),'normal','recurring','boss','population','residents','notifications'], id);
    if(Object.hasOwn(schedule,'active'))fail(typeof schedule.active==='boolean',id+'.active must be boolean');
    shape(schedule.normal, ['firstDelay','stages'], id + '.normal');
    number(schedule.normal.firstDelay, 0, id + '.firstDelay');
    fail(Array.isArray(schedule.normal.stages),id+'.normal.stages must be an array');
    if(inactive)fail(schedule.normal.stages.length===0,id+' inactive schedule must not have normal waves');
    else stages(schedule.normal.stages, id + '.normal.stages');
    for (const stage of schedule.normal.stages) {
      shape(stage, ['time','interval','minInterval','timeFactor','batch','batchEvery','cap','weights'], id + '.stage');
      positive(stage.interval, 'interval');positive(stage.minInterval, 'minInterval');
      fail(stage.minInterval <= stage.interval, 'minInterval exceeds interval');
      number(stage.timeFactor, 0, 'timeFactor');integer(stage.batch, 1, 'batch');integer(stage.cap, 1, 'cap');
      if (stage.batchEvery !== null) positive(stage.batchEvery, 'batchEvery');
      fail(Array.isArray(stage.weights) && stage.weights.length > 0, 'weights must not be empty');
      const seen = new Set();
      for (const pair of stage.weights) {
        fail(Array.isArray(pair) && pair.length === 2, 'weight must be [unit, weight]');
        const [name, weight] = pair;unit(name);positive(weight, 'weight');
        fail(!units[name].civilian, 'civilian in combat wave');
        fail(!seen.has(name), 'duplicate weighted unit ' + name);seen.add(name);
      }
    }
    fail(Array.isArray(schedule.recurring), 'recurring must be an array');
    if(inactive)fail(schedule.recurring.length===0,id+' inactive schedule must not have recurring units');
    const recurring = new Set();
    for (const spec of schedule.recurring) {
      shape(spec, ['unit','first','populationCap','stages','message'], id + '.recurring');
      unit(spec.unit);fail(!recurring.has(spec.unit), 'duplicate recurring unit ' + spec.unit);recurring.add(spec.unit);
      number(spec.first, 0, 'first');
      if (spec.populationCap !== null) integer(spec.populationCap, 1, 'populationCap');
      fail(typeof spec.message === 'string', 'message must be a string');
      stages(spec.stages, id + '.' + spec.unit);
      for (const stage of spec.stages) {
        shape(stage, ['time','every','cap'], 'recurring stage');positive(stage.every, 'every');integer(stage.cap, 1, 'cap');
      }
      if(inactive)fail(schedule.boss===null&&schedule.population===null&&Array.isArray(schedule.residents)&&schedule.residents.length===0&&Array.isArray(schedule.notifications)&&schedule.notifications.length===0,id+' inactive schedule must not define active content');
    }
    if (schedule.boss !== null) {
      shape(schedule.boss, ['unit','time','message','sound'], id + '.boss');unit(schedule.boss.unit);
      number(schedule.boss.time, 0, 'boss time');
      fail(typeof schedule.boss.message === 'string' && typeof schedule.boss.sound === 'string', 'boss messages');
    }
    if (schedule.population !== null) {
      const spec = schedule.population;
      shape(spec, ['unit','initial','maximum','every','growthEvery','variants'], id + '.population');unit(spec.unit);
      fail(units[spec.unit].civilian === true, 'population must use a civilian unit');
      integer(spec.initial, 0, 'initial');integer(spec.maximum, spec.initial, 'maximum');
      positive(spec.every, 'population every');positive(spec.growthEvery, 'growthEvery');integer(spec.variants, 1, 'variants');
    }
    fail(Array.isArray(schedule.residents), 'residents must be an array');schedule.residents.forEach(unit);
    fail(new Set(schedule.residents).size === schedule.residents.length, 'duplicate resident unit');
    fail(Array.isArray(schedule.notifications), 'notifications must be an array');
    for (const notification of schedule.notifications) {
      shape(notification, ['time','message'], 'notification');number(notification.time, 0, 'notification time');
      fail(typeof notification.message === 'string', 'notification message');
    }
  }
  return Object.keys(schedules).length;
}

function checkGameContracts() {
  // Node 24 can require synchronous ES modules; no duplicate JSON representation.
  const {waveSchedules} = require('../data/enemies/waves.js');
  const {mapDefinitions} = require('../data/maps/maps.js');
  const {unitDefinitions} = require('../data/enemies/units.js');
  return validateSchedules(waveSchedules, mapDefinitions, unitDefinitions);
}
if (require.main === module) console.log('Game contracts OK:', checkGameContracts(), 'maps');
module.exports = {validateSchedules, checkGameContracts};
