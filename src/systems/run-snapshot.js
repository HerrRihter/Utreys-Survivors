import { makeElite } from './difficulty.js';
import { guardianPoint, nodeGuardian } from './node-objectives.js';
import { persistentKeys, reducedKeys } from './run-model.js';

// A paused or interrupted run, kept in storage so a closed tab does not lose it.
// Only plain data is stored: the run model (src/systems/run-model.js) says which fields are
// copied, reduced or rebuilt. Enemies come back at their saved positions and health with
// their ids, live projectiles and effects are dropped. `version` guards the format.
export const RUN_SNAPSHOT_KEY = 'utreys-run-v2';
const VERSION = 2;
// Version 1 had no enemy ids: summons and node guardians were linked by object.
export const LEGACY_RUN_SNAPSHOT_KEY = 'utreys-run-v1';
const MAX_GEMS = 200;

const pick = (source, keys) => Object.fromEntries(keys.map((key) => [key, source[key]]));
const round = (n) => Math.round(n * 10) / 10;

// The reduced form of each `reduce` field of the run model.
const reducers = {
  p: (s) => ({ x: round(s.p.x), y: round(s.p.y), hp: s.p.hp, max: s.p.max }),
  weapons: (s) => s.weapons.map((w) => pick(w, ['id', 'level', 'cd', 'evolved', 'phase'])),
  abilities: (s) => s.abilities.map((a) => ({ id: a.id, cd: a.cd })),
  nodes: (s) =>
    s.nodes.map((n) => {
      const guardian = nodeGuardian(s, n);
      return {
        id: n.id,
        status: n.status,
        progress: n.progress,
        guardianId: n.guardianId,
        guardianHp: guardian && guardian.hp > 0 ? guardian.hp : null,
        // A desk keeps its escalation across a resumed run.
        summons: guardian?.summons || 0,
      };
    }),
  // Node guardians are saved with their nodes.
  enemies: (s) =>
    s.enemies
      .filter((e) => e.hp > 0 && !e.nodeId)
      .map((e) => ({
        id: e.id,
        unit: e.unit,
        x: round(e.x),
        y: round(e.y),
        hp: e.hp,
        boss: !!e.boss,
        elite: !!e.elite,
        summonerId: e.summonerId,
      })),
  gems: (s) => s.gems.slice(0, MAX_GEMS).map((g) => ({ x: round(g.x), y: round(g.y), v: g.v })),
  codes: (s) => s.codes.map((c) => ({ x: round(c.x), y: round(c.y), value: c.value })),
  pickups: (s) => s.pickups.map((a) => ({ x: round(a.x), y: round(a.y), type: a.type })),
};
for (const key of reducedKeys)
  if (!reducers[key]) throw new Error('Run snapshot: no reduced form for ' + key);

export function snapshotRun(run) {
  const s = run.state;
  if (!s || s.p.hp <= 0 || s.resultRecorded) return null;
  return {
    version: VERSION,
    hero: run.selected,
    map: s.map,
    baClient: s.baSpecialization?.client ?? null,
    // A level-up that was open when the run was saved is offered again on resume.
    pendingLevel: run.mode === 'level',
    state: {
      ...pick(s, persistentKeys),
      ...Object.fromEntries(reducedKeys.map((key) => [key, reducers[key](s)])),
    },
  };
}

// Version 1 → 2: enemies and node guardians get ids. Version 1 did not save who summoned an
// enemy, so its summons are not counted as desk tickets after the resume (as before).
export function migrateRunSnapshot(saved) {
  if (saved?.version !== 1 || !saved.state) return null;
  let nextEnemyId = 1;
  const enemies = saved.state.enemies.map((e) => ({ ...e, id: nextEnemyId++, summonerId: null }));
  const nodes = saved.state.nodes.map((n) => ({
    ...n,
    guardianId: n.status === 'guarded' && n.guardianHp === null ? null : nextEnemyId++,
  }));
  return {
    ...saved,
    version: VERSION,
    state: { ...saved.state, enemies, nodes, nextEnemyId },
  };
}

export function createRunSnapshots({ storage }) {
  const read = (key) => {
    try {
      return JSON.parse(storage.getItem(key));
    } catch {
      return null;
    }
  };
  const remove = (key) => {
    try {
      if (storage.removeItem) storage.removeItem(key);
      else storage.setItem(key, 'null');
    } catch {}
  };
  // A version 1 save left by an older build is converted once and stored as version 2.
  function migrate() {
    const legacy = read(LEGACY_RUN_SNAPSHOT_KEY);
    if (legacy === null) return null;
    const migrated = migrateRunSnapshot(legacy);
    try {
      if (migrated) storage.setItem(RUN_SNAPSHOT_KEY, JSON.stringify(migrated));
    } catch {
      return migrated;
    }
    remove(LEGACY_RUN_SNAPSHOT_KEY);
    return migrated;
  }
  function load() {
    const saved = read(RUN_SNAPSHOT_KEY) ?? migrate();
    return saved?.version === VERSION && saved.state ? saved : null;
  }
  return {
    load,
    has: () => !!load(),
    save(run) {
      const snapshot = snapshotRun(run);
      if (!snapshot) return false;
      try {
        storage.setItem(RUN_SNAPSHOT_KEY, JSON.stringify(snapshot));
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      remove(RUN_SNAPSHOT_KEY);
      remove(LEGACY_RUN_SNAPSHOT_KEY);
    },
  };
}

// Puts a snapshot's data into a freshly started run. `spawn(unit, boss, position)` recreates
// enemies with their saved ids; node guardians are recreated at their nodes with their saved
// health.
export function restoreRun(s, snapshot, spawn) {
  const saved = snapshot.state;
  Object.assign(
    s,
    structuredCloneSafe(
      pick(
        saved,
        persistentKeys.filter((key) => key in saved),
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
