import { traceabilityCharge } from './hero-charge.js';
import { blocksAttack } from '../systems/ability-state.js';

// Hero sprites for the scene and menu portraits; the Traceability ring reads the live run.
export const SpriteRenderer = {
  create({ run, heroes }) {
    return {
      // `flash` marks the blinking frames of the hero's invulnerability.
      sprite(context, name, x, y, size = 2, flip = false, flash = false, actor = null) {
        const charge =
          actor?.player && name === 'traceability'
            ? traceabilityCharge(run.state, blocksAttack(run.state))
            : null;
        if (!flash) return heroes.draw(context, name, x, y, size, flip, actor?.walk || 0, charge);
        context.save();
        context.globalAlpha *= 0.35;
        heroes.draw(context, name, x, y, size, flip, actor?.walk || 0, charge);
        context.restore();
      },
    };
  },
};
