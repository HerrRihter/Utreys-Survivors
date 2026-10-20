import { createEventScope } from '../core/lifecycle.js';
import { createArenas, arenaDefinitions } from '../world/arenas.js';
import { CanvasSystem } from '../rendering/canvas.js';
import { SpriteRenderer } from '../rendering/sprite-renderer.js';
import { SceneRenderer } from '../rendering/scene-renderer.js';
import { createArenaFloor } from '../rendering/arena-floor.js';
import { cameraOrigin } from '../rendering/camera.js';
import { canvasFactory } from '../rendering/offscreen.js';
import { AudioSystem } from '../core/audio.js';
import { InputSystem } from '../core/input.js';
import { GameLoop, createFixedStep, STEP } from '../core/game-loop.js';
import { GameFlow } from './game-flow.js';
import { createStore } from '../core/store.js';
import { createRunState, createGameSettings } from './run-state.js';
import * as views from './views.js';
import { EnemySpawning } from '../systems/enemy-spawning.js';
import { CombatSystem } from '../systems/combat.js';
import { Simulation } from '../systems/simulation.js';
import { updateEnemySpeech } from '../systems/enemy-speech.js';
import { AbilitySystem } from '../systems/abilities.js';
import { RunEvents } from '../systems/run-events.js';
import { createRunLog } from '../systems/run-log.js';
import { UpgradeSystem } from '../systems/upgrades.js';
import { WeaponSystem } from '../systems/weapons.js';
import { createCorpses } from '../systems/corpses.js';
import { createCorpseRenderer } from '../rendering/corpses.js';
import { createEnemyRenderer } from '../rendering/enemies.js';
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
  }) {
    const events = createEventScope();
    let disposed = false;
    const createCanvas = canvasFactory(document);
    const ctx = canvas.getContext('2d');
    const view = CanvasSystem.create({ window, canvas, ctx });
    view.resize();
    events.listen(window, 'resize', view.resize);

    // Randomness that changes nothing in the run (sparks, screen shake, animation phases,
    // sound variants). Every game decision draws from the run's own `state.rng`.
    const cosmetic = () => Math.random();
    const run = createRunState({ storage });
    // No mouse and no hover: a phone or tablet. Keyboard hints and key settings are hidden.
    const touchQuery = window.matchMedia?.('(hover: none) and (pointer: coarse)');
    run.touchOnly = !!touchQuery?.matches;
    const settings = createGameSettings({ storage });
    const snapshots = createRunSnapshots({ storage });
    const runLog = createRunLog({ storage });
    const tips = createTips({ storage, settings, run });
    const ui = createStore(),
      hud = createStore();
    if (touchQuery)
      events.listen(touchQuery, 'change', () => {
        run.touchOnly = touchQuery.matches;
        ui.emit();
        hud.emit();
      });
    const arenas = createArenas();
    // Resolved once per map change: the simulation reads it hundreds of times per frame.
    const world = {
      arena: arenas.get(run.selectedMap),
      select(id) {
        this.arena = arenas.get(id);
      },
    };
    const corpses = createCorpses();
    const upgrades = UpgradeSystem.create(progression);
    const audio = AudioSystem.create({
      window,
      document,
      storage,
      performance,
      random: cosmetic,
      getMode: () => run.mode,
      onChange: ui.emit,
    });
    function toast(text) {
      run.toast = { text, left: 3 };
      ui.emit();
    }

    const combat = CombatSystem.create({
      run,
      corpses,
      wallet: progression.wallet,
      records: progression.records,
      world,
      audio,
      cosmetic,
      toast,
      settings,
    });
    const weapons = WeaponSystem.create({ run, world, damage: combat.damage, audio });
    const abilities = AbilitySystem.create({
      run,
      world,
      damage: combat.damage,
      records: progression.records,
      audio,
    });
    const spawning = EnemySpawning.create({ run, world, toast, audio });
    const runEvents = RunEvents.create({
      run,
      world,
      spawning,
      wallet: progression.wallet,
      toast,
      audio,
    });
    // Saves the run journal as a JSON file; returns the file's text (tests read it).
    function exportRunLog() {
      const text = runLog.json();
      try {
        const blob = new window.Blob([text], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `utreys-runs-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      } catch {}
      return text;
    }
    function clearRunLog() {
      runLog.clear();
      ui.emit();
    }
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
      upgrades,
      world,
      abilities,
      weapons,
      spawning,
      snapshots,
      runLog,
      audio,
      input,
      storage,
      toast,
      ui,
      hud,
    });
    const simulation = Simulation.create({
      run,
      world,
      corpses,
      wallet: progression.wallet,
      audio,
      abilities,
      combat,
      spawning,
      weapons,
      runEvents,
      events: { finish: flow.finish, levelUp: flow.levelUp, openBundle: flow.openBundle, toast },
    });
    const { sprite } = SpriteRenderer.create({ run });
    // The session's own enemy renderer: its sprite caches follow this canvas's pixel ratio.
    const enemies = createEnemyRenderer({ createCanvas });
    const renderer = SceneRenderer.create({
      ctx,
      floor: createArenaFloor({ createCanvas }),
      view,
      run,
      world,
      corpses: createCorpseRenderer({ enemies, createCanvas }),
      enemies,
      sprite,
      settings,
      cosmetic,
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
    // One simulation step reads the movement intent the input layer combines right before it.
    // Speech is cosmetic and picks among enemies on screen, so it runs here with the camera's
    // world rectangle instead of inside the simulation.
    const visible = { x: 0, y: 0, width: 0, height: 0 };
    function step(dt) {
      input.updateMove();
      simulation.update(dt);
      const s = run.state;
      if (!s) return;
      visible.width = view.W || 960;
      visible.height = view.H || 640;
      const origin = cameraOrigin(s.p, visible.width, visible.height, world.arena.size);
      visible.x = origin.x;
      visible.y = origin.y;
      updateEnemySpeech(s, visible);
    }
    // The run advances in fixed steps (core/game-loop.js). Timers of play time (autosave,
    // tips and how long a tip shows) count the simulated time; the interface's own timers (HUD
    // refresh, the level-up lock, toasts, menu portraits) count real frame time, so they behave
    // the same while the simulation is paused or drops time on a stalled frame.
    const fixedStep = createFixedStep();
    function frame(now, frameDt) {
      // A hidden tab resumes with one long frame: interface timers move by at most a moment.
      const dt = Math.min(frameDt, 0.1);
      if (run.mode !== 'play') fixedStep.reset();
      else {
        const due = fixedStep.advance(frameDt);
        let played = 0;
        // A step can end the play mode (a level-up, the end of the run): this frame's other
        // steps are dropped, as time spent in a level-up is.
        for (let i = 0; i < due && run.mode === 'play'; i++) {
          step(STEP);
          played += STEP;
        }
        saveClock += played;
        if (saveClock >= SAVE_EVERY) {
          saveClock = 0;
          snapshots.save(run);
        }
        tipClock += played;
        if (tipClock >= 0.25) {
          tipClock = 0;
          tips.check();
        }
        if (run.tip.left > 0) run.tip.left -= played;
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
      progression.flush();
    }
    const read = { run, progression, settings, upgrades };

    return {
      // Engine API (tests, tools)
      start: flow.start,
      menu: flow.menu,
      pause: flow.pause,
      pickUpgrade: flow.pickUpgrade,
      resume: flow.resume,
      finish: flow.finish,
      continueProduction: flow.continueProduction,
      activateAbility,
      update: step,
      draw: renderer.draw,
      spawn: spawning.spawn,
      damage: combat.damage,
      upgrades,
      run() {
        if (disposed) return;
        input.enable();
        loop.run();
      },
      stop: () => loop.stop(),
      // Hidden behind another page (arena, bestiary): no frames and no key commands, music
      // continues.
      sleep() {
        input.disable();
        loop.stop(true);
      },
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
      // `emit` re-renders menus after the save was replaced from the cloud.
      ui: { subscribe: ui.subscribe, getVersion: ui.getVersion, emit: ui.emit },
      hud: { subscribe: hud.subscribe, getVersion: hud.getVersion },
      views: {
        run: () => run,
        menu: () => views.menuView({ ...read, snapshot: snapshots.load() }),
        heroSelect: () => views.heroSelectView(read),
        shop: () => views.shopView(read),
        achievements: () => views.achievementsView(read),
        encyclopedia: () => views.encyclopediaView(read),
        levelUp: () => views.levelUpView(read),
        build: () => views.buildView(read),
        levelControls: () => views.levelControlsView(read),
        hud: () => views.hudView(read),
        settings: () => views.settingsView({ run, settings, audio, runLog }),
        // Totals and records per map for «Моя статистика».
        runStats: () => progression.data.runStats,
      },
      commands: {
        openHeroSelect: flow.openHeroSelect,
        closeHeroSelect: flow.closeHeroSelect,
        chooseHero: flow.chooseHero,
        chooseBaClient: flow.chooseBaClient,
        chooseMap: flow.chooseMap,
        chooseLoad: flow.chooseLoad,
        chooseSeed: flow.chooseSeed,
        restartSameSeed: flow.restartSameSeed,
        continueProduction: flow.continueProduction,
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
        exportRunLog,
        clearRunLog,
        activateAbility,
        openShop: flow.openShop,
        openAchievements: flow.openAchievements,
        openEncyclopedia: flow.openEncyclopedia,
        backToMenu: flow.backToMenu,
        openSettings: flow.openSettings,
        closeSettings: flow.closeSettings,
        buyHero: flow.buyHero,
        buyUpgrade: flow.buyUpgrade,
        respec: flow.respec,
        claimAchievement: flow.claimAchievement,
        toggleSetting: flow.toggleSetting,
        toggleSound: audio.toggle,
        setVolume: audio.setVolume,
        attachPortrait,
      },
    };
  },
};
