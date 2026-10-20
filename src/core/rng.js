// Seeded randomness. A run's game random source (`state.rng`) is made from its seed: every
// decision that changes how the run goes draws from it, so a seed and the player's input
// replay the same run. Node layout and event order use their own streams of the same seed.
// A seed is a 32-bit unsigned integer, shown to players as up to 7 base-36 characters.

// mulberry32; `getState()`/`setState()` save and continue the sequence.
export function createRng(seed) {
  let a = seed >>> 0;
  const random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    random,
    rand: (low, high) => low + random() * (high - low),
    getState: () => a,
    setState(state) {
      a = state >>> 0;
    },
    // Plain data wherever the run state is written out: the generator's position.
    toJSON: () => a,
  };
}

// The stream of a run's game random source, apart from the layout's and the events'.
const GAME_STREAM = 0x85ebca6b;
export const createGameRng = (seed) => createRng(seed ^ GAME_STREAM);

export const randomSeed = (random = Math.random) => Math.floor(random() * 4294967296) >>> 0;
export const seedText = (seed) => (seed >>> 0).toString(36).toUpperCase();

// A seed typed by the player, or null when the text is not one.
export function parseSeed(text) {
  const clean = String(text ?? '')
    .trim()
    .toLowerCase();
  if (!/^[0-9a-z]{1,7}$/.test(clean)) return null;
  const value = parseInt(clean, 36);
  return value <= 0xffffffff ? value >>> 0 : null;
}

export function shuffle(list, random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
