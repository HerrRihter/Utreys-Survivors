// Text templates shared by the read models: one place for how times, numbers, codes, keys
// and ability slots are written on screen.

export function clock(time) {
  const minutes = Math.floor(time / 60),
    seconds = Math.floor(time % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export const percent = (n) => Math.round(n * 100) + '%';
export const decimal = (n) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

// An amount of codes: «25 кодов».
export const codes = (n) => n + ' кодов';

export const loadLabel = (level) => `Нагрузка ${level}`;

// The key of an ability slot: the first ability is Q, the second E.
export const slotKey = (i) => (i ? 'E' : 'Q');

const keyNames = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Пробел' };
export const keyLabel = (code) =>
  keyNames[code] ||
  (code || '')
    .replace(/^Key/, '')
    .replace(/^Digit/, '')
    .replace(/^Numpad/, 'Num ');

// A build (upgrades.build) with the counts of its empty weapon and passive slots.
export const withEmptySlots = (build) => ({
  ...build,
  emptyWeapons: Math.max(0, build.weaponSlots - build.weapons.length),
  emptyPassives: Math.max(0, build.passiveSlots - build.passives.length),
});

// A long duration: «1:02:05» from an hour on, «2:05» below.
export const duration = (seconds) => {
  const total = Math.floor(seconds),
    h = Math.floor(total / 3600),
    m = Math.floor((total % 3600) / 60),
    s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};
