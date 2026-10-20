import { traceabilityCharge } from './hero-charge.js';
import { drawUtraceHero, heroAccessories } from './art/utrace-hero.js';
import { blocksAttack } from '../systems/queries/abilities.js';

// Hero sprites for the scene and menu portraits; a `charged` accessory (the Traceability ring)
// reads the live run.
// `drawHero` paints one hero (tests replace it).
export const SpriteRenderer = {
  create({ run, drawHero = drawUtraceHero }) {
    return {
      // `flash` marks the blinking frames of the hero's invulnerability.
      sprite(context, name, x, y, size = 2, flip = false, flash = false, actor = null) {
        const charge =
          actor?.player && heroAccessories[name]?.charged
            ? traceabilityCharge(run.state, blocksAttack(run.state))
            : null;
        if (!flash) return drawHero(context, name, x, y, size, flip, actor?.walk || 0, charge);
        context.save();
        context.globalAlpha *= 0.35;
        drawHero(context, name, x, y, size, flip, actor?.walk || 0, charge);
        context.restore();
      },
    };
  },
};
