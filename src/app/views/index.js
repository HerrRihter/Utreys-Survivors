// Pure read models for the React screens, one module per screen. Each takes the explicit
// pieces it reads and returns plain data; React renders it, the session's commands change the
// underlying state. Shared text templates live in format.js.
export { menuView } from './menu.js';
export { heroSelectView } from './hero-select.js';
export { shopView } from './shop.js';
export { encyclopediaView } from './encyclopedia.js';
export { achievementsView } from './achievements.js';
export { levelUpView, levelControlsView } from './level-up.js';
export { buildView, runStats } from './build.js';
export { hudView } from './hud.js';
export { settingsView } from './settings.js';
export { resultView } from './result.js';
