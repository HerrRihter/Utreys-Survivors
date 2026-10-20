import { learningView } from './views/learning.js';
import * as views from './views/index.js';

// The session's read models for React: each call builds a screen's data from the current state.
/** @param {{ run: import('./run-state.js').RunState } & Record<string, any>} deps */
export function createSessionViews({
  run,
  progression,
  settings,
  upgrades,
  snapshots,
  audio,
  runLog,
  devTools,
}) {
  const read = { run, progression, settings, upgrades };
  return {
    run: () => run,
    learning: () => learningView(read),
    menu: () => views.menuView({ ...read, snapshot: snapshots.load() }),
    heroSelect: () => views.heroSelectView(read),
    shop: () => views.shopView(read),
    achievements: () => views.achievementsView(read),
    encyclopedia: () => views.encyclopediaView(read),
    levelUp: () => views.levelUpView(read),
    build: () => views.buildView(read),
    levelControls: () => views.levelControlsView(read),
    hud: () => views.hudView(read),
    settings: () => views.settingsView({ run, settings, audio, runLog, devTools }),
    // Totals and records per map for «Моя статистика».
    runStats: () => progression.data.runStats,
  };
}
