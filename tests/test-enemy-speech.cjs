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
const state = {
  t: 0,
  p: { x: 1100, y: 1100 },
  enemies: [enemy],
  speechPhraseIndex: {},
  speechCursor: 0,
  nextSpeechAt: speechSettings.interval,
};
const view = { W: 800, H: 600 };
// Speech is cosmetic: it must never consume the gameplay random source.
Math.random = () => {
  throw Error('Gameplay RNG consumed');
};
const speak = () => updateEnemySpeech(state, view, 2200);
speak();
assert(!enemy.speech);
state.t = speechSettings.interval;
speak();
assert.equal(enemy.speech.text, 'Дубли!');
const until = enemy.speech.until;
speak();
assert.equal(enemy.speech.until, until, 'same game time does not advance speech');
state.t = until + 0.1;
speak();
assert(!enemy.speech, 'expires');
state.t = 25;
enemy.x = 10;
speak();
assert(!enemy.speech, 'offscreen silent');
enemy.x = 1100;
speak();
assert.equal(enemy.speech.text, enemyPhrases.l3[1]);
enemy.hp = 0;
speak();
assert(!enemy.speech, 'dead enemies stop speaking');
console.log(
  'PASS: editable phrases, timing, rotation, camera filtering and isolated cosmetic state',
);
