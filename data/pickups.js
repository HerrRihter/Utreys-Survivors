// Map pickups and what kills drop. Each pickup type names its `kind` (what picking it up does,
// src/systems/simulation.js `pickupKinds`) and its `icon` (src/rendering/pickups.js):
//   upgrade  opens an update bundle (one to three item upgrades)
//   pull     pulls every gem on the map to the hero
//   blast    `damage` × the hero's damage to enemies within `halfWidth` × `halfHeight`
//   stun     ordinary enemies freeze for `seconds`
//   heal     restores `amount` HP (× the run's heal factor)
// `ring` is the ring effect at the hero, `text` the floating text, `sound` the effect played.
export const pickupDefinitions = {
  bundle: { kind: 'upgrade', icon: 'crate' },
  magnet: { kind: 'pull', icon: 'magnet', text: 'МАГНИТ', sound: 'pickup' },
  bomb: {
    kind: 'blast',
    icon: 'bomb',
    damage: 120,
    halfWidth: 700,
    halfHeight: 520,
    ring: { r: 520, life: 0.5, color: '#ff8a65' },
    shake: 8,
    sound: 'boss',
  },
  freeze: {
    kind: 'stun',
    icon: 'snowflake',
    seconds: 4,
    ring: { r: 600, life: 0.6, color: '#80deea' },
    text: 'ЗАМОРОЗКА',
    sound: 'magic',
  },
  food: { kind: 'heal', icon: 'capsule', amount: 25, sound: 'heal' },
};

// What a killed enemy leaves (src/systems/combat.js), rolled in this order:
//   code   a code token worth `value` with `chance` + `luck` × the luck stat
//   elite  the pickup an elite always leaves; ordinary kills roll `rare` instead: one roll,
//          the first entry whose `below` the roll is under (thresholds are cumulative)
//   food   a pickup with `chance` + `luck` × the luck stat
export const dropTable = {
  code: { chance: 0.05, luck: 1, value: 3 },
  elite: 'bundle',
  rare: [
    { type: 'magnet', below: 0.004 },
    { type: 'bomb', below: 0.007 },
    { type: 'freeze', below: 0.01 },
  ],
  food: { type: 'food', chance: 0.025, luck: 0.5 },
};
