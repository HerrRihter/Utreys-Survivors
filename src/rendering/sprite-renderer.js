import { traceabilityCharge } from './hero-charge.js';
import { blocksAttack } from '../systems/ability-state.js';

// Hero sprites for the scene and menu portraits; the Traceability ring reads the live run.
export const SpriteRenderer = {
  create({ run, heroes }) {
    return {
      sprite(
        context,
        name,
        x,
        y,
        size = 2,
        flip = false,
        bob = 0,
        flash = false,
        phase = 0,
        actor = null,
      ) {
        const charge =
          actor?.player && name === 'traceability'
            ? traceabilityCharge(run.state, blocksAttack(run.state))
            : null;
        heroes.draw(context, name, x, y, size, flip, actor?.walk || 0, charge);
      },
    };
  },
};
