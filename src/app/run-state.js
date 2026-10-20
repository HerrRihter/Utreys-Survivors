import { baClientIds } from '../../data/characters/ba-specialization.js';

/**
 * @typedef {{ id: string, icon: string, name: string, level: number, max: number,
 *   evolved?: boolean, evolution?: string, needs?: string }} BuildItem
 * @typedef {{ weapons: BuildItem[], passives: BuildItem[], weaponSlots: number,
 *   passiveSlots: number }} RunBuild
 * @typedef {{ win: boolean, tag: string, title: string, text: string,
 *   stats: { value: string, label: string, best?: boolean }[],
 *   damage: { tag: string, name: string, amount: number, share: number }[],
 *   build: RunBuild, canContinue?: boolean, seed: string,
 *   unlocked: { id: string, title: string, unlock: string }[],
 *   goals: import('./unlocks.js').UnlockGoal[] }} RunResult
 * @typedef {{ id: string, name: string, desc: string, icon: string, group: string,
 *   detail?: string, kind?: string, isNew?: boolean, evolves?: boolean, max?: number }} UpgradeChoice
 * @typedef {{ x: number, y: number, knobX: number, knobY: number }} StickView
 * @typedef {{
 *   state: import('../systems/run-model.js').RunModel | null, mode: 'menu' | 'play' | 'pause' | 'level' | 'end',
 *   screen: 'menu' | 'heroSelect' | 'shop' | 'achievements' | 'encyclopedia' | 'settings' | null,
 *   settingsOrigin: string, selected: string, pendingHero: string, baClient: string,
 *   selectedMap: string, selectedLoad: number, seedInput: string,
 *   nextSeed: number | null, touchOnly: boolean, choice: UpgradeChoice[], banishArmed: boolean,
 *   capture: string | null, result: RunResult | null,
 *   best: { kills: number, time: number }, toast: { text: string, left: number },
 *   levelLock: number, tip: { text: string, left: number },
 *   keys: Set<string>, pointer: { id: number, x: number, y: number } | null,
 *   stick: { x: number, y: number }, stickView: StickView | null,
 * }} RunState
 */

// Everything that describes "where the player is" between frames: the current run, which screen
// is open, menu choices and raw input. Systems receive it explicitly and mutate it in place.
/** @returns {RunState} */
export function createRunState({ storage }) {
  let best = { kills: 0, time: 0 };
  try {
    best = JSON.parse(storage.getItem('utreys-best')) || best;
  } catch {}
  return {
    state: null, // the active run, null in the menu
    mode: 'menu', // menu | play | pause | level | end
    screen: 'menu', // menu | heroSelect | shop | achievements | settings | null (in a run)
    settingsOrigin: 'menu',
    selected: 'utrace',
    pendingHero: 'utrace',
    baClient: baClientIds[0],
    selectedMap: 'empty',
    selectedLoad: 1, // load level for the next run, clamped to what the hero has opened
    seedInput: '', // seed typed in hero select; empty means a random one
    touchOnly: false, // a touch device without mouse or keyboard (set by the session)
    nextSeed: null, // seed for the next start (typed, repeated or resumed)
    choice: [],
    banishArmed: false, // the next card picked is banned instead of taken
    capture: null, // the action whose key the settings screen is waiting for
    result: null, // { win, ... } after a run ends
    best,
    toast: { text: '', left: 0 },
    levelLock: 0, // seconds before a level-up card accepts player input
    tip: { text: '', left: 0 }, // first-run guidance banner
    keys: new Set(),
    pointer: null,
    stick: { x: 0, y: 0 },
    stickView: null, // { x, y, knobX, knobY } while a touch stick is engaged
  };
}

// Default key per action. Arrows always move as well; Escape always pauses.
export const defaultBindings = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  abilityQ: 'KeyQ',
  abilityE: 'KeyE',
  pause: 'KeyP',
  reroll: 'KeyR',
  skip: 'KeyX',
  banish: 'KeyB',
};
export const bindingLabels = {
  up: 'Вверх',
  down: 'Вниз',
  left: 'Влево',
  right: 'Вправо',
  abilityQ: 'Умение Q',
  abilityE: 'Умение E',
  pause: 'Пауза',
  reroll: 'Реролл карточек',
  skip: 'Пропуск левелапа',
  banish: 'Бан карточки',
};
export const uiScales = [0.8, 0.9, 1, 1.15, 1.3];

// The in-run HUD on a small screen grows less than menus do (menus scroll, the arena does
// not): at most 100% on short landscape phones and small portrait ones, 115% on other
// narrow portrait phones.
export function hudScale(uiScale, width, height) {
  if (height <= 500 || width <= 370) return Math.min(uiScale, 1);
  if (width <= 480) return Math.min(uiScale, 1.15);
  return uiScale;
}

// Interface preferences (screen shake, hints, damage numbers, UI scale, key bindings),
// persisted separately from progress.
export function createGameSettings({ storage }) {
  const settings = {
    shake: true,
    hints: true,
    damageNumbers: true,
    uiScale: 1,
    bindings: { ...defaultBindings },
  };
  try {
    const saved = JSON.parse(storage.getItem('utreys-settings'));
    if (saved && typeof saved === 'object') {
      for (const key of ['shake', 'hints', 'damageNumbers'])
        if (typeof saved[key] === 'boolean') settings[key] = saved[key];
      if (uiScales.includes(saved.uiScale)) settings.uiScale = saved.uiScale;
      if (saved.bindings && typeof saved.bindings === 'object')
        for (const action of Object.keys(defaultBindings))
          if (typeof saved.bindings[action] === 'string')
            settings.bindings[action] = saved.bindings[action];
    }
  } catch {}
  const save = () => {
    try {
      storage.setItem('utreys-settings', JSON.stringify(settings));
    } catch {}
  };
  return {
    get shake() {
      return settings.shake;
    },
    get hints() {
      return settings.hints;
    },
    get damageNumbers() {
      return settings.damageNumbers;
    },
    get uiScale() {
      return settings.uiScale;
    },
    get bindings() {
      return settings.bindings;
    },
    toggle(key) {
      settings[key] = !settings[key];
      save();
    },
    setUiScale(value) {
      if (!uiScales.includes(value)) return;
      settings.uiScale = value;
      save();
    },
    // One key per action: taking a key from another action swaps the two.
    bind(action, code) {
      if (!Object.hasOwn(defaultBindings, action) || !code || code === 'Escape') return false;
      const previous = settings.bindings[action];
      for (const [other, key] of Object.entries(settings.bindings))
        if (other !== action && key === code) settings.bindings[other] = previous;
      settings.bindings[action] = code;
      save();
      return true;
    },
    resetBindings() {
      settings.bindings = { ...defaultBindings };
      save();
    },
  };
}
