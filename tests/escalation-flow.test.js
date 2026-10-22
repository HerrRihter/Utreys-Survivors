import assert from 'node:assert/strict';
import { test } from 'vitest';
import { incidentRules as rules } from '../data/incident-rules.js';
import { mapDefinitions } from '../data/maps/maps.js';
import { courseQuestion, shiftMinute } from '../src/systems/queries/incident.js';
import { createHarness } from './helpers/game-harness.js';

const MAP = Object.keys(mapDefinitions).find(
  (id) => mapDefinitions[id].objective?.type === 'escalation',
);
const key = (id) => courseQuestion(id).correct;

async function open(seed = 21) {
  const h = await createHarness({ createSession: false });
  const store = new Map();
  h.env.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  const game = h.createSession();
  game.selectMap(MAP);
  game.views.run().nextSeed = seed;
  game.start();
  game.state.p.hp = game.state.p.max = 1e7;
  // A quiet shift for the console: no waves, one failure under way.
  game.state.spawn = 1e9;
  game.state.enemies.length = 0;
  const inc = game.state.incident;
  inc.plan = [
    {
      at: 1,
      component: 'goods-reports',
      fault: 'error',
      cause: 'release',
      mild: false,
      from: null,
      startedAt: null,
      endedAt: null,
    },
  ];
  inc.alerts = [{ fault: 0, monitoringAt: 7, clientAt: 16, seenAt: null }];
  inc.injects = [];
  return { h, game, store };
}
const play = (game, seconds) => {
  for (let i = 0; i < seconds * 60 && game.mode === 'play'; i++) {
    game.state.p.hp = game.state.p.max;
    game.state.enemies.length = 0;
    game.update(1 / 60);
  }
};

test('the console opens only with no enemy near and stops the fight', async () => {
  const { game } = await open();
  play(game, 6);
  const s = game.state;
  assert.equal(game.views.hud().console.canOpen, true);
  assert.match(game.views.hud().progress, /^Смена · /);
  const enemy = game.spawn('l3', false, { x: s.p.x + 100, y: s.p.y });
  assert.equal(game.views.hud().console.canOpen, false);
  assert(!game.commands.openConsole(), 'not with an enemy close by');
  s.enemies.length = 0;
  void enemy;
  assert(game.commands.openConsole());
  assert.equal(game.mode, 'console');
  const t = s.t;
  game.update(1 / 60);
  assert.equal(s.t, t, 'the fight waits');
  assert(!game.commands.openConsole(), 'already open');
  assert(game.commands.closeConsole());
  assert.equal(game.mode, 'play');
  // Commands need the console open.
  assert.equal(game.commands.escalationOpen('goods-reports'), false);
});

test('commands run the escalation; a new mistake is explained at the first load', async () => {
  const { game, store } = await open();
  play(game, 6);
  game.commands.openConsole();
  game.views.run().toast = { text: '', left: 0 };
  const id = game.commands.escalationOpen('goods-reports');
  assert.equal(id, 1);
  assert.equal(game.views.run().toast.text, '', 'steps not taken yet are no mistake');
  const view = game.views.escalation();
  assert.equal(view.tickets.length, 1);
  assert.equal(view.tickets[0].component, rules.components.at(-1).label);
  // A wrong first action: an update before the #CS_Critical message.
  game.views.run().toast = { text: '', left: 0 };
  assert(game.commands.escalationUpdate(id, { required: key(rules.update.parts.question) }));
  assert.match(game.views.run().toast.text, /Первое действие/);
  assert(game.views.run().toast.text.includes(courseQuestion('incident-10').explanation));
  // The card gates the work status: the refusal names the missing fields.
  assert(game.commands.escalationCreate(id, key(rules.protocol.creation.question)[0]));
  const refused = game.commands.escalationStatus(id, 'work');
  assert.equal(refused.reason, 'card');
  assert.match(game.views.run().toast.text, /Не заполнены обязательные поля/);
  // Every command was saved: the stored run has the ticket.
  const saved = JSON.parse(store.get('utreys-run-v7'));
  assert(JSON.stringify(saved.state).includes('"openedAt"'));
  // A metric order, a call and the journal through the console.
  assert(game.commands.escalationOrderMetric('grafana', null));
  assert(game.commands.escalationCall(id, 'dev'));
  assert(game.commands.escalationRecord(0));
  assert.equal(game.views.escalation().journal[0].recorded, true);
  assert.equal(game.views.escalation().metrics[0].pending, true);
});

test('the shift ends in a review, then a grade; it stays out of records', async () => {
  const { h, game } = await open();
  play(game, 4);
  game.state.t = (rules.clock.minutes - 0.1) * rules.clock.minuteSeconds;
  play(game, 1);
  assert.equal(game.mode, 'end');
  const result = game.views.run().result;
  assert.equal(result.win, true);
  assert.equal(result.canContinue, false, 'no production after a shift');
  assert.equal(result.tag, mapDefinitions[MAP].victoryTag);
  let report = game.views.shiftResult();
  assert(report.review.length > 0, 'the review comes first');
  for (const q of report.review)
    assert(
      game.commands.escalationReview(
        q.key,
        q.options.slice(0, 1).map((o) => o.id),
      ),
    );
  report = game.views.shiftResult();
  assert.equal(report.review.length, 0);
  assert(['Отлично', 'Хорошо', 'Удовлетворительно', 'Не сдано'].includes(report.grade));
  // The failure was never escalated: detection is a mistake with its course question.
  assert(report.mistakes.some((m) => m.question === courseQuestion('incident-1').text));
  assert.equal(h.env.Progression.data.runStats.all.games, 0, 'not ranked');
  assert.equal(h.env.Progression.data.stats.maxTime ?? 0, 0, 'no time record');
  assert(shiftMinute(game.state) >= rules.clock.minutes);
});
