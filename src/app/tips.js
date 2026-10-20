import { allNodesResolved } from '../systems/node-objectives.js';
import { weaponDefinitions, weaponMaxLevel } from '../../data/weapons.js';
import { persisted } from '../core/storage.js';

// First-run guidance. Each tip is shown once per player (stored), only while hints are on.
const STORAGE_KEY = 'utreys-tips';
const seenIds = (saved) =>
  Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : [];
const TIP_SECONDS = 7;

// One short sentence each: the keys are in the HUD hint, the details in the encyclopedia.
const tipTexts = {
  move: (stick) => (stick ? 'Джойстик — движение. ' : '') + 'Атака срабатывает сама: собирай опыт.',
  desk: () => 'Сервисдеск выпускает Пепси, пока цел. Снеси его.',
  node: () => 'Убей бага или постой в круге — узел освободится.',
  evolve: (name) => `${name} готово к эволюции: нужен архив бага.`,
  boss: () => 'Путь открыт: победи босса.',
};

export function createTips({ storage, settings, run }) {
  const file = persisted(storage, STORAGE_KEY, { normalize: seenIds });
  let seen = file.load();
  function show(id, text) {
    if (!settings.hints || seen.includes(id)) return false;
    seen.push(id);
    file.save(seen);
    run.tip = { text, left: TIP_SECONDS };
    return true;
  }
  // Called a few times a second during play; returns true when a tip appeared.
  function check() {
    const s = run.state;
    if (!s) return false;
    if (s.t > 0.5 && show('move', tipTexts.move(run.touchOnly))) return true;
    const node = s.nodes.find(
      (n) => n.status === 'guarded' && Math.hypot(n.x - s.p.x, n.y - s.p.y) < 260,
    );
    if (
      node && node.kind === 'desk'
        ? show('desk', tipTexts.desk())
        : node && show('node', tipTexts.node())
    )
      return true;
    const ready = s.weapons.find(
      (w) =>
        !w.evolved &&
        w.level >= weaponMaxLevel &&
        (s.upgradeRanks?.[weaponDefinitions[w.id].evolution.passive] || 0) > 0,
    );
    if (
      ready &&
      !(s.evoTokens > 0) &&
      show('evolve', tipTexts.evolve(weaponDefinitions[ready.id].name))
    )
      return true;
    if (allNodesResolved(s) && show('boss', tipTexts.boss())) return true;
    return false;
  }
  return {
    check,
    reset() {
      seen = [];
      file.save(seen);
    },
  };
}
