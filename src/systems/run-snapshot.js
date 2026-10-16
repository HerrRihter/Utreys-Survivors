// A paused or interrupted run, kept in storage so a closed tab does not lose it.
// Only plain data is stored: enemies come back at their saved positions and health, live
// projectiles and effects are dropped. `version` guards the format.
export const RUN_SNAPSHOT_KEY = 'utreys-run-v1';
const VERSION = 1;
const MAX_GEMS = 200;

const pick = (source, keys) => Object.fromEntries(keys.map((key) => [key, source[key]]));
const round = (n) => Math.round(n * 10) / 10;

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
      ...pick(s, [
        't',
        'kills',
        'level',
        'xp',
        'need',
        'earned',
        'spawn',
        'waveNext',
        'bossSpawned',
        'step',
        'stats',
        'upgradeRanks',
        'evoTokens',
        'banned',
        'rerolls',
        'skips',
        'banishes',
        'damageBy',
        'baSpecialization',
        'load',
        'healFactor',
        'endless',
        'endlessStart',
        'endlessKills',
        'productionBossNext',
        'productionBosses',
        'recordedTime',
        'statsRecorded',
        'earnedPaid',
        'firstHurtAt',
        'foodTaken',
        'evolutions',
        'doneBefore',
      ]),
      weapons: (s.weapons || []).map((w) => pick(w, ['id', 'level', 'cd', 'evolved', 'phase'])),
      p: { x: round(s.p.x), y: round(s.p.y), hp: s.p.hp, max: s.p.max },
      abilities: (s.abilities || []).map((a) => ({ id: a.id, cd: a.cd })),
      nodes: s.nodes.map((n) => ({
        id: n.id,
        status: n.status,
        progress: n.progress,
        guardianHp: n.guardian && n.guardian.hp > 0 ? n.guardian.hp : null,
      })),
      enemies: s.enemies
        .filter((e) => e.hp > 0 && !e.nodeId)
        .map((e) => ({ unit: e.unit, x: round(e.x), y: round(e.y), hp: e.hp, boss: !!e.boss })),
      gems: s.gems.slice(0, MAX_GEMS).map((g) => ({ x: round(g.x), y: round(g.y), v: g.v })),
      codes: s.codes.map((c) => ({ x: round(c.x), y: round(c.y), value: c.value })),
      pickups: s.pickups.map((a) => ({ x: round(a.x), y: round(a.y), type: a.type })),
    },
  };
}

export function createRunSnapshots({ storage }) {
  function load() {
    try {
      const saved = JSON.parse(storage.getItem(RUN_SNAPSHOT_KEY));
      return saved?.version === VERSION && saved.state ? saved : null;
    } catch {
      return null;
    }
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
      try {
        if (storage.removeItem) storage.removeItem(RUN_SNAPSHOT_KEY);
        else storage.setItem(RUN_SNAPSHOT_KEY, 'null');
      } catch {}
    },
  };
}

// Puts a snapshot's data into a freshly started run. `spawn(unit, boss, position)` recreates
// enemies; node guardians are recreated at their nodes with their saved health.
export function restoreRun(s, snapshot, spawn) {
  const saved = snapshot.state;
  const { p, abilities, nodes, enemies, weapons, gems, codes, pickups, ...plain } = saved;
  Object.assign(s, structuredCloneSafe(plain));
  s.weapons = weapons.map((w) => ({ ...w }));
  Object.assign(s.p, p);
  for (const a of s.abilities || []) {
    const match = abilities.find((item) => item.id === a.id);
    if (match) a.cd = match.cd;
  }
  s.enemies.length = 0;
  for (const saved of nodes) {
    const node = s.nodes.find((n) => n.id === saved.id);
    if (!node) continue;
    node.status = saved.status;
    node.progress = saved.progress;
    if (node.status !== 'guarded' || saved.guardianHp === null) continue;
    const guardian = spawn(node.bug, false, { x: node.x + 110, y: node.y });
    if (!guardian) continue;
    guardian.hp = saved.guardianHp;
    guardian.nodeId = node.id;
    node.guardian = guardian;
  }
  for (const e of enemies) {
    const enemy = spawn(e.unit, e.boss, { x: e.x, y: e.y });
    if (enemy) enemy.hp = Math.min(enemy.max, e.hp);
  }
  s.gems = gems.map((g) => ({ ...g }));
  s.codes = codes.map((c) => ({ ...c }));
  s.pickups = pickups.map((a) => ({ ...a }));
}

const structuredCloneSafe = (value) => JSON.parse(JSON.stringify(value));
