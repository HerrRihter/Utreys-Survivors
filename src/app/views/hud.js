import { nodeResolved, nodeAvailable } from '../../systems/queries/nodes.js';
import { eventSpec } from '../../systems/queries/events.js';
import { learningActionNear } from '../../systems/queries/learning.js';
import {
  abilityRank,
  abilityUpgradeMax,
  abilityUpgradeDescriptions,
} from '../../../data/characters/abilities.js';
import { unitDefinitions } from '../../../data/enemies/units.js';
import { heroDefinitions } from '../../../data/characters/heroes.js';
import { productionMinutes } from '../../systems/difficulty.js';
import { mapDefinitions } from '../../../data/maps/maps.js';
import { openTickets } from '../../systems/node-objectives.js';
import { defaultBindings } from '../run-state.js';
import { clock, keyLabel, loadLabel, slotKey, withEmptySlots } from './format.js';

// HUD line for the running event; '' when none.
function eventLabel(s) {
  const spec = eventSpec(s);
  if (!spec) return '';
  const e = s.event;
  return spec.label
    .replace('{left}', Math.ceil(Math.max(0, e.left)) + ' с')
    .replace('{progress}', String(Math.floor(e.progress)))
    .replace('{need}', String(e.need));
}

// The HUD's build row (no stats): rebuilt only when upgrades.buildKey changes, so the ten
// HUD refreshes a second reuse one object and the row skips rendering.
const hudBuilds = new WeakMap();
function hudBuild(run, upgrades) {
  const s = run.state,
    key = upgrades.buildKey(run.selected, s);
  let cached = hudBuilds.get(s);
  if (cached?.key !== key) {
    cached = { key, view: withEmptySlots(upgrades.build(run.selected, s)) };
    hudBuilds.set(s, cached);
  }
  return cached.view;
}

const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];

function nodeProgress(s) {
  if (s.learning) {
    const l = s.learning,
      rooms = mapDefinitions[s.map].rooms,
      required = s.nodes.filter((n) => n.required);
    return (
      `Комната ${l.roomIndex + 1}/${rooms.length} · ${rooms[l.roomIndex].name}` +
      ` · Тесты ${required.filter(nodeResolved).length}/${required.length}` +
      ` · ${l.points} очков · ${l.reviveUsed ? 'вторая жизнь использована' : 'вторая жизнь есть'}`
    );
  }
  let next = null,
    nextDistance = Infinity,
    resolved = 0;
  for (const n of s.nodes) {
    if (nodeResolved(n)) {
      resolved++;
      continue;
    }
    if (!nodeAvailable(n)) continue;
    const d = Math.hypot(n.x - s.p.x, n.y - s.p.y);
    if (d < nextDistance) {
      next = n;
      nextDistance = d;
    }
  }
  const arrow =
    next &&
    arrows[(Math.round(Math.atan2(next.y - s.p.y, next.x - s.p.x) / (Math.PI / 4)) + 8) % 8];
  const desks = s.nodes[0]?.kind === 'desk';
  return (
    (desks
      ? `Сервисдески: ${resolved}/${s.nodes.length} · бэклог ${openTickets(s)}`
      : `Узлы: ${resolved}/${s.nodes.length}`) +
    (next
      ? ` · ${next.label} ${arrow} ${Math.round(nextDistance / 10) * 10} px`
      : ' · Шлюз ЦРПТ разблокирован')
  );
}

function abilityButtons(run) {
  const s = run.state;
  return s.abilities.slice(0, 2).map((a, i) => {
    const status = a.left > 0 ? 'Активно' : a.cd > 0 ? Math.ceil(a.cd) + ' с' : 'Готово';
    return {
      label: `${run.touchOnly ? '' : slotKey(i) + ' · '}${a.name} · ${abilityRank(s, a.id)}/${abilityUpgradeMax}\n${
        a.left > 0 ? 'Активно ' + a.left.toFixed(1) + ' с' : status
      }`,
      name: a.name,
      status,
      title: a.description + ' Улучшение: ' + abilityUpgradeDescriptions[a.id],
      disabled: run.mode !== 'play' || a.cd > 0 || a.left > 0,
    };
  });
}

function controlsHint(b = defaultBindings, desks = false) {
  const k = (action) => keyLabel(b[action]);
  return (
    `${k('up')}${k('left')}${k('down')}${k('right')} / СТРЕЛКИ — ПЕРЕМЕЩЕНИЕ · АТАКА И ОРУЖИЕ — АВТОМАТИЧЕСКИ · ` +
    `${k('abilityQ')} / ${k('abilityE')} — УМЕНИЯ · ESC — ПАУЗА · ` +
    (desks ? 'СНЕСИ ВСЕ СЕРВИСДЕСКИ' : 'УЗЛЫ: УБЕЙ БАГА ИЛИ СТОЙ В КРУГЕ 6 С')
  );
}

// Everything the in-run overlay shows; refreshed about ten times a second.
export function hudView({ run, progression, settings, upgrades }) {
  const s = run.state;
  if (!s) return null;
  const hero = heroDefinitions[run.selected];
  const boss = s.enemies.find((e) => e.boss);
  const ba = s.baSpecialization;
  return {
    heroLabel: hero.name.toUpperCase(),
    healthPct: Math.round((s.p.hp / s.p.max) * 1000) / 10,
    levelText: `УР. ${s.level}  ·  ${Math.ceil(s.p.hp)} / ${s.p.max} HP`,
    xpPct: Math.min(100, (s.xp / s.need) * 100),
    time: clock(s.t),
    kills: `${s.kills} ПОБЕЖДЕНО`,
    weapon:
      hero.weapon +
      ' · ' +
      mapDefinitions[s.map]?.name +
      ` · ${loadLabel(s.load || 1)}` +
      (s.endless ? ` · Продакшен ${productionMinutes(s)} мин` : '') +
      (ba ? ` · Клиент: ${unitDefinitions[ba.client].name} · +${ba.bonus} HP` : ''),
    codes: `КОДЫ: ${progression.wallet.codes} (+${s.earned})`,
    progress: nodeProgress(s),
    event: eventLabel(s),
    boss: boss
      ? {
          name: unitDefinitions[boss.unit]?.name || 'ШЛЮЗ ЦРПТ',
          pct: Math.round((boss.hp / boss.max) * 1000) / 10,
        }
      : null,
    abilities: abilityButtons(run),
    showAbilities: run.mode === 'play',
    // Pause only means something during play; the stick is shown with it.
    showPause: run.mode === 'play',
    showHint: settings.hints,
    hint: s.learning
      ? 'Подойди к терминалу и начни тест · После успеха найди переход в следующую комнату'
      : controlsHint(settings.bindings, s.nodes[0]?.kind === 'desk'),
    stick: run.stickView,
    build: upgrades ? hudBuild(run, upgrades) : null,
    // A test or a room exit within reach takes the tip's place under the hero.
    tip: run.mode === 'play' && run.tip?.left > 0 && !learningActionNear(s) ? run.tip.text : '',
  };
}
