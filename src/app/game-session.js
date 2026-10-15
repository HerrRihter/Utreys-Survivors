import { createEventScope } from '../core/lifecycle.js';
import { createArenas, arenaDefinitions } from '../world/arenas.js';
import { createMath } from '../core/math.js';
import { CanvasSystem } from '../rendering/canvas.js';
import { SpriteRenderer } from '../rendering/sprite-renderer.js';
import { GameUI } from '../ui/game-ui.js';
import { AudioSystem } from '../core/audio.js';
import { InputSystem } from '../core/input.js';
import { GameFlow } from './game-flow.js';
import { EnemySpawning } from '../systems/enemy-spawning.js';
import { CombatSystem } from '../systems/combat.js';
import { Simulation } from '../systems/simulation.js';
import { SceneRenderer } from '../rendering/scene-renderer.js';
import { AbilitySystem } from '../systems/abilities.js';
import { GameLoop } from '../core/game-loop.js';
export let GameSession;
('use strict');
GameSession = {
  create({
    document,
    window,
    localStorage,
    performance,
    requestAnimationFrame,
    cancelAnimationFrame,
    Math,
    Villagers,
    Progression,
    UpgradeSystem: UpgradeSystemFactory,
    Legion,
    Corpses,
    MenuPortraits,
  }) {
    const events = createEventScope();
    let disposed = false;
    const UpgradeSystem = UpgradeSystemFactory.create(Progression);
    const arenas = createArenas();
    let selectedMap = 'empty';
    let audioController = null;
    const sessionContext = {
      get abilities() {
        return abilities;
      },
      get selectedMap() {
        return selectedMap;
      },
      get arenaDefinitions() {
        return arenaDefinitions;
      },
      get document() {
        return document;
      },
      get window() {
        return window;
      },
      get localStorage() {
        return localStorage;
      },
      get performance() {
        return performance;
      },
      get requestAnimationFrame() {
        return requestAnimationFrame;
      },
      get cancelAnimationFrame() {
        return cancelAnimationFrame;
      },
      get Math() {
        return Math;
      },
      get Villagers() {
        return Villagers;
      },
      get Progression() {
        return Progression;
      },
      get UpgradeSystem() {
        return UpgradeSystem;
      },
      get Village() {
        return arenas.get(selectedMap);
      },
      get Legion() {
        return Legion;
      },
      get Corpses() {
        return Corpses;
      },
      get MenuPortraits() {
        return MenuPortraits;
      },
      get $() {
        return $;
      },
      get canvas() {
        return canvas;
      },
      get ctx() {
        return ctx;
      },
      get W() {
        return W;
      },
      set W(value) {
        W = value;
      },
      get H() {
        return H;
      },
      set H(value) {
        H = value;
      },
      get WORLD() {
        return arenas.get(selectedMap).size;
      },
      get resizeCanvas() {
        return resizeCanvas;
      },
      get selected() {
        return selected;
      },
      set selected(value) {
        selected = value;
      },
      get mode() {
        return mode;
      },
      set mode(value) {
        mode = value;
        if (document?.body) document.body.dataset.mode = value;
        audioController?.sync();
      },
      get state() {
        return state;
      },
      set state(value) {
        state = value;
      },
      get keys() {
        return keys;
      },
      set keys(value) {
        keys = value;
      },
      get toastLeft() {
        return toastLeft;
      },
      set toastLeft(value) {
        toastLeft = value;
      },
      get choice() {
        return choice;
      },
      set choice(value) {
        choice = value;
      },
      get pointer() {
        return pointer;
      },
      set pointer(value) {
        pointer = value;
      },
      get stick() {
        return stick;
      },
      set stick(value) {
        stick = value;
      },
      get best() {
        return best;
      },
      set best(value) {
        best = value;
      },
      get rand() {
        return rand;
      },
      get clamp() {
        return clamp;
      },
      get dist() {
        return dist;
      },
      get clock() {
        return clock;
      },
      get sprite() {
        return sprite;
      },
      get portraits() {
        return portraits;
      },
      get fitPortrait() {
        return fitPortrait;
      },
      get menuPortraitPhase() {
        return menuPortraitPhase;
      },
      set menuPortraitPhase(value) {
        menuPortraitPhase = value;
      },
      get animateMenu() {
        return animateMenu;
      },
      get soundEffect() {
        return audioController.effect;
      },
      get finishAudio() {
        return audioController.finish;
      },
      get stopAudio() {
        return audioController.stop;
      },
      get resumeAudio() {
        return audioController.resume;
      },
      get show() {
        return show;
      },
      get toast() {
        return toast;
      },
      get resetInput() {
        return resetInput;
      },
      get start() {
        return start;
      },
      get menu() {
        return menu;
      },
      get updateRecord() {
        return updateRecord;
      },
      get pendingRunHero() {
        return pendingRunHero;
      },
      set pendingRunHero(value) {
        pendingRunHero = value;
      },
      get updateRunHeroStats() {
        return updateRunHeroStats;
      },
      get renderRunHeroes() {
        return renderRunHeroes;
      },
      get openRunHeroSelect() {
        return openRunHeroSelect;
      },
      get renderShop() {
        return renderShop;
      },
      get closeShop() {
        return closeShop;
      },
      get renderAchievements() {
        return renderAchievements;
      },
      get openAchievements() {
        return openAchievements;
      },
      get closeAchievements() {
        return closeAchievements;
      },
      get openSettings() {
        return openSettings;
      },
      get closeSettings() {
        return closeSettings;
      },
      get gameSettings() {
        return gameSettings;
      },
      get pause() {
        return pause;
      },
      get levelUp() {
        return levelUp;
      },
      get pickUpgrade() {
        return pickUpgrade;
      },
      get spawn() {
        return spawn;
      },
      get updateSpawning() {
        return updateSpawning;
      },
      get damage() {
        return damage;
      },
      get throwStones() {
        return throwStones;
      },
      get beginAction() {
        return beginAction;
      },
      get advanceAction() {
        return advanceAction;
      },
      get hurtPlayer() {
        return hurtPlayer;
      },
      get heroImpact() {
        return heroImpact;
      },
      get finish() {
        return finish;
      },
      get update() {
        return update;
      },
      get hud() {
        return hud;
      },
      get background() {
        return background;
      },
      get draw() {
        return draw;
      },
      get run() {
        return run;
      },
      get stop() {
        return stop;
      },
    };

    const $ = (id) => document.getElementById(id),
      canvas = $('game'),
      ctx = canvas.getContext('2d');
    let W = 960,
      H = 540;
    const { resizeCanvas } = CanvasSystem.create(sessionContext);
    resizeCanvas();
    events.listen(window, 'resize', resizeCanvas);
    let selected = 'utrace',
      mode = 'menu',
      state = null,
      keys = new Set(),
      toastLeft = 0,
      choice = [];
    if (document?.body) document.body.dataset.mode = mode;
    let pointer = null,
      stick = { x: 0, y: 0 },
      best = { kills: 0, time: 0 };
    try {
      best = JSON.parse(localStorage.getItem('utreys-best')) || best;
    } catch {}
    const { rand, clamp, dist, clock } = createMath(Math);
    const { sprite } = SpriteRenderer.create(sessionContext);

    const portraits = MenuPortraits.create({
      document,
      sprite,
      artStatus() {
        return 'canvas-v1';
      },
    });
    const fitPortrait = portraits.fit;
    let menuPortraitPhase = -1;
    const {
      animateMenu,
      show,
      toast,
      updateRecord,
      updateRunHeroStats,
      renderRunHeroes,
      openRunHeroSelect,
      renderShop,
      closeShop,
      renderAchievements,
      openAchievements,
      closeAchievements,
      openSettings,
      closeSettings,
      gameSettings,
      hud,
    } = GameUI.create(sessionContext);

    audioController = AudioSystem.create(sessionContext);

    const abilities = AbilitySystem.create(sessionContext);
    const input = InputSystem.create(sessionContext);
    const { resetInput, bind: bindInput } = input;
    const { start, menu, pause, levelUp, pickUpgrade, finish } = GameFlow.create(sessionContext);

    updateRecord();
    ['runHeroSelect', 'shop', 'achievements', 'settings'].forEach((id) => show(id, false));
    let pendingRunHero = selected;

    const mapSelect = $('runMap');
    if (mapSelect) {
      mapSelect.innerHTML = Object.entries(arenaDefinitions)
        .map(([id, map]) => `<option value="${id}">${map.name}</option>`)
        .join('');
      mapSelect.value = selectedMap;
    }
    if (mapSelect)
      mapSelect.onchange = () => {
        selectedMap = arenaDefinitions[mapSelect.value] ? mapSelect.value : 'empty';
        $('mapDescription').textContent = arenaDefinitions[selectedMap].description;
      };
    const startBtn = $('start');
    if (startBtn) startBtn.onclick = openRunHeroSelect;
    const runHeroBackBtn = $('runHeroBack');
    if (runHeroBackBtn)
      runHeroBackBtn.onclick = () => {
        show('runHeroSelect', false);
        show('menu', true);
      };
    const runHeroStartBtn = $('runHeroStart');
    if (runHeroStartBtn)
      runHeroStartBtn.onclick = () => {
        selected = pendingRunHero;
        start();
      };
    const againBtn = $('again');
    if (againBtn) againBtn.onclick = start;
    const backBtn = $('back');
    if (backBtn) backBtn.onclick = menu;
    const quitBtn = $('quit');
    if (quitBtn) quitBtn.onclick = menu;

    const shopOpenBtn = $('shopOpen');
    if (shopOpenBtn)
      shopOpenBtn.onclick = () => {
        if (mode !== 'menu') return;
        renderShop();
        show('menu', false);
        show('shop', true);
      };

    const shopCloseBtn = $('shopClose');
    if (shopCloseBtn) shopCloseBtn.onclick = closeShop;

    const achOpen = $('achievementsOpen'),
      achClose = $('achievementsClose');
    if (achOpen)
      achOpen.onclick = () => {
        if (mode !== 'menu') return;
        openAchievements();
      };
    if (achClose) achClose.onclick = closeAchievements;

    const setOpen = $('settingsOpen'),
      pauseSetOpen = $('pauseSettings'),
      setClose = $('settingsClose'),
      setBack = $('settingsBack');
    if (setOpen)
      setOpen.onclick = () => {
        if (mode === 'menu') openSettings('menu');
      };
    if (pauseSetOpen) pauseSetOpen.onclick = () => openSettings('paused');
    if (setClose) setClose.onclick = closeSettings;
    if (setBack) setBack.onclick = closeSettings;

    const pauseBtn = $('pause');
    if (pauseBtn) pauseBtn.onclick = pause;
    const resumeBtn = $('resume');
    if (resumeBtn) resumeBtn.onclick = pause;
    bindInput();

    const { spawn, updateSpawning } = EnemySpawning.create(sessionContext);
    const { damage, throwStones, beginAction, advanceAction, hurtPlayer, heroImpact } =
      CombatSystem.create(sessionContext);

    const { update } = Simulation.create(sessionContext);

    const { background, draw } = SceneRenderer.create(sessionContext);

    // Scheduling is explicit; tests can advance simulation without a browser loop.
    const loop = GameLoop.create(sessionContext);
    const { stop } = loop;
    function run() {
      if (!disposed) loop.run();
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      input.dispose();
      audioController.dispose();
      events.dispose();
      Progression.flush?.();
      for (const id of [
        'runMap',
        'start',
        'runHeroBack',
        'runHeroStart',
        'again',
        'back',
        'quit',
        'shopOpen',
        'shopClose',
        'achievementsOpen',
        'achievementsClose',
        'settingsOpen',
        'pauseSettings',
        'settingsClose',
        'settingsBack',
        'settingShake',
        'settingHints',
        'pause',
        'resume',
        'ability0',
        'ability1',
        'sound',
        'settingsSound',
        'pauseSound',
        'musicVolume',
        'effectsVolume',
      ]) {
        const element = $(id);
        if (element) {
          element.onclick = null;
          element.onchange = null;
          element.oninput = null;
        }
      }
    }

    return {
      start,
      activateAbility: abilities.activate,
      upgrades: UpgradeSystem,
      update,
      draw,
      pause,
      pickUpgrade,
      spawn,
      damage,
      finish,
      menu,
      run,
      stop,
      dispose,
      keys,
      get state() {
        return state;
      },
      get mode() {
        return mode;
      },
      get running() {
        return loop.running;
      },
      selectMap(id) {
        if (!arenaDefinitions[id]) throw new Error('Unknown map: ' + id);
        selectedMap = id;
        if (mapSelect) mapSelect.value = id;
      },
      select(hero) {
        selected = hero;
      },
    };
  },
};
