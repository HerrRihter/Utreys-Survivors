import { createEventScope } from '../core/lifecycle.js';
import { createArenas } from '../world/arenas.js';
import { currentLayout } from '../systems/queries/learning.js';
import { mapDefinitions } from '../../data/maps/maps.js';
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
import { Simulation } from '../systems/simulation.js';
import { updateEnemySpeech } from '../systems/enemy-speech.js';
import { createRunLog } from '../systems/run-log.js';
import { UpgradeSystem } from '../systems/upgrades.js';
import { createCorpses } from '../systems/corpses.js';
import { createCorpseRenderer } from '../rendering/corpses.js';
import { createEnemyRenderer } from '../rendering/enemies.js';
import { createRunSnapshots } from '../systems/run-snapshot.js';
import { createTips } from './tips.js';
import { createRunSystems } from './run-systems.js';
import { createFrameTimers } from './frame-timers.js';
import { createPortraits } from './portraits.js';
import { createRunLogFile } from './run-log-file.js';
import { createSessionViews } from './session-views.js';
import { createSessionCommands } from './session-commands.js';

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
    devTools = false,
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
    const run = createRunState();
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
      // The arena a run plays in: its map's, or the generated room of the learning map.
      follow(s) {
        const layout = currentLayout(s);
        this.arena = layout
          ? arenas.forRoom(s.map, `${s.map}:${s.seed}:${s.learning.roomIndex}`, layout.walls)
          : arenas.get(s.map);
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

    const { combat, weapons, abilities, spawning, runEvents } = createRunSystems({
      run,
      world,
      corpses,
      progression,
      audio,
      cosmetic,
      toast,
      settings,
    });
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
      spawning,
      snapshots,
      runLog,
      audio,
      input,
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
      events: {
        finish: flow.resolveOutcome,
        levelUp: flow.levelUp,
        openBundle: flow.openBundle,
        toast,
      },
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
    const portraits = createPortraits({ document, sprite });
    const timers = createFrameTimers({ run, ui, hud, snapshots, tips });

    // One simulation step reads the movement intent the input layer combines right before it.
    // Speech is cosmetic and picks among enemies on screen, so it runs here with the camera's
    // world rectangle instead of inside the simulation.
    const visible = { x: 0, y: 0, width: 0, height: 0 };
    function step(dt) {
      // A quiz stops the fight; tools calling update() directly are held too.
      if (run.mode === 'quiz') return;
      input.updateMove();
      simulation.update(dt);
      const s = run.state;
      if (!s) return;
      visible.width = view.W || 960;
      visible.height = view.H || 640;
      const origin = cameraOrigin(
        s.p,
        visible.width,
        visible.height,
        world.arena.size,
        world.arena.rooms,
      );
      visible.x = origin.x;
      visible.y = origin.y;
      updateEnemySpeech(s, visible);
    }
    // The run advances in fixed steps (core/game-loop.js); frame-timers.js keeps the timers
    // of play time and of the interface apart.
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
        timers.played(played);
      }
      if (run.mode === 'menu') portraits.animate(now);
      timers.frame(dt);
      renderer.draw();
    }
    const loop = GameLoop.create({ requestAnimationFrame, cancelAnimationFrame, frame, audio });
    input.bind();
    // Closing or hiding the tab keeps the run for "Continue".
    const keepRun = () => {
      if (run.state && ['play', 'pause', 'level', 'quiz'].includes(run.mode)) snapshots.save(run);
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
        if (!mapDefinitions[id]) throw new Error('Unknown map: ' + id);
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
      views: createSessionViews({
        run,
        progression,
        settings,
        upgrades,
        snapshots,
        audio,
        runLog,
        devTools,
      }),
      commands: createSessionCommands({
        flow,
        audio,
        runLogFile: createRunLogFile({ window, document, runLog, ui }),
        activateAbility,
        portraits,
      }),
    };
  },
};
