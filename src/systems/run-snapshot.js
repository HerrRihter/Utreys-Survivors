import { validLearning } from './learning.js';
import { makeElite } from './difficulty.js';
import { guardianPoint } from './node-objectives.js';
import { persistentKeys, reducedKeys } from './run-model.js';
import { createGameRng } from '../core/rng.js';
import { toGraphJson, fromGraphJson } from '../core/graph-json.js';
import { persisted } from '../core/storage.js';
import { currentAbilityId, currentCardId } from '../../data/characters/abilities.js';
import { mapDefinitions } from '../../data/maps/maps.js';

// A paused or interrupted run, kept in storage so a closed tab does not lose it. The run model
// (src/systems/run-model.js) says which fields are copied, reduced or rebuilt; the copied ones
// keep the references between their objects (src/core/graph-json.js). A resumed run continues
// exactly as the running one would have: the same enemies with their timers, projectiles and
// ground hazards, the open level-up's cards and the game random source at its position.
// `version` guards the format.
export const RUN_SNAPSHOT_KEY = 'utreys-run-v7';
const VERSION = 7;
// Saves of older builds, newest first. Version 1 had no enemy ids (summons and node
// guardians were linked by object); version 2 used older content ids; version 3 kept a reduced
// run (see migrations).
export const LEGACY_RUN_SNAPSHOT_KEYS = [
  'utreys-run-v6',
  'utreys-run-v5',
  'utreys-run-v4',
  'utreys-run-v3',
  'utreys-run-v2',
  'utreys-run-v1',
];

const pick = (source, keys) => Object.fromEntries(keys.map((key) => [key, source[key]]));

// The reduced form of each `reduce` field of the run model, and how it is put back.
const reducers = {
  rng: (s) => s.rng.getState(),
};
const restorers = {
  rng: (s, value) => s.rng.setState(value),
};
for (const key of reducedKeys)
  if (!reducers[key] || !restorers[key])
    throw new Error('Run snapshot: no reduced form for ' + key);

// Living enemies are written first, so the save lists them in `enemies` and other places
// (targets, hit lists, aura guards) refer to them.
const savedKeys = ['enemies', ...persistentKeys.filter((key) => key !== 'enemies')];

export function snapshotRun(run) {
  const s = run.state;
  const pendingRevive =
    mapDefinitions[s?.map]?.objective?.type === 'learning' &&
    s?.learning?.active?.reason === 'revive' &&
    s.learning.reviveUsed &&
    validLearning(s.learning, s.map);
  if (!s || (s.p.hp <= 0 && !pendingRevive) || s.resultRecorded) return null;
  const level = run.mode === 'level';
  return {
    version: VERSION,
    hero: run.selected,
    map: s.map,
    baClient: s.baSpecialization?.client ?? null,
    // A level-up that was open when the run was saved is offered again with the same cards.
    pendingLevel: level,
    choice: level ? (run.choice || []).map((card) => card.id) : null,
    state: {
      ...toGraphJson(pick(s, savedKeys)),
      ...Object.fromEntries(reducedKeys.map((key) => [key, reducers[key](s)])),
    },
  };
}

// Each step converts a save of its version to the next one.
const migrations = {
  // Version 6 → 7: the incident escalation shift (`incident`), null on every map of version 6.
  6(saved) {
    return { ...saved, version: 7, state: { ...saved.state, incident: null } };
  },
  // Version 5 → 6: learning terminals shut after a failed test (`retryAt`), the waves swell
  // (`surgeUntil`), and every answered question keeps its report card fields.
  5(saved) {
    const state = saved.state;
    const l = state.learning;
    return {
      ...saved,
      version: 6,
      state: {
        ...state,
        nodes: Array.isArray(state.nodes)
          ? state.nodes.map((n) => (n.kind === 'learning-terminal' ? { retryAt: 0, ...n } : n))
          : state.nodes,
        learning: l && {
          ...l,
          surgeUntil: 0,
          answers: Object.fromEntries(
            Object.entries(l.answers ?? {}).map(([id, q]) => [
              id,
              {
                // Version 5 knew only a right first answer; a later right one counts as second.
                firstCorrectAt: q.firstCorrect ? 1 : q.correct ? 2 : null,
                wrong: [],
                sources: ['terminal'],
                ...q,
              },
            ]),
          ),
        },
      },
    };
  },
  4(saved) {
    return { ...saved, version: 5, state: { ...saved.state, learning: null } };
  },
  // Version 1 → 2: enemies and node guardians get ids. Version 1 did not save who summoned an
  // enemy, so its summons are not counted as desk tickets after the resume (as before).
  1(saved) {
    let nextEnemyId = 1;
    const enemies = saved.state.enemies.map((e) => ({ ...e, id: nextEnemyId++, summonerId: null }));
    const nodes = saved.state.nodes.map((n) => ({
      ...n,
      guardianId: n.status === 'guarded' && n.guardianHp === null ? null : nextEnemyId++,
    }));
    return { ...saved, version: 2, state: { ...saved.state, enemies, nodes, nextEnemyId } };
  },
  // Version 2 → 3: renamed content ids. Utrace's ability `potion` is `overclock`: its id in
  // the abilities and its level-up card `ability_potion` in ranks, bans and logged offers.
  // Service desks were named by their label (`Сервисдеск 1`); their ids are `desk-1`...
  2(saved) {
    const state = saved.state;
    const cards = (list) => (Array.isArray(list) ? list.map(currentCardId) : list);
    const objective = mapDefinitions[saved.map]?.objective;
    const deskNumber = (id) =>
      objective?.type === 'desks' && typeof id === 'string' && id.startsWith(objective.label + ' ')
        ? id.slice(objective.label.length + 1)
        : '';
    const nodeId = (id) => (/^\d+$/.test(deskNumber(id)) ? 'desk-' + deskNumber(id) : id);
    return {
      ...saved,
      version: 3,
      state: {
        ...state,
        abilities: state.abilities.map((a) => ({ ...a, id: currentAbilityId(a.id) })),
        nodes: state.nodes.map((n) => ({ ...n, id: nodeId(n.id) })),
        upgradeRanks: Object.fromEntries(
          Object.entries(state.upgradeRanks).map(([id, rank]) => [currentCardId(id), rank]),
        ),
        banned: cards(state.banned),
        offers: state.offers.map((o) => ({
          ...o,
          cards: cards(o.cards),
          picked: currentCardId(o.picked),
          banned: cards(o.banned),
        })),
      },
    };
  },
  // Version 3 → 4: a version 3 save kept a reduced run (the hero's position and health, owned
  // items, node status, living enemies, drops) and no game random source. It stays reduced
  // (`reduced`, restored the old way) and its random source starts from the seed and the time.
  3(saved) {
    const { seed = 0, t = 0 } = saved.state;
    const rng = createGameRng((seed ^ Math.imul(Math.round(t * 60), 0x9e3779b1)) >>> 0);
    return {
      ...saved,
      version: 4,
      reduced: true,
      choice: null,
      state: { ...saved.state, rng: rng.getState() },
    };
  },
};

// A save of an older version brought to the current one, or null if it is not one.
export function migrateRunSnapshot(saved) {
  if (!saved?.state || !Object.hasOwn(migrations, saved.version)) return null;
  let current = saved;
  while (current.version !== VERSION) current = migrations[current.version](current);
  return current;
}

export function createRunSnapshots({ storage }) {
  // A save left by an older build is converted once and stored as the current version.
  const file = persisted(storage, RUN_SNAPSHOT_KEY, {
    // A save of a map this build no longer has (the former separate learning maps) is dropped.
    normalize: (saved) =>
      saved?.version === VERSION && saved.state && Object.hasOwn(mapDefinitions, saved.map)
        ? saved
        : null,
    migrate: migrateRunSnapshot,
    legacyKeys: LEGACY_RUN_SNAPSHOT_KEYS,
  });
  return {
    load: file.load,
    has: () => !!file.load(),
    save(run) {
      const snapshot = snapshotRun(run);
      return !!snapshot && file.save(snapshot);
    },
    clear: file.clear,
  };
}

// Puts a snapshot's data into a freshly started run.
export function restoreRun(s, snapshot, spawn) {
  if (snapshot.reduced) restoreReduced(s, snapshot, spawn);
  else {
    const saved = fromGraphJson(snapshot.state);
    for (const key of persistentKeys) if (key in saved) s[key] = saved[key];
  }
  for (const key of reducedKeys)
    if (snapshot.state[key] !== undefined) restorers[key](s, snapshot.state[key]);
}

// The fields a version 1–3 save kept in a reduced form.
const legacyReducedKeys = [
  'p',
  'weapons',
  'abilities',
  'enemies',
  'nodes',
  'gems',
  'codes',
  'pickups',
];
// A version 1–3 save: `spawn(unit, boss, position)` recreates enemies with their saved ids;
// node guardians are recreated at their nodes with their saved health. Live projectiles and
// effects were not saved.
function restoreReduced(s, snapshot, spawn) {
  const saved = snapshot.state;
  Object.assign(
    s,
    structuredCloneSafe(
      pick(
        saved,
        persistentKeys.filter((key) => key in saved && !legacyReducedKeys.includes(key)),
      ),
    ),
  );
  s.weapons = saved.weapons.map((w) => ({ ...w }));
  Object.assign(s.p, saved.p);
  for (const a of s.abilities) {
    const match = saved.abilities.find((item) => item.id === a.id);
    if (match) a.cd = match.cd;
  }
  s.enemies.length = 0;
  for (const savedNode of saved.nodes) {
    const node = s.nodes.find((n) => n.id === savedNode.id);
    if (!node) continue;
    node.status = savedNode.status;
    node.progress = savedNode.progress;
    // A guarded node without a living guardian spawns a new one, as in a running game.
    node.guardianId = node.status === 'guarded' ? null : savedNode.guardianId;
    if (node.status !== 'guarded' || savedNode.guardianHp === null) continue;
    const guardian = spawn(node.bug, false, guardianPoint(node));
    if (!guardian) continue;
    guardian.id = savedNode.guardianId;
    guardian.hp = savedNode.guardianHp;
    guardian.summons = savedNode.summons || 0;
    guardian.nodeId = node.id;
    node.guardianId = guardian.id;
  }
  for (const e of saved.enemies) {
    const enemy = spawn(e.unit, e.boss, { x: e.x, y: e.y });
    if (!enemy) continue;
    enemy.id = e.id;
    enemy.summonerId = e.summonerId;
    if (e.elite) makeElite(enemy);
    enemy.hp = Math.min(enemy.max, e.hp);
  }
  // Spawning above took fresh ids; the saved counter is past every saved id.
  s.nextEnemyId = saved.nextEnemyId;
  s.gems = saved.gems.map((g) => ({ ...g }));
  s.codes = saved.codes.map((c) => ({ ...c }));
  s.pickups = saved.pickups.map((a) => ({ ...a }));
}

const structuredCloneSafe = (value) => JSON.parse(JSON.stringify(value));
