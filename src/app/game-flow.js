import { createNodeState } from '../systems/node-objectives.js';
import { getWaveSchedule, createWaveState } from '../systems/wave-schedule.js';
import { permanentUpgradeDefinitions, levelUpControls } from '../../data/upgrades.js';
import { baClientIds } from '../../data/characters/ba-specialization.js';
import { arenaDefinitions } from '../world/arenas.js';
import { weaponDefinitions } from '../../data/weapons.js';
import { restoreRun } from '../systems/run-snapshot.js';

// Run lifecycle (start, pause, level-up, finish) and menu navigation. Only changes state:
// React reads `run` through the session's stores, `ui.emit()` / `hud.emit()` announce changes.
export const LEVEL_LOCK = 0.4;

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
      snapshots?.clear();
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
      weapons.init();
      run.state.heroWeaponName = hero.weapon;
      run.state.damageBy = {};
      run.state.upgradeRanks = {};
      run.state.banned = [];
      for (const key of levelUpControls) run.state[key] = 1 + (levels[key] || 0);
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
      run.tip = { text: '', left: 0 };
      setMode('play');
      const map = arenaDefinitions[run.selectedMap];
      toast(map.name.toUpperCase() + ' · ' + map.description);
      audio.effect('ui');
      changed();
    }
    function menu() {
      recordRun();
      snapshots?.clear();
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
        snapshots?.save(run);
      } else if (run.mode === 'pause') {
        setMode('play');
      } else return;
      if (run.screen === 'settings') run.screen = null;
      changed();
    }
    function offerCards() {
      run.choice = upgrades.offer(run.selected, run.state);
      run.banishArmed = false;
    }
    function levelUp() {
      const s = run.state;
      s.xp -= s.need;
      s.level++;
      s.need = Math.floor(s.need * 1.23 + 3);
      setMode('level');
      input.resetInput();
      // A short lock stops a held key or a stray tap from picking a card the player never saw.
      run.levelLock = LEVEL_LOCK;
      offerCards();
      audio.effect('level');
      changed();
    }
    function pickUpgrade(i) {
      if (run.mode !== 'level' || !run.choice[i]) return;
      if (run.banishArmed) return banish(i);
      upgrades.apply(run.choice[i], run.state);
      closeLevel();
    }
    function closeLevel() {
      run.banishArmed = false;
      setMode('play');
      audio.effect('ui');
      if (run.state.xp >= run.state.need) levelUp();
      else changed();
    }
    // Player input (keys 1-4, clicks) honours the opening lock; tools call pickUpgrade directly.
    function chooseCard(i) {
      if (run.levelLock > 0) return;
      pickUpgrade(i);
    }
    const levelReady = () => run.mode === 'level' && run.levelLock <= 0;
    // New cards for one reroll.
    function reroll() {
      if (!levelReady() || !(run.state.rerolls > 0)) return;
      run.state.rerolls--;
      offerCards();
      audio.effect('ui');
      ui.emit();
    }
    // Leave the level-up without taking anything.
    function skip() {
      if (!levelReady() || !(run.state.skips > 0)) return;
      run.state.skips--;
      closeLevel();
    }
    // Ban mode: the next card picked is removed from this run's offers.
    function armBanish() {
      if (!levelReady() || !(run.state.banishes > 0)) return;
      run.banishArmed = !run.banishArmed;
      ui.emit();
    }
    function banish(i) {
      const card = run.choice[i];
      if (!card?.max || !(run.state.banishes > 0)) {
        run.banishArmed = false;
        ui.emit();
        return;
      }
      run.state.banishes--;
      run.state.banned.push(card.id);
      offerCards();
      audio.effect('ui');
      ui.emit();
    }
    // Key rebinding: the settings screen arms an action, the next key press is taken.
    function startCapture(action) {
      run.capture = action;
      ui.emit();
    }
    function captureKey(code) {
      if (!run.capture) return false;
      if (code !== 'Escape') settings.bind(run.capture, code);
      run.capture = null;
      ui.emit();
      return true;
    }
    function resetBindings() {
      settings.resetBindings();
      ui.emit();
    }
    function setUiScale(value) {
      settings.setUiScale(value);
      ui.emit();
    }
    function finish(win) {
      const s = run.state;
      if (!s || s.resultRecorded) return;
      recordRun();
      snapshots?.clear();
      progression.flush();
      audio.finish(win);
      setMode('end');
      input.resetInput();
      const previousBest = { ...run.best };
      run.result = {
        win,
        tag: win ? arenaDefinitions[run.selectedMap].victoryTag : 'ЗАБЕГ ОКОНЧЕН',
        title: win ? 'Забег завершён' : 'Контур перегружен',
        text: win
          ? 'Шлюз ЦРПТ пройден. Можно начать новый забег или проверить улучшения.'
          : 'Попробуй другую сборку: другое оружие и пассивки меняют забег.',
        stats: [
          { value: math.clock(s.t), label: 'ВРЕМЯ', best: s.t > (previousBest.time || 0) },
          {
            value: String(s.kills),
            label: 'ПРОТИВНИКОВ ПОБЕЖДЕНО',
            best: s.kills > (previousBest.kills || 0),
          },
          { value: String(s.level), label: 'УРОВЕНЬ' },
          { value: '+' + s.earned, label: 'КОДОВ' },
        ],
        damage: damageReport(s),
        build: upgrades.build(run.selected, s),
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

    // Continues a saved run: a fresh start with the saved data put back, paused.
    function resume() {
      const snapshot = snapshots?.load();
      if (!snapshot || run.mode !== 'menu') return false;
      if (!heroes.defs[snapshot.hero] || !progression.owned(snapshot.hero)) {
        snapshots.clear();
        ui.emit();
        return false;
      }
      run.selected = run.pendingHero = snapshot.hero;
      if (arenaDefinitions[snapshot.map]) run.selectedMap = snapshot.map;
      world.select(run.selectedMap);
      if (snapshot.baClient) run.baClient = snapshot.baClient;
      start();
      restoreRun(run.state, snapshot, spawning.spawn);
      if (snapshot.pendingLevel) {
        setMode('level');
        run.levelLock = LEVEL_LOCK;
        offerCards();
        audio.effect('level');
      } else setMode('pause');
      snapshots.save(run);
      changed();
      return true;
    }

    // Damage per source, largest first, with display names.
    function damageReport(s) {
      const total = Object.values(s.damageBy || {}).reduce((sum, n) => sum + n, 0) || 1;
      return Object.entries(s.damageBy || {})
        .map(([tag, amount]) => ({
          tag,
          name: sourceName(tag),
          amount: Math.round(amount),
          share: Math.round((amount / total) * 100),
        }))
        .sort((a, b) => b.amount - a.amount);
    }
    function sourceName(tag) {
      if (tag === 'hero') return heroes.defs[run.selected].weapon;
      const ability = run.state.abilities?.find((a) => a.id === tag);
      if (ability) return `${ability.name} (${run.state.abilities.indexOf(ability) ? 'E' : 'Q'})`;
      const w = run.state.weapons?.find((item) => item.id === tag);
      const def = weaponDefinitions[tag];
      return def ? (w?.evolved ? def.evolution.name : def.name) : tag;
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
      chooseCard,
      resume,
      reroll,
      skip,
      armBanish,
      startCapture,
      captureKey,
      resetBindings,
      setUiScale,
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
