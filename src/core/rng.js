// Seeded randomness for what makes a run repeatable: node layout, bug placement, event order.
// A seed is a 32-bit unsigned integer, shown to players as up to 7 base-36 characters.

export function createRng(seed) {
  let a = seed >>> 0;
  // mulberry32
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

export function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
