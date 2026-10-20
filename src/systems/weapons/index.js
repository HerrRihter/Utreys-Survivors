import { projectileKinds } from '../projectiles.js';
import { orbiter } from './orbiter.js';
import { seeker } from './seeker.js';
import { minefield } from './minefield.js';
import { pulse } from './pulse.js';
import { lob } from './lob.js';
import { boomerang } from './boomerang.js';
import { zone } from './zone.js';
import { beam } from './beam.js';

// Kinds of extra weapons. A weapon in data/weapons.js names its `kind`; a kind may have
//   fire(c, s, w, v, st, evo)  when the weapon's cooldown runs out (weapons with `cooldown`)
//   tick(c, s, w, v, st, evo)  every step, before the cooldown
//   effects: { [effectKind](c, s, f, dt, spawned) }  updates of what it put into `s.wfx`
//                              (shots use the projectile kinds of src/systems/projectiles.js)
// `w` is the owned weapon, `v` its stats at its level, `st` the hero's effective stats, `evo`
// the weapon's evolution data once evolved (else null), `c` the weapon system's context
// (damage, audio, math, dt, nearest, hitArea, enemyCd, setEnemyCd).
export const weaponKinds = { orbiter, seeker, minefield, pulse, lob, boomerang, zone, beam };

// Every effect kind of `s.wfx`: the projectiles and what weapon kinds add (mines, zones).
export const effectKinds = Object.assign(
  { ...projectileKinds },
  ...Object.values(weaponKinds).map((kind) => kind.effects || {}),
);
