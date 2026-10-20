// Fallen enemies stay `CORPSE_LIFETIME` seconds and fade out over the last `CORPSE_FADE`.
export const CORPSE_LIFETIME = 8;
export const CORPSE_FADE = 2;

export const corpseOpacity = (body) =>
  Math.min(1, Math.max(0, (CORPSE_LIFETIME - body.age) / CORPSE_FADE));
