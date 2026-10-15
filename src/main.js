import {GameSession} from './app/game-session.js';
import {Villagers} from './entities/heroes.js';
import {Progression} from './systems/persistence.js';
import {UpgradeSystem} from './systems/upgrades.js';
import {RomanArt} from './rendering/art/roman-art.js';
import {Village} from './world/village/village.js';
import {Legion} from './entities/legion.js';
import {Corpses} from './systems/corpses.js';
import {VillagerArt} from './rendering/art/villager-art.js';
import {AnimationArt} from './rendering/art/animation-art.js';
import {HeroArt} from './rendering/art/hero-art.js';
import {MenhirArt} from './rendering/art/menhir-art.js';
import {MenuPortraits} from './ui/menu-portraits.js';

'use strict';

// Browser wiring stays separate from session creation and test adapters.
export const gameSession = GameSession.create({
  document, window, localStorage: {
    getItem(key) {return window.localStorage.getItem(key);},
    setItem(key, value) {window.localStorage.setItem(key, value);},
  },
  performance, Math,
  requestAnimationFrame: callback => window.requestAnimationFrame(callback),
  cancelAnimationFrame: id => window.cancelAnimationFrame(id),
  Villagers, Progression, UpgradeSystem, RomanArt, Village, Legion, Corpses,
  VillagerArt, AnimationArt, HeroArt, MenhirArt, MenuPortraits,
});
gameSession.run();
