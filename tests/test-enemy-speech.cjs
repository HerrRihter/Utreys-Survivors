const assert = require('node:assert/strict');
const { enemyPhrases, speechSettings } = require('../data/enemies/phrases.js');
const { unitDefinitions } = require('../data/enemies/units.js');
const { updateEnemySpeech } = require('../src/systems/enemy-speech.js');
assert.deepEqual(Object.keys(enemyPhrases).sort(), Object.keys(unitDefinitions).sort());
for (const phrases of Object.values(enemyPhrases))
  for (const phrase of phrases) assert(phrase.trim() && phrase.length <= 48);
assert(enemyPhrases.l3.includes('Дубли!'));
assert(enemyPhrases.progress.includes('Отгрузка!') && enemyPhrases.multon.includes('Отгрузка!'));
const enemy = { unit: 'l3', hp: 100, x: 1100, y: 1100 };
const state = { t: 0, p: { x: 1100, y: 1100 }, enemies: [enemy] };
const context = {
  state,
  W: 800,
  H: 600,
  WORLD: 2200,
  Math: {
    random() {
      throw Error('Gameplay RNG consumed');
    },
  },
};
updateEnemySpeech(context);
assert(!enemy.speech);
state.t = speechSettings.interval;
updateEnemySpeech(context);
assert.equal(enemy.speech.text, 'Дубли!');
const until = enemy.speech.until;
updateEnemySpeech(context);
assert.equal(enemy.speech.until, until, 'same game time does not advance speech');
state.t = until + 0.1;
updateEnemySpeech(context);
assert(!enemy.speech, 'expires');
state.t = 25;
enemy.x = 10;
updateEnemySpeech(context);
assert(!enemy.speech, 'offscreen silent');
enemy.x = 1100;
updateEnemySpeech(context);
assert.equal(enemy.speech.text, enemyPhrases.l3[1]);
enemy.hp = 0;
updateEnemySpeech(context);
assert(!enemy.speech, 'dead enemies stop speaking');
console.log(
  'PASS: editable phrases, timing, rotation, camera filtering and isolated cosmetic state',
);
