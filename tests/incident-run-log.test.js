import assert from 'node:assert/strict';
import { test } from 'vitest';
import { mapDefinitions } from '../data/maps/maps.js';
import { RUN_LOG_VERSION, normalizeLogEntry, createRunLog } from '../src/systems/run-log.js';
import { computeStats } from '../tools/run-stats.cjs';
import { createHarness } from './helpers/game-harness.js';
import { reviewQuestions } from '../src/systems/escalation.js';
import { courseQuestion, shiftMinute } from '../src/systems/queries/incident.js';
import { incidentSummary } from '../src/systems/incident-grading.js';

const MAP = Object.keys(mapDefinitions).find(
  (id) => mapDefinitions[id].objective?.type === 'escalation',
);

test('a shift writes its summary to the run journal, without texts', async () => {
  const h = await createHarness({ createSession: false });
  const store = new Map();
  h.env.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  const game = h.createSession();
  game.selectMap(MAP);
  game.start();
  game.state.p.hp = game.state.p.max = 1e7;
  game.state.spawn = 1e9;
  game.state.t = 40;
  game.finish(true);
  const log = JSON.parse(store.get('utreys-run-log-v1'));
  const entry = log.at(-1);
  assert.equal(entry.version, RUN_LOG_VERSION);
  assert.equal(entry.learning, null);
  const summary = entry.incident;
  assert(summary, 'the shift is summarised');
  assert.equal(summary.rules, game.state.incident.rulesVersion);
  assert(['Отлично', 'Хорошо', 'Удовлетворительно', 'Не сдано'].includes(summary.grade));
  assert(summary.share >= 0 && summary.share <= 1);
  assert(Object.keys(summary.mistakes).every((id) => /^incident-\d+$/.test(id)));
  assert.equal(
    summary.faults,
    game.state.incident.plan.filter((f) => f.cause && f.from == null).length,
  );
  // Only ids and numbers: no question or answer texts in the journal.
  assert(!/[а-яё]{12,}/i.test(JSON.stringify({ ...summary, grade: '' })));

  // The balance statistics leave shifts out and report them apart.
  const plain = { ...entry, incident: null, map: 'empty', hero: 'utrace' };
  const stats = computeStats([entry, plain]);
  assert.equal(stats.runs, 1);
  assert.equal(stats.incident.length, 1);
  assert.equal(stats.incident[0].grade, summary.grade);

  // Review answers must refresh the existing ending, including its final grade.
  for (const [key, step] of Object.entries(reviewQuestions())) {
    const answer = step.parts
      ? step.parts.filter((p) => p.right).map((p) => p.id)
      : courseQuestion(step.question).correct;
    assert(game.commands.escalationReview(key, answer));
  }
  const reviewed = JSON.parse(store.get('utreys-run-log-v1'));
  assert.equal(reviewed.length, log.length, 'PIR does not append endings');
  assert.deepEqual(
    reviewed.at(-1).incident,
    incidentSummary(game.state.incident, shiftMinute(game.state)),
  );
  assert.equal(reviewed.at(-1).incident.reviewed, Object.keys(reviewQuestions()).length);
  assert.equal(reviewed.at(-1).incident.groups.review, 1);
  const { incident: beforeIncident, ...before } = entry;
  const { incident: afterIncident, ...after } = reviewed.at(-1);
  assert.notDeepEqual(beforeIncident, afterIncident);
  assert.deepEqual(after, before, 'only the shift summary changes');

  // Another tab may append or clear the journal while the review is open.
  const journal = createRunLog({ storage: h.env.localStorage });
  const otherTab = createRunLog({ storage: h.env.localStorage });
  journal.record(entry, game.state.runId);
  otherTab.record({ ...plain, seed: 'another-run' });
  assert(journal.updateIncident(game.state));
  assert.equal(journal.entries().at(-1).seed, 'another-run');
  assert.equal(journal.entries().at(-1).incident, null, 'other ending is not overwritten');
  assert.equal(journal.updateIncident({ ...game.state, runId: 'stale' }), false);
  otherTab.clear();
  assert.equal(journal.updateIncident(game.state), false);
  assert.equal(journal.entries().length, 0, 'a cleared journal is not resurrected');
});

test('older journal entries read with the current fields', () => {
  const v1 = { version: 1, hero: 'utrace', offers: [] };
  const v2 = { version: 2, hero: 'utrace', learning: null, offers: [] };
  for (const old of [v1, v2]) {
    const e = normalizeLogEntry(old);
    assert.equal(e.version, RUN_LOG_VERSION);
    assert.equal(e.learning, null);
    assert.equal(e.incident, null);
  }
});
