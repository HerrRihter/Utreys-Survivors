import { learningRules, learningGrading } from '../../data/learning-rules.js';
import { mapDefinitions } from '../../data/maps/maps.js';
import { learningCourses } from '../../data/learning-courses.js';
import { unitDefinitions } from '../../data/enemies/units.js';
import { shuffle } from '../core/rng.js';
import { availableTerminal, availableExit, courseOf, roomLayout } from './queries/learning.js';

// The map's layout generation: 2 = generated mazes. A saved run of another layout cannot go on.
export const LEARNING_LAYOUT = 2;

// The learning state of a run on `map` with the course `courseId` (the first course when that
// one is unknown); null on other maps.
export function createLearningState(map, courseId) {
  const course =
    mapDefinitions[map]?.objective?.type === 'learning'
      ? (learningCourses[courseId] ?? Object.values(learningCourses)[0])
      : null;
  return course
    ? {
        course: course.id,
        courseVersion: course.version,
        layout: LEARNING_LAYOUT,
        roomIndex: 0,
        // Packs of enemies owed for wrong answers; spawning sends them once the quiz closes.
        audits: 0,
        // Until this run time the waves swell after a failed test (learningRules.surge).
        surgeUntil: 0,
        nextAttempt: 1,
        active: null,
        reviveUsed: false,
        points: 0,
        answers: {},
        rewards: [],
      }
    : null;
}

export function validateLearningCourse(course) {
  const ids = new Set();
  for (const q of course.questions) {
    if (ids.has(q.id) || !q.text || !course.topics[q.topic])
      throw new Error('Invalid learning question: ' + q.id);
    ids.add(q.id);
    if (!['single', 'multiple', 'open'].includes(q.type)) throw new Error('Unknown question type');
    // Explanations speak for themselves, without «according to the material» lead-ins.
    if (/^(По предоставленному|Согласно|По регламенту[^:]*:)/.test(q.explanation ?? ''))
      throw new Error('Explanation with a source lead-in: ' + q.id);
    if (q.type === 'open') continue;
    const options = new Set(q.options.map((o) => o.id));
    if (
      options.size !== q.options.length ||
      !q.correct.length ||
      !q.explanation ||
      q.correct.some((id) => !options.has(id)) ||
      (q.type === 'single' && q.correct.length !== 1)
    )
      throw new Error('Invalid answers: ' + q.id);
  }
  // The course's wrapper on the learning map: a name per maze, the hall's boss, texts.
  if (
    !course.description ||
    !course.victoryTag ||
    !Array.isArray(course.rooms) ||
    course.rooms.length !== course.topics.length ||
    !unitDefinitions[course.boss?.unit]?.boss ||
    !course.boss.message
  )
    throw new Error('Invalid course wrapper: ' + course.id);
  for (let topic = 0; topic < course.topics.length; topic++)
    if (
      course.questions.filter((q) => q.topic === topic && q.type !== 'open').length <
      learningRules.questions
    )
      throw new Error('Insufficient questions');
  return true;
}

export function beginLearning(s, reason, nodeId = null) {
  const l = s.learning;
  if (!l || l.active) return false;
  const node = reason === 'revive' ? null : availableTerminal(s, nodeId);
  if (reason === 'revive') {
    if (l.reviveUsed || s.p.hp > 0) return false;
    l.reviveUsed = true;
  } else if (!node || s.p.hp <= 0) return false;
  const pool = courseOf(s).questions.filter(
    (q) => q.type !== 'open' && (!node || q.topic === node.topic),
  );
  // Prefer unseen questions, then mistakes; shuffle only once when creating the attempt.
  const questions = shuffle(pool, s.rng.random)
    .sort((a, b) => (l.answers[a.id]?.correct ? 1 : 0) - (l.answers[b.id]?.correct ? 1 : 0))
    .slice(0, learningRules.questions);
  l.active = {
    id: l.nextAttempt++,
    reason,
    nodeId,
    topic: node?.topic ?? null,
    phase: 'intro',
    questions: questions.map((q) => ({
      id: q.id,
      options: shuffle(
        q.options.map((o) => o.id),
        s.rng.random,
      ),
    })),
    index: 0,
    selected: [],
    answered: 0,
    correct: 0,
    lastCorrect: false,
    passed: false,
  };
  return true;
}

export function selectLearning(s, id, option) {
  const a = s.learning?.active;
  if (!a || a.id !== id || a.phase !== 'question' || !a.questions[a.index].options.includes(option))
    return false;
  const q = courseOf(s).questions.find((q) => q.id === a.questions[a.index].id);
  a.selected =
    q.type === 'single'
      ? [option]
      : a.selected.includes(option)
        ? a.selected.filter((v) => v !== option)
        : [...a.selected, option];
  return true;
}

export function submitLearning(s, id) {
  const l = s.learning,
    a = l?.active;
  if (!a || a.id !== id || a.phase !== 'question' || !a.selected.length) return false;
  const q = courseOf(s).questions.find((q) => q.id === a.questions[a.index].id);
  const correct =
    a.selected.length === q.correct.length && q.correct.every((v) => a.selected.includes(v));
  // `firstCorrectAt`: the attempt that first got it right; `wrong`: options ever picked
  // wrongly; `sources`: whether terminals or the revival asked it.
  const record = l.answers[q.id] ?? {
    attempts: 0,
    correct: 0,
    firstCorrect: correct,
    firstCorrectAt: null,
    wrong: [],
    sources: [],
    topic: q.topic,
  };
  record.attempts++;
  a.answered++;
  const source = a.reason === 'revive' ? 'revive' : 'terminal';
  if (!record.sources.includes(source)) record.sources.push(source);
  if (correct) {
    if (!record.correct) l.points += learningRules.points;
    record.correct++;
    record.firstCorrectAt ??= record.attempts;
    a.correct++;
  } else
    for (const option of a.selected)
      if (!q.correct.includes(option) && !record.wrong.includes(option)) record.wrong.push(option);
  l.answers[q.id] = record;
  a.lastCorrect = correct;
  a.phase = 'feedback';
  return true;
}

export function advanceLearning(s, id) {
  const a = s.learning?.active;
  if (!a || a.id !== id) return false;
  if (a.phase === 'intro') a.phase = 'question';
  else if (a.phase === 'feedback') {
    if (a.index + 1 < a.questions.length) {
      a.index++;
      a.selected = [];
      a.phase = 'question';
    } else {
      a.passed = a.correct >= learningRules.passing;
      a.phase = 'result';
    }
  } else return false;
  return true;
}

// The result and its reward commit together before app saves the entire run.
export function closeLearning(s, id) {
  const l = s.learning,
    a = l?.active;
  if (!a || a.id !== id) return null;
  const complete = a.phase === 'result';
  if (a.reason === 'revive') {
    if (complete && a.passed) {
      s.p.hp = Math.max(1, s.p.max * learningRules.reviveHealth);
      s.p.inv = learningRules.reviveInvulnerability;
      s.p.hurt = null;
      s.p.action = null;
      s.p.chainImpactAt = null;
    }
    l.active = null;
    return complete && a.passed ? 'play' : 'defeat';
  }
  // A passed terminal drops its reward once, more for more right answers; a failed one (or one
  // left after an answer) shuts for a while and swells the waves. Every wrong answer, passed
  // or not, calls an audit.
  const node = s.nodes.find((n) => n.id === a.nodeId);
  if (complete && a.passed) {
    node.status = 'completed';
    if (!l.rewards.includes(node.id)) {
      const pickups =
        learningRules.terminalRewards.find((r) => a.correct >= r.correct)?.pickups ?? [];
      pickups.forEach((type, i) =>
        s.pickups.push({ x: node.x + (i - (pickups.length - 1) / 2) * 50, y: node.y + 60, type }),
      );
      l.rewards.push(node.id);
    }
  } else if (a.answered > 0) {
    node.retryAt = s.t + learningRules.failLock;
    l.surgeUntil = s.t + learningRules.surge.seconds;
  }
  l.audits += Math.min(learningRules.auditMax, a.answered - a.correct);
  l.active = null;
  return 'play';
}

export function moveLearningRoom(s) {
  if (!s.learning || s.learning.active || !availableExit(s)) return false;
  s.learning.roomIndex++;
  s.learning.audits = 0;
  const { entry } = roomLayout(s.map, s.seed, s.learning.roomIndex);
  for (const key of [
    'enemies',
    'enemyShots',
    'hazards',
    'shots',
    'wfx',
    'fx',
    'texts',
    'corpses',
    'gems',
    'codes',
    'pickups',
  ])
    s[key] = [];
  s.runtime.guards = [];
  s.runtime.crowd = 0;
  s.event = null;
  s.shake = 0;
  Object.assign(s.p, entry, {
    action: null,
    hurt: null,
    chainImpactAt: null,
    slowUntil: 0,
    slowAmount: 0,
    moving: false,
    inv: learningRules.roomEntryInvulnerability,
  });
  // Transient ability targets must not refer to actors in the previous room.
  for (const a of s.abilities) {
    a.left = 0;
    if ('target' in a) a.target = null;
    if ('hit' in a) a.hit = new Set();
    if ('endsAt' in a) a.endsAt = s.t;
  }
  s.spawn = learningRules.roomEntryWave;
  for (const n of s.nodes)
    if (n.room === s.learning.roomIndex && n.status === 'locked') n.status = 'guarded';
  return true;
}

// A question's share of the grade: by the attempt that first got it right, 0 if none did.
export function questionScore(record) {
  const scores = learningGrading.attemptScore;
  return record.firstCorrectAt ? scores[Math.min(record.firstCorrectAt, scores.length) - 1] : 0;
}

// The run's report card: totals, the grade, every topic and every question asked, in order.
export function learningSummary(s) {
  const l = s.learning;
  if (!l) return null;
  const course = courseOf(s);
  const asked = Object.entries(l.answers);
  const entries = asked.map(([, q]) => q);
  const share = (list) =>
    list.length ? list.reduce((n, q) => n + questionScore(q), 0) / list.length : 0;
  const score = share(entries);
  return {
    version: l.courseVersion,
    course: course.title,
    points: l.points,
    answered: entries.length,
    firstCorrect: entries.filter((q) => q.firstCorrect).length,
    retries: entries.reduce((n, q) => n + Math.max(0, q.attempts - 1), 0),
    reviveUsed: l.reviveUsed,
    score,
    grade: entries.length
      ? learningGrading.grades.find((g) => score >= g.min).name
      : learningGrading.grades.at(-1).name,
    topics: course.topics.map((t, i) => {
      const list = entries.filter((q) => q.topic === i);
      return {
        name: t.name,
        asked: list.length,
        score: share(list),
        mistakes: list.reduce((n, q) => n + q.attempts - q.correct, 0),
      };
    }),
    // Ids and numbers only (the run log keeps them); texts come from the course.
    questions: asked
      .map(([id, record]) => ({
        id,
        topic: record.topic,
        attempts: record.attempts,
        firstCorrectAt: record.firstCorrectAt,
        score: questionScore(record),
        revive: record.sources.includes('revive'),
        wrong: [...record.wrong],
      }))
      .sort((a, b) => a.topic - b.topic),
  };
}

// Whether a saved learning state can go on with this build on `map`: same course and version,
// the maze layout generation, and an open quiz that still matches the course's questions.
export function validLearning(l, map) {
  const course = learningCourses[l?.course];
  if (
    !l ||
    !course ||
    mapDefinitions[map]?.objective?.type !== 'learning' ||
    l.courseVersion !== course.version ||
    l.layout !== LEARNING_LAYOUT ||
    !Number.isInteger(l.audits) ||
    !Number.isFinite(l.surgeUntil) ||
    !Object.values(l.answers ?? {}).every(
      (q) => Array.isArray(q.wrong) && Array.isArray(q.sources),
    ) ||
    !Number.isInteger(l.roomIndex) ||
    l.roomIndex < 0 ||
    l.roomIndex >= mapDefinitions[map].rooms.length ||
    typeof l.reviveUsed !== 'boolean' ||
    !l.answers ||
    !Array.isArray(l.rewards)
  )
    return false;
  const a = l.active;
  if (!a) return true;
  return (
    Number.isInteger(a.id) &&
    ['lesson', 'revive'].includes(a.reason) &&
    ['intro', 'question', 'feedback', 'result'].includes(a.phase) &&
    Array.isArray(a.questions) &&
    a.questions.length === learningRules.questions &&
    Number.isInteger(a.answered) &&
    Number.isInteger(a.index) &&
    a.index >= 0 &&
    a.index < a.questions.length &&
    Array.isArray(a.selected) &&
    a.questions.every((item) => {
      const q = course.questions.find((q) => q.id === item.id && q.type !== 'open');
      return (
        q &&
        Array.isArray(item.options) &&
        item.options.length === q.options.length &&
        new Set(item.options).size === item.options.length &&
        item.options.every((id) => q.options.some((o) => o.id === id))
      );
    })
  );
}
