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
import { WeaponSystem } from '../systems/weapons.js';
import { createCorpses } from '../systems/corpses.js';
import { createEnemies } from '../entities/enemies.js';
import { Heroes } from '../entities/heroes.js';
import { MenuPortraits } from '../ui/menu-portraits.js';
import { createRunSnapshots } from '../systems/run-snapshot.js';
import { createTips } from './tips.js';

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
    const snapshots = createRunSnapshots({ storage });
    const tips = createTips({ storage, settings, run });
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
      settings,
    });
    const weapons = WeaponSystem.create({ run, world, damage: combat.damage, audio, math });
    const abilities = AbilitySystem.create({
      run,
      world,
      damage: combat.damage,
      progression,
      audio,
      heroes,
      units: enemies.units,
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
        pickUpgrade: (i) => flow.chooseCard(i),
        activateAbility,
        closeScreen: () => flow.closeScreen(),
        captureKey: (code) => flow.captureKey(code),
        reroll: () => flow.reroll(),
        skip: () => flow.skip(),
        banish: () => flow.armBanish(),
      },
      bindings: () => settings.bindings,
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
      weapons,
      spawning,
      snapshots,
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
      weapons,
      settings,
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
      weapons,
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

    // The HUD is refreshed at most ten times a second from the frame loop; the run is saved
    // every 30 s of play, tips are checked four times a second.
    let hudClock = 0,
      saveClock = 0,
      tipClock = 0;
    const SAVE_EVERY = 30;
    function frame(now, dt) {
      if (run.mode === 'play') {
        simulation.update(dt);
        saveClock += dt;
        if (saveClock >= SAVE_EVERY) {
          saveClock = 0;
          snapshots.save(run);
        }
        tipClock += dt;
        if (tipClock >= 0.25) {
          tipClock = 0;
          tips.check();
        }
        if (run.tip.left > 0) run.tip.left -= dt;
      }
      if (run.mode === 'level' && run.levelLock > 0) {
        run.levelLock -= dt;
        if (run.levelLock <= 0) ui.emit();
      }
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
    // Closing or hiding the tab keeps the run for "Continue".
    const keepRun = () => {
      if (run.state && ['play', 'pause', 'level'].includes(run.mode)) snapshots.save(run);
    };
    events.listen(window, 'pagehide', keepRun);

    function dispose() {
      if (disposed) return;
      disposed = true;
      loop.stop();
      input.dispose();
      audio.dispose();
      events.dispose();
      progression.flush?.();
    }
    const read = { run, progression, heroes, enemies, settings, upgrades };

    return {
      // Engine API (tests, tools)
      start: flow.start,
      menu: flow.menu,
      pause: flow.pause,
      pickUpgrade: flow.pickUpgrade,
      resume: flow.resume,
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
        menu: () => views.menuView({ ...read, snapshot: snapshots.load() }),
        heroSelect: () => views.heroSelectView(read),
        shop: () => views.shopView(read),
        achievements: () => views.achievementsView(read),
        levelUp: () => views.levelUpView(read),
        build: () => views.buildView(read),
        levelControls: () => views.levelControlsView(read),
        hud: () => views.hudView(read),
        settings: () => views.settingsView({ run, settings, audio }),
      },
      commands: {
        openHeroSelect: flow.openHeroSelect,
        closeHeroSelect: flow.closeHeroSelect,
        chooseHero: flow.chooseHero,
        chooseBaClient: flow.chooseBaClient,
        chooseMap: flow.chooseMap,
        startSelected: flow.startSelected,
        restart: flow.start,
        resume: flow.resume,
        menu: flow.menu,
        pause: flow.pause,
        pickUpgrade: flow.chooseCard,
        reroll: flow.reroll,
        skip: flow.skip,
        armBanish: flow.armBanish,
        startCapture: flow.startCapture,
        resetBindings: flow.resetBindings,
        setUiScale: flow.setUiScale,
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
