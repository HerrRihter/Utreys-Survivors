import { createEventScope } from '../core/lifecycle.js';
import { createArenas, arenaDefinitions } from '../world/arenas.js';
import { createMath } from '../core/math.js';
import { CanvasSystem } from '../rendering/canvas.js';
import { SpriteRenderer } from '../rendering/sprite-renderer.js';
import { SceneRenderer } from '../rendering/scene-renderer.js';
import { canvasFactory } from '../rendering/offscreen.js';
import { AudioSystem } from '../core/audio.js';
import { InputSystem } from '../core/input.js';
import { GameLoop } from '../core/game-loop.js';
import { GameFlow } from './game-flow.js';
import { createStore } from './store.js';
import { createRunState, createGameSettings } from './run-state.js';
import * as views from './views.js';
import { EnemySpawning } from '../systems/enemy-spawning.js';
import { CombatSystem } from '../systems/combat.js';
import { Simulation } from '../systems/simulation.js';
import { AbilitySystem } from '../systems/abilities.js';
import { UpgradeSystem } from '../systems/upgrades.js';
import { createCorpses } from '../systems/corpses.js';
import { createEnemies } from '../entities/enemies.js';
import { Heroes } from '../entities/heroes.js';
import { MenuPortraits } from '../ui/menu-portraits.js';

// Composition root of one game mount. Every system gets exactly the collaborators it uses;
// React talks to the session through `ui`/`hud` stores, read models (views) and commands.
export const GameSession = {
  create({
    document,
    window,
    storage,
    performance,
    requestAnimationFrame,
    cancelAnimationFrame,
    canvas,
    progression,
    heroes = Heroes,
  }) {
    const events = createEventScope();
    let disposed = false;
    const createCanvas = canvasFactory(document);
    const ctx = canvas.getContext('2d');
    const view = CanvasSystem.create({ window, canvas, ctx });
    view.resize();
    events.listen(window, 'resize', view.resize);

    const math = createMath(Math);
    const run = createRunState({ storage });
    const settings = createGameSettings({ storage });
    const ui = createStore(),
      hud = createStore();
    const arenas = createArenas({ createCanvas });
    // Resolved once per map change: the simulation reads it hundreds of times per frame.
    const world = {
      arena: arenas.get(run.selectedMap),
      select(id) {
        this.arena = arenas.get(id);
      },
    };
    const enemies = createEnemies({ createCanvas });
    const corpses = createCorpses({ enemies, createCanvas });
    const upgrades = UpgradeSystem.create(progression);
    const audio = AudioSystem.create({
      window,
      document,
      storage,
      performance,
      random: () => Math.random(),
      getMode: () => run.mode,
      onChange: ui.emit,
    });
    function toast(text) {
      run.toast = { text, left: 3 };
      ui.emit();
    }

    const combat = CombatSystem.create({
      run,
      heroes,
      enemies,
      corpses,
      progression,
      world,
      audio,
      math,
      toast,
    });
    const abilities = AbilitySystem.create({
      run,
      world,
      damage: combat.damage,
      progression,
      audio,
    });
    const spawning = EnemySpawning.create({ run, enemies, world, math, toast, audio });
    function activateAbility(slot) {
      const cast = abilities.activate(slot);
      if (cast) hud.emit();
      return cast;
    }
    // Input calls back into the flow created right after it.
    const input = InputSystem.create({
      window,
      document,
      canvas,
      run,
      actions: {
        pause: () => flow.pause(),
        pickUpgrade: (i) => flow.pickUpgrade(i),
        activateAbility,
        closeScreen: () => flow.closeScreen(),
      },
      onStick: hud.emit,
    });
    const flow = GameFlow.create({
      run,
      settings,
      progression,
      heroes,
      enemies,
      upgrades,
      world,
      abilities,
      audio,
      input,
      math,
      storage,
      toast,
      ui,
      hud,
    });
    const simulation = Simulation.create({
      run,
      view,
      world,
      heroes,
      enemies,
      corpses,
      progression,
      audio,
      math,
      abilities,
      combat,
      spawning,
      events: { finish: flow.finish, levelUp: flow.levelUp },
    });
    const { sprite } = SpriteRenderer.create({ run, heroes });
    const renderer = SceneRenderer.create({
      ctx,
      view,
      run,
      world,
      corpses,
      heroes,
      enemies,
      abilities,
      sprite,
      settings,
      math,
      performance,
    });

    // Hero portraits in menus: React attaches canvases, the loop animates them in the menu.
    const portraits = MenuPortraits.create({ document, sprite, artStatus: () => 'canvas-v1' });
    const attached = new Map();
    let portraitPhase = -1;
    function attachPortrait(target, hero, { animated = true } = {}) {
      portraits.fit(target, hero, 0);
      if (animated) attached.set(target, hero);
      return () => attached.delete(target);
    }
    function animatePortraits(now) {
      const phase = Math.floor(now / 190) % 8;
      if (phase === portraitPhase) return;
      portraitPhase = phase;
      for (const [target, hero] of attached) portraits.fit(target, hero, phase);
    }

    // The HUD is refreshed at most ten times a second from the frame loop.
    let hudClock = 0;
    function frame(now, dt) {
      if (run.mode === 'play') simulation.update(dt);
      if (run.mode === 'menu') animatePortraits(now);
      if (run.toast.left > 0) {
        run.toast.left -= dt;
        if (run.toast.left <= 0) ui.emit();
      }
      hudClock += dt;
      if (run.state && hudClock >= 0.1) {
        hudClock = 0;
        hud.emit();
      }
      renderer.draw();
    }
    const loop = GameLoop.create({ requestAnimationFrame, cancelAnimationFrame, frame, audio });
    input.bind();

    function dispose() {
      if (disposed) return;
      disposed = true;
      loop.stop();
      input.dispose();
      audio.dispose();
      events.dispose();
      progression.flush?.();
    }
    const read = { run, progression, heroes, enemies, settings };

    return {
      // Engine API (tests, tools)
      start: flow.start,
      menu: flow.menu,
      pause: flow.pause,
      pickUpgrade: flow.pickUpgrade,
      finish: flow.finish,
      activateAbility,
      update: simulation.update,
      draw: renderer.draw,
      spawn: spawning.spawn,
      damage: combat.damage,
      upgrades,
      enemies,
      run() {
        if (!disposed) loop.run();
      },
      stop: loop.stop,
      dispose,
      keys: run.keys,
      get state() {
        return run.state;
      },
      get mode() {
        return run.mode;
      },
      get running() {
        return loop.running;
      },
      selectMap(id) {
        if (!arenaDefinitions[id]) throw new Error('Unknown map: ' + id);
        flow.chooseMap(id);
      },
      select(hero) {
        run.selected = hero;
        run.pendingHero = hero;
      },

      // React bindings
      ui: { subscribe: ui.subscribe, getVersion: ui.getVersion },
      hud: { subscribe: hud.subscribe, getVersion: hud.getVersion },
      views: {
        run: () => run,
        menu: () => views.menuView(read),
        heroSelect: () => views.heroSelectView(read),
        shop: () => views.shopView(read),
        achievements: () => views.achievementsView(read),
        levelUp: () => views.levelUpView(read),
        hud: () => views.hudView(read),
        settings: () => ({ shake: settings.shake, hints: settings.hints, ...audio.settings }),
      },
      commands: {
        openHeroSelect: flow.openHeroSelect,
        closeHeroSelect: flow.closeHeroSelect,
        chooseHero: flow.chooseHero,
        chooseBaClient: flow.chooseBaClient,
        chooseMap: flow.chooseMap,
        startSelected: flow.startSelected,
        restart: flow.start,
        menu: flow.menu,
        pause: flow.pause,
        pickUpgrade: flow.pickUpgrade,
        activateAbility,
        openShop: flow.openShop,
        openAchievements: flow.openAchievements,
        backToMenu: flow.backToMenu,
        openSettings: flow.openSettings,
        closeSettings: flow.closeSettings,
        buyHero: flow.buyHero,
        buyUpgrade: flow.buyUpgrade,
        claimAchievement: flow.claimAchievement,
        toggleSetting: flow.toggleSetting,
        toggleSound: audio.toggle,
        setVolume: audio.setVolume,
        attachPortrait,
      },
    };
  },
};
