import { allNodesResolved } from '../systems/node-objectives.js';
import { weaponDefinitions, weaponMaxLevel } from '../../data/weapons.js';

// First-run guidance. Each tip is shown once per player (stored), only while hints are on.
const STORAGE_KEY = 'utreys-tips';
const TIP_SECONDS = 7;

export const tipTexts = {
  move: (keys) =>
    `${keys} — движение. Атака и оружие срабатывают сами. Собирай опыт — на новом уровне выбирай улучшение.`,
  node: () =>
    'Узел компонента. Убей бага — получишь архив для эволюции оружия. Или стой в круге 6 с без урона — найдёшь воркэраунд.',
  evolve: (name) =>
    `${name} готово к эволюции. Убей бага у любого узла: его архив запустит эволюцию.`,
  boss: () => 'Все узлы разрешены. Появился ЦРПТ — победи его, чтобы завершить забег.',
};

export function createTips({ storage, settings, run }) {
  let seen = [];
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) seen = saved.filter((id) => typeof id === 'string');
  } catch {}
  function show(id, text) {
    if (!settings.hints || seen.includes(id)) return false;
    seen.push(id);
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(seen));
    } catch {}
    run.tip = { text, left: TIP_SECONDS };
    return true;
  }
  const keyName = (code) => (code || '').replace(/^Key/, '');
  // Called a few times a second during play; returns true when a tip appeared.
  function check() {
    const s = run.state;
    if (!s) return false;
    const b = settings.bindings || {};
    const moveKeys = run.touchOnly
      ? 'Джойстик справа внизу'
      : [b.up, b.left, b.down, b.right].map(keyName).join('') + ' или стрелки';
    if (s.t > 0.5 && show('move', tipTexts.move(moveKeys))) return true;
    const node = s.nodes.find(
      (n) => n.status === 'guarded' && Math.hypot(n.x - s.p.x, n.y - s.p.y) < 260,
    );
    if (node && show('node', tipTexts.node())) return true;
    const ready = (s.weapons || []).find(
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
      try {
        storage.setItem(STORAGE_KEY, '[]');
      } catch {}
    },
  };
}
