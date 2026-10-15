import { traceabilityCharge } from './hero-charge.js';

export const SpriteRenderer = {
  create(session) {
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
            ? traceabilityCharge(session.state, session.abilities.blocksAttack())
            : null;
        session.Heroes.draw(context, name, x, y, size, flip, actor?.walk || 0, charge);
      },
    };
  },
};
