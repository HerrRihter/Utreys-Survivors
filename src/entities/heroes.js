import { drawUtraceHero } from '../rendering/art/utrace-hero.js';
import { heroDefinitions } from '../../data/characters/heroes.js';

export const Heroes = (() => {
  const defs = heroDefinitions;

  const draw = drawUtraceHero;

  // DataMatrix code token marker pickup
  function codeToken(g, x, y, scale = 1) {
    g.save();
    g.translate(x, y);
    g.scale(scale, scale);
    g.fillStyle = '#00e5ff';
    g.fillRect(-10, -10, 20, 20);
    g.fillStyle = '#0a192f';
    g.fillRect(-8, -8, 16, 16);
    // DataMatrix mini pattern
    g.fillStyle = '#00e5ff';
    g.fillRect(-6, -6, 4, 4);
    g.fillRect(2, -6, 4, 4);
    g.fillRect(-6, 2, 4, 4);
    g.fillRect(0, 0, 3, 3);
    g.fillRect(3, 3, 3, 3);
    g.restore();
  }

  return { defs, draw, codeToken };
})();
