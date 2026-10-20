import { unitDefinitions } from '../../data/enemies/units.js';
import { heroDefinitions } from '../../data/characters/heroes.js';
import { mapDefinitions } from '../../data/maps/maps.js';
import { maxLoad, rewardPerLevel, production } from '../../data/difficulty.js';
import { getWaveSchedule } from '../systems/wave-schedule.js';
import { createRunModel } from '../systems/run-model.js';
import { restoreRun } from '../systems/run-snapshot.js';
import { randomSeed, parseSeed } from '../core/rng.js';
import { createRunRecording } from './run-recording.js';
import { clampLoad, mapOpen } from './selection.js';
import { resultView } from './views/result.js';
import { codes } from './views/format.js';

// A run from start to its ending: start, menu, pause, finish, the production continuation,
// update bundles and resuming a saved run. Level-up screens belong to `levels` (level-up.js).
export function createRunLifecycle({
  run,
  progression,
  upgrades,
  world,
  spawning,
  snapshots,
  runLog,
  audio,
  input,
  toast,
  hud,
  ui,
  levels,
  setMode,
  changed,
}) {
  const { wallet, shop, achievements, loads } = progression;
  const { countRun, recordRun } = createRunRecording({ run, progression, upgrades, runLog });
  function start() {
    recordRun();
    countRun();
    snapshots?.clear();
    if (!shop.owned(run.selected)) run.selected = 'utrace';
    if (!mapOpen(progression, run.selectedMap)) {
      run.selectedMap = 'empty';
      world.select('empty');
    }
    // The seed fixes the node layout, bug placement and event order of this run.
    const seed = run.nextSeed ?? randomSeed();
    run.nextSeed = null;
    const schedule = getWaveSchedule(run.selectedMap);
    const levels = progression.data.levels;
    input.resetInput();
    const load = clampLoad(loads, run.selected, run.selectedLoad);
    run.selectedLoad = load;
    run.state = createRunModel({
      hero: run.selected,
      heroDef: heroDefinitions[run.selected],
      levels,
      load,
      seed,
      runId: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      map: run.selectedMap,
      schedule,
      arenaSize: world.arena.size,
      baClient: run.baClient,
      doneBefore: achievements.list.filter((a) => achievements.achievementDone(a)).map((a) => a.id),
    });
    world.arena.prepare(
      Object.values(unitDefinitions).map((unit) => unit.r),
      run.state.p,
    );
    run.screen = null;
    run.result = null;
    run.tip = { text: '', left: 0 };
    setMode('play');
    const map = mapDefinitions[run.selectedMap];
    toast(map.name.toUpperCase() + ' · ' + map.description);
    audio.effect('ui');
    changed();
  }
  // From the hero select: the pending hero with the typed seed, if any.
  function startSelected() {
    run.selected = run.pendingHero;
    run.nextSeed = parseSeed(run.seedInput);
    start();
  }
  // Same layout and events again: restart with the finished run's seed.
  function restartSameSeed() {
    if (!run.state) return;
    run.nextSeed = run.state.seed;
    start();
  }
  function menu() {
    recordRun();
    countRun();
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
  function finish(win) {
    const s = run.state;
    if (!s || s.resultRecorded) return;
    const endless = !!s.endless;
    // The records before this ending, for the «record» marks on the results screen.
    const { maxTime, maxKills } = progression.data.stats;
    const productionBest = recordRun(win && !endless) || { time: false, kills: false };
    // A first win on the load level opens the next one; higher levels pay more codes.
    let opened = false,
      bonus = 0;
    if (win && !endless) {
      opened = loads.recordLoadWin(run.selected, s.load) && s.load < maxLoad;
      bonus = wallet.earn(Math.floor(s.earned * rewardPerLevel * (s.load - 1)));
      s.earned += bonus;
    }
    // Greed: a share of the codes earned since the last ending.
    const greed = wallet.earn(Math.floor((s.earned - s.earnedPaid) * (s.stats.greed || 0)));
    s.earned += greed;
    s.earnedPaid = s.earned;
    // After the bonuses: the codes of this ending are final.
    s.recordsImproved = countRun(win && !endless);
    snapshots?.clear();
    progression.flush();
    audio.finish(win);
    setMode('end');
    input.resetInput();
    run.result = resultView({
      s,
      hero: run.selected,
      map: mapDefinitions[run.selectedMap],
      win,
      opened,
      bonus,
      productionBest,
      before: { maxTime, maxKills },
      progression,
      upgrades,
    });
    changed();
  }

  // An update bundle from an elite or an event: one to three item upgrades without a choice,
  // owned items first, then anything the level-up could offer.
  function openBundle() {
    const s = run.state;
    if (!s) return [];
    const count = 1 + Math.floor(s.rng.random() * 3),
      names = [];
    for (let i = 0; i < count; i++) {
      const pool = upgrades.pool(run.selected, s).filter((u) => u.max);
      const owned = pool.filter((u) => !u.isNew && u.kind !== 'ability');
      const list = owned.length ? owned : pool;
      if (!list.length) break;
      const card = list[Math.floor(s.rng.random() * list.length)];
      if (upgrades.apply(card, s)) names.push(card.name);
    }
    if (!names.length) {
      s.earned += wallet.earn(10);
      names.push('+' + codes(10));
    }
    s.fx.push({
      kind: 'ring',
      x: s.p.x,
      y: s.p.y - 10,
      r: 90,
      life: 0.7,
      max: 0.7,
      color: '#ffd54f',
    });
    names.forEach((name, i) =>
      s.texts.push({ x: s.p.x, y: s.p.y - 50 - i * 16, v: '▲ ' + name, life: 1.6 }),
    );
    toast('Пакет обновлений: ' + names.join(', '));
    audio.effect('level');
    hud.emit();
    return names;
  }

  // After a win: keep playing the same run in the endless production mode.
  function continueProduction() {
    const s = run.state;
    if (run.mode !== 'end' || !run.result?.canContinue || !s || s.endless) return false;
    s.endless = true;
    s.endlessStart = s.t;
    s.endlessKills = s.kills;
    s.productionBossNext = s.t + production.bossEvery;
    s.productionBosses = 0;
    s.bossDead = false;
    s.resultRecorded = false;
    run.result = null;
    input.resetInput();
    setMode('play');
    toast('ПРОДАКШЕН: нагрузка растёт каждую минуту, усиленный ЦРПТ — каждые 5 минут');
    changed();
    return true;
  }

  // Continues a saved run: a fresh start with the saved data put back, paused.
  function resume() {
    const snapshot = snapshots?.load();
    if (!snapshot || run.mode !== 'menu') return false;
    if (!heroDefinitions[snapshot.hero] || !shop.owned(snapshot.hero)) {
      snapshots.clear();
      ui.emit();
      return false;
    }
    run.selected = run.pendingHero = snapshot.hero;
    if (mapDefinitions[snapshot.map]) run.selectedMap = snapshot.map;
    world.select(run.selectedMap);
    if (snapshot.baClient) run.baClient = snapshot.baClient;
    run.selectedLoad = snapshot.state.load || 1;
    run.nextSeed = snapshot.state.seed ?? null;
    start();
    restoreRun(run.state, snapshot, spawning.spawn);
    if (snapshot.pendingLevel) levels.reopen(snapshot.choice);
    else setMode('pause');
    snapshots.save(run);
    changed();
    return true;
  }

  return {
    start,
    startSelected,
    restartSameSeed,
    menu,
    pause,
    finish,
    openBundle,
    continueProduction,
    resume,
  };
}
