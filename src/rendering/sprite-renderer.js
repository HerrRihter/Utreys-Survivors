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
        session.Villagers.draw(context, name, x, y, size, flip, actor?.walk || 0);
      },
    };
  },
};
