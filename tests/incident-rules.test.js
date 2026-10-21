import assert from 'node:assert/strict';
import { test } from 'vitest';
import { incidentRules } from '../data/incident-rules.js';
import { learningCourses } from '../data/learning-courses.js';
import { unitDefinitions } from '../data/enemies/units.js';
import { coveredQuestions, validateIncidentRules } from '../src/systems/incident-validation.js';

const course = learningCourses[incidentRules.course];
const context = { course, units: unitDefinitions };
// A copy of the rules changed by `change`, checked against the real course and units.
const broken = (change) => {
  const rules = structuredClone(incidentRules);
  change(rules);
  return () => validateIncidentRules(rules, context);
};

test('incident rules hold together and teach every question of the course', () => {
  assert(validateIncidentRules(incidentRules, context));
  const covered = coveredQuestions(incidentRules);
  assert.deepEqual(
    course.questions.map((q) => q.id).filter((id) => !covered.has(id)),
    [],
  );
  // Open questions are taught too: their references become steps and parts in the shift.
  for (const q of course.questions.filter((q) => q.type === 'open')) assert(covered.has(q.id));
});

test('a course question left out of the mode is an error', () => {
  // incident-39 (the postmortem tag) is taught only by the review.
  assert.throws(
    broken((r) => {
      r.review = r.review.filter((step) => step.question !== 'incident-39');
    }),
    /not covered: incident-39/,
  );
  assert.throws(
    broken((r) => {
      r.journal.covers = ['incident-99'];
    }),
    /unknown course question incident-99/,
  );
  // The console checks keys only of closed questions.
  assert.throws(
    broken((r) => {
      r.update.wording = { question: 'incident-28' };
    }),
    /incident-28 is open/,
  );
});

test('broken incident content is rejected', () => {
  const cases = [
    [(r) => r.feeds.push({ from: 'goods-reports', to: 'inport-operation-processor' }), /cycle/],
    [(r) => (r.feeds[0].to = 'nowhere'), /feed/],
    [(r) => (r.metrics[0].units = ['grafana_dashboard']), /metric grafana units/],
    [(r) => (r.metrics[0].units = ['critical_incident']), /metric grafana units/],
    [(r) => (r.components[0].clients = ['pepsi_ceo']), /client pepsi_ceo/],
    [
      (r) => (r.causes = r.causes.filter((c) => !c.faults.includes('reboot'))),
      /no cause for fault reboot/,
    ],
    [(r) => (r.causes[0].fixer = 'intern'), /cause certificate/],
    [(r) => (r.matrix[1].roles = ['cto']), /matrix level 2 roles/],
    [(r) => r.ticket.fields.pop(), /ticket fields/],
    [(r) => delete r.protocol.first.actions['answer-2'], /protocol.first/],
    [(r) => (r.internal.parts = r.internal.parts.filter((p) => p.right)), /right and wrong/],
    [(r) => (r.severity.levels.at(-1).when = { impact: false }), /catches all/],
    [(r) => (r.injects[0].kind = 'tweet'), /inject kind tweet/],
    [(r) => (r.roles.devops.manager = undefined), /no manager/],
    [(r) => (r.clientTriggers[0].component = 'goods-reports'), /trigger component/],
    [(r) => (r.shift.faults = [3, 30]), /fits its faults/],
  ];
  for (const [change, message] of cases) assert.throws(broken(change), message);
});

test('the rules name course questions and clients only through data', () => {
  // Every client of a component is an ordinary unit, so its kills can open the client metric.
  for (const c of incidentRules.components)
    for (const client of c.clients) assert(!unitDefinitions[client].boss);
  // Every metric's foes exist and are not bosses.
  for (const m of incidentRules.metrics.filter((m) => m.kind === 'units'))
    for (const u of m.units) assert(unitDefinitions[u] && !unitDefinitions[u].boss);
});
