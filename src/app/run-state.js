import { baClientIds } from '../../data/characters/ba-specialization.js';

/**
 * @typedef {{ tag: string, title: string, text: string, stats: { value: string, label: string }[] }} RunResult
 * @typedef {{ id: string, name: string, desc: string, icon: string, group: string, max?: number }} UpgradeChoice
 * @typedef {{ x: number, y: number, knobX: number, knobY: number }} StickView
 * @typedef {{
 *   state: any, mode: 'menu' | 'play' | 'pause' | 'level' | 'end',
 *   screen: 'menu' | 'heroSelect' | 'shop' | 'achievements' | 'settings' | null,
 *   settingsOrigin: string, selected: string, pendingHero: string, baClient: string,
 *   selectedMap: string, choice: UpgradeChoice[], result: RunResult | null,
 *   best: { kills: number, time: number }, toast: { text: string, left: number },
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
    choice: [],
    result: null, // { win, ... } after a run ends
    best,
    toast: { text: '', left: 0 },
    keys: new Set(),
    pointer: null,
    stick: { x: 0, y: 0 },
    stickView: null, // { x, y, knobX, knobY } while a touch stick is engaged
  };
}

// Interface preferences (screen shake, control hints), persisted separately from progress.
export function createGameSettings({ storage }) {
  const settings = { shake: true, hints: true };
  try {
    const saved = JSON.parse(storage.getItem('utreys-settings'));
    if (saved && typeof saved === 'object') {
      if (typeof saved.shake === 'boolean') settings.shake = saved.shake;
      if (typeof saved.hints === 'boolean') settings.hints = saved.hints;
    }
  } catch {}
  return {
    get shake() {
      return settings.shake;
    },
    get hints() {
      return settings.hints;
    },
    toggle(key) {
      settings[key] = !settings[key];
      try {
        storage.setItem('utreys-settings', JSON.stringify(settings));
      } catch {}
    },
  };
}
