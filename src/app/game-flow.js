import { createNodeState } from '../systems/node-objectives.js';
import { getWaveSchedule, createWaveState } from '../systems/wave-schedule.js';
import { permanentUpgradeDefinitions } from '../../data/upgrades.js';
import { baClientIds } from '../../data/characters/ba-specialization.js';
import { arenaDefinitions } from '../world/arenas.js';

// Run lifecycle (start, pause, level-up, finish) and menu navigation. Only changes state:
// React reads `run` through the session's stores, `ui.emit()` / `hud.emit()` announce changes.
export const GameFlow = {
  create({
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
  }) {
    function setMode(mode) {
      run.mode = mode;
      audio.sync();
    }
    function changed() {
      ui.emit();
      hud.emit();
    }
    function recordRun() {
      const s = run.state;
      if (!s || s.resultRecorded) return;
      progression.recordTime(s.t);
      progression.recordLevel(s.level);
      s.resultRecorded = true;
    }
    function start() {
      recordRun();
      if (!progression.owned(run.selected)) run.selected = 'utrace';
      const hero = heroes.defs[run.selected],
        levels = progression.data.levels,
        health = hero.hp + levels.health * permanentUpgradeDefinitions.health.factor;
      input.resetInput();
      run.state = {
        t: 0,
        map: run.selectedMap,
        ...createWaveState(getWaveSchedule(run.selectedMap)),
        kills: 0,
        level: 1,
        xp: 0,
        need: 8,
        attack: 0.2,
        enemies: [],
        nodes: createNodeState(),
        corpses: [],
        enemyShots: [],
        shots: [],
        codes: [],
        earned: 0,
        gems: [],
        fx: [],
        texts: [],
        pickups: [],
        bossDead: false,
        shake: 0,
        step: 0,
        stats: {
          damage: 1 + levels.power * permanentUpgradeDefinitions.power.factor,
          haste: 1,
          range: 1,
          speed: 1 + levels.speed * permanentUpgradeDefinitions.speed.factor,
          magnet: 75,
          armor: 0,
          regen: 0,
        },
        p: {
          x: world.arena.size / 2,
          y: world.arena.size / 2,
          hp: health,
          max: health,
          speed: hero.speed,
          inv: 0,
          flip: false,
          facing: { x: 1, y: 0 },
        },
      };
      abilities.init();
      if (run.selected === 'ba')
        run.state.baSpecialization = {
          client: baClientIds.includes(run.baClient) ? run.baClient : baClientIds[0],
          bonus: 0,
        };
      upgrades.permanent(run.state, run.selected, levels);
      world.arena.prepare(
        Object.values(enemies.units).map((unit) => unit.r),
        run.state.p,
      );
      run.screen = null;
      run.result = null;
      setMode('play');
      const map = arenaDefinitions[run.selectedMap];
      toast(map.name.toUpperCase() + ' · ' + map.description);
      audio.effect('ui');
      changed();
    }
    function menu() {
      recordRun();
      progression.flush();
      setMode('menu');
      run.state = null;
      run.screen = 'menu';
      run.toast = { text: '', left: 0 };
      input.resetInput();
      changed();
    }
    function pause() {
      if (run.mode === 'play') {
        progression.flush();
        setMode('pause');
        input.resetInput();
      } else if (run.mode === 'pause') {
        setMode('play');
      } else return;
      if (run.screen === 'settings') run.screen = null;
      changed();
    }
    function levelUp() {
      const s = run.state;
      s.xp -= s.need;
      s.level++;
      s.need = Math.floor(s.need * 1.23 + 3);
      setMode('level');
      input.resetInput();
      run.choice = upgrades.offer(run.selected, s);
      audio.effect('level');
      changed();
    }
    function pickUpgrade(i) {
      if (run.mode !== 'level' || !run.choice[i]) return;
      upgrades.apply(run.choice[i], run.state);
      setMode('play');
      audio.effect('ui');
      if (run.state.xp >= run.state.need) levelUp();
      else changed();
    }
    function finish(win) {
      const s = run.state;
      if (!s || s.resultRecorded) return;
      recordRun();
      progression.flush();
      audio.finish(win);
      setMode('end');
      input.resetInput();
      run.result = {
        tag: win ? arenaDefinitions[run.selectedMap].victoryTag : 'ЗАБЕГ ОКОНЧЕН',
        title: win ? 'Забег завершён' : 'Попробовать ещё раз?',
        text: win
          ? 'Отличный результат. Можно начать новый забег или проверить улучшения.'
          : 'Даже героям нужен привал. Попробуй другую сборку и вернись в игру.',
        stats: [
          { value: math.clock(s.t), label: 'ВРЕМЯ' },
          { value: String(s.kills), label: 'ПРОТИВНИКОВ ПОБЕЖДЕНО' },
          { value: String(s.level), label: 'УРОВЕНЬ' },
          { value: '+' + s.earned, label: 'ЖЕТОНОВ' },
        ],
      };
      run.best = {
        kills: Math.max(run.best.kills || 0, s.kills),
        time: Math.max(run.best.time || 0, s.t),
      };
      try {
        storage.setItem('utreys-best', JSON.stringify(run.best));
      } catch {}
      changed();
    }

    // Menu screens. Each returns nothing and announces the change.
    function show(screen) {
      run.screen = screen;
      ui.emit();
    }
    function openHeroSelect() {
      if (run.mode !== 'menu') return;
      const owned = Object.keys(heroes.defs).filter((id) => progression.owned(id));
      if (!owned.length) throw new Error('Нет доступных героев для нового забега');
      run.pendingHero = owned.includes(run.selected) ? run.selected : owned[0];
      if (!baClientIds.includes(run.baClient)) run.baClient = baClientIds[0];
      show('heroSelect');
    }
    function chooseHero(id) {
      if (!progression.owned(id)) return;
      run.pendingHero = id;
      ui.emit();
    }
    function chooseBaClient(id) {
      run.baClient = id;
      ui.emit();
    }
    function chooseMap(id) {
      if (!arenaDefinitions[id]) return;
      run.selectedMap = id;
      world.select(id);
      ui.emit();
    }
    function startSelected() {
      run.selected = run.pendingHero;
      start();
    }
    function openMenuScreen(screen) {
      if (run.mode === 'menu') show(screen);
    }
    function openSettings(origin) {
      run.settingsOrigin = origin;
      show('settings');
    }
    function closeSettings() {
      show(run.settingsOrigin === 'menu' ? 'menu' : null);
    }
    // Escape: close the open screen; false means nothing was open (the caller may pause).
    function closeScreen() {
      if (run.screen === 'settings') {
        closeSettings();
        return true;
      }
      if (run.mode === 'menu' && run.screen && run.screen !== 'menu') {
        show('menu');
        return true;
      }
      return false;
    }
    function buyHero(id) {
      if (!progression.owned(id) && progression.buyHero(id)) ui.emit();
    }
    function buyUpgrade(id) {
      if (progression.buyUpgrade(id)) ui.emit();
    }
    function claimAchievement(id) {
      if (progression.claimAchievement(id, run.best)) {
        audio.effect('pickup');
        ui.emit();
      }
    }
    function toggleSetting(key) {
      settings.toggle(key);
      audio.effect('ui');
      changed();
    }
    return {
      start,
      menu,
      pause,
      levelUp,
      pickUpgrade,
      finish,
      openHeroSelect,
      closeHeroSelect: () => show('menu'),
      chooseHero,
      chooseBaClient,
      chooseMap,
      startSelected,
      openShop: () => openMenuScreen('shop'),
      openAchievements: () => openMenuScreen('achievements'),
      backToMenu: () => show('menu'),
      openSettings,
      closeSettings,
      closeScreen,
      buyHero,
      buyUpgrade,
      claimAchievement,
      toggleSetting,
    };
  },
};
