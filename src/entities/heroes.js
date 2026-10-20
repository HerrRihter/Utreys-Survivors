import { drawUtraceHero } from '../rendering/art/utrace-hero.js';
import { heroDefinitions } from '../../data/characters/heroes.js';

export const Heroes = (() => {
  const defs = heroDefinitions;

  const draw = drawUtraceHero;

  return { defs, draw };
})();
