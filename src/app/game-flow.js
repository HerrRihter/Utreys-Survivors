import { unitDefinitions } from '../../data/enemies/units.js';
import { heroDefinitions } from '../../data/characters/heroes.js';
import { getWaveSchedule } from '../systems/wave-schedule.js';
import { createRunModel } from '../systems/run-model.js';
import { baClientIds } from '../../data/characters/ba-specialization.js';
import { arenaDefinitions } from '../world/arenas.js';
import { mapUnlocked } from '../../data/maps/maps.js';
import { weaponDefinitions } from '../../data/weapons.js';
import { restoreRun } from '../systems/run-snapshot.js';
import { nearestGoals, newlyDone } from './unlocks.js';
import { clock } from './views.js';
import { randomSeed, parseSeed, seedText } from '../core/rng.js';
import { logOffer, logReoffer, logChoice, logEntry } from '../systems/run-log.js';
import { maxLoad, rewardPerLevel, production } from '../../data/difficulty.js';

// Run lifecycle (start, pause, level-up, finish) and menu navigation. Only changes state:
// React reads `run` through the session's stores, `ui.emit()` / `hud.emit()` announce changes.
export const LEVEL_LOCK = 0.4;

export const GameFlow = {
  create({
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
  }) {
    const { wallet, shop, records, achievements, loads } = progression;
    function setMode(mode) {
      run.mode = mode;
      audio.sync();
    }
    function changed() {
      ui.emit();
      hud.emit();
    }
    // Run statistics (src/systems/run-records.js): every ending adds what is new since the
    // previous ending of the same run. Win, death, quitting to the menu and restarting all end
    // a run; a run continued in production ends again later. `victory` only from finish().
    function countRun(victory = false) {
      const s = run.state;
      if (!s?.runId) return null;
      const counted = s.statsCounted ?? { kills: 0, codes: 0 };
      const improved = records.recordRunResult({
        runId: s.runId,
        map: s.map,
        hero: run.selected,
        load: s.load,
        newGame: !s.statsCounted,
        addKills: s.kills - counted.kills,
        addCodes: s.earned - counted.codes,
        time: s.t,
        kills: s.kills,
        codes: s.earned,
        victory,
        production: s.endless ? s.t - s.endlessStart : 0,
      });
      if (improved) s.statsCounted = { kills: s.kills, codes: s.earned };
      return improved;
    }
    // Time, level and the production record; once per ending (a continued run records again).
    // Mastery stats are recorded once per run, at its first ending.
    function recordRun(win = false) {
      const s = run.state;
      if (!s || s.resultRecorded) return null;
      records.recordTime(s.t, s.recordedTime);
      records.recordLevel(s.level);
      s.resultRecorded = true;
      s.recordedTime = s.t;
      // Evolutions assembled in this run open their encyclopedia entries.
      for (const w of s.weapons) if (w.evolved) records.recordEvolution(w.id);
      if (s.stats.heroEvo) records.recordEvolution('hero_' + run.selected);
      // The run journal: one entry per ending, with the offers made since the previous one.
      const offers = s.offers;
      runLog?.record(
        logEntry({
          s: { ...s, offers: offers.slice(s.offersLogged) },
          hero: run.selected,
          win,
          build: upgrades.build(run.selected, s),
        }),
      );
      s.offersLogged = offers.length;
      if (!s.statsRecorded) {
        s.statsRecorded = true;
        const nodesMap = !arenaDefinitions[s.map]?.objective;
        records.recordRunStats({
          win,
          hero: run.selected,
          map: s.map,
          time: s.t,
          untouched: (s.firstHurtAt ?? s.t) >= 180,
          // Sweeps are about the five component nodes; desks are always destroyed.
          cleanSweep: nodesMap && s.nodes.every((n) => n.status === 'destroyed'),
          allWorkaround: nodesMap && s.nodes.every((n) => n.status === 'workaround'),
          noFood: !s.foodTaken,
          evolutions: s.evolutions + (s.stats.heroEvo ? 1 : 0),
        });
      }
      if (!s.endless) return null;
      return loads.recordProduction(
        run.selected,
        s.load,
        s.t - s.endlessStart,
        s.kills - s.endlessKills,
      );
    }
    const clampLoad = (hero, level) =>
      Math.max(1, Math.min(loads.loadAvailable(hero), Math.floor(level) || 1));
    const mapOpen = (id) =>
      Object.hasOwn(arenaDefinitions, id) &&
      mapUnlocked(arenaDefinitions[id], progression.data.stats);
    function start() {
      recordRun();
      countRun();
      snapshots?.clear();
      if (!shop.owned(run.selected)) run.selected = 'utrace';
      if (!mapOpen(run.selectedMap)) {
        run.selectedMap = 'empty';
        world.select('empty');
      }
      // The seed fixes the node layout, bug placement and event order of this run.
      const seed = run.nextSeed ?? randomSeed();
      run.nextSeed = null;
      const schedule = getWaveSchedule(run.selectedMap);
      const levels = progression.data.levels;
      input.resetInput();
      const load = clampLoad(run.selected, run.selectedLoad);
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
        doneBefore: achievements.list
          .filter((a) => achievements.achievementDone(a, run.best))
          .map((a) => a.id),
      });
      world.arena.prepare(
        Object.values(unitDefinitions).map((unit) => unit.r),
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
    // `change` marks the same level-up showing new cards: { reroll } or { banned: id }.
    function offerCards(change = null) {
      run.choice = upgrades.offer(run.selected, run.state);
      run.banishArmed = false;
      if (change) logReoffer(run.state, run.choice, change);
      else logOffer(run.state, run.choice);
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
      logChoice(run.state, run.choice[i].id, 'pick');
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
      offerCards({ reroll: true });
      audio.effect('ui');
      ui.emit();
    }
    // Leave the level-up without taking anything.
    function skip() {
      if (!levelReady() || !(run.state.skips > 0)) return;
      run.state.skips--;
      logChoice(run.state, null, 'skip');
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
      offerCards({ banned: card.id });
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
      const endless = !!s.endless;
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
      const previousBest = { ...run.best };
      const loadText = `НАГРУЗКА ${s.load}`;
      const header = endless
        ? {
            win: false,
            tag: `ПРОДАКШЕН · ${loadText}`,
            title: 'Продакшен упал',
            text: 'Забег уже засчитан как победа. Рекорд продакшена хранится по герою и нагрузке.',
          }
        : {
            win,
            tag:
              (win ? arenaDefinitions[run.selectedMap].victoryTag : 'ЗАБЕГ ОКОНЧЕН') +
              ' · ' +
              loadText,
            title: win ? 'Забег завершён' : 'Контур перегружен',
            text: win
              ? 'Шлюз ЦРПТ пройден.' +
                (opened ? ` Открыта нагрузка ${s.load + 1}.` : '') +
                (bonus ? ` Бонус нагрузки: +${bonus} кодов.` : '') +
                ' Можно продолжить в продакшене: сложность растёт каждую минуту.'
              : 'Попробуй другую сборку: другое оружие и пассивки меняют забег.',
          };
      const stats = endless
        ? [
            {
              value: clock(s.t - s.endlessStart),
              label: 'В ПРОДАКШЕНЕ',
              best: productionBest.time,
            },
            {
              value: String(s.kills - s.endlessKills),
              label: 'ПОБЕЖДЕНО В ПРОДАКШЕНЕ',
              best: productionBest.kills,
            },
            { value: clock(s.t), label: 'ВСЕГО' },
          ]
        : [
            { value: clock(s.t), label: 'ВРЕМЯ', best: s.t > (previousBest.time || 0) },
            {
              value: String(s.kills),
              label: 'ПРОТИВНИКОВ ПОБЕЖДЕНО',
              best: s.kills > (previousBest.kills || 0),
            },
          ];
      run.result = {
        ...header,
        canContinue: win && !endless,
        stats: [
          ...stats,
          { value: String(s.level), label: 'УРОВЕНЬ' },
          { value: '+' + s.earned, label: 'КОДОВ' },
        ],
        damage: damageReport(s),
        build: upgrades.build(run.selected, s),
        seed: seedText(s.seed),
        unlocked: newlyDone(progression, run.best, s.doneBefore),
        goals: nearestGoals(progression, run.best, 2),
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
        names.push('+10 кодов');
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
    function chooseLoad(level) {
      run.selectedLoad = clampLoad(run.pendingHero, level);
      ui.emit();
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
      if (arenaDefinitions[snapshot.map]) run.selectedMap = snapshot.map;
      world.select(run.selectedMap);
      if (snapshot.baClient) run.baClient = snapshot.baClient;
      run.selectedLoad = snapshot.state.load || 1;
      run.nextSeed = snapshot.state.seed ?? null;
      start();
      restoreRun(run.state, snapshot, spawning.spawn);
      if (snapshot.pendingLevel) {
        setMode('level');
        run.levelLock = LEVEL_LOCK;
        // The saved offer is still open with the same cards. A save of an older build kept
        // no cards: new ones replace the logged offer, not counted twice.
        const saved = snapshot.choice && upgrades.cards(run.selected, run.state, snapshot.choice);
        if (saved) {
          run.choice = saved;
          run.banishArmed = false;
        } else offerCards({});
        audio.effect('level');
      } else setMode('pause');
      snapshots.save(run);
      changed();
      return true;
    }

    // Damage per source, largest first, with display names.
    function damageReport(s) {
      const total = Object.values(s.damageBy).reduce((sum, n) => sum + n, 0) || 1;
      return Object.entries(s.damageBy)
        .map(([tag, amount]) => ({
          tag,
          name: sourceName(tag),
          amount: Math.round(amount),
          share: Math.round((amount / total) * 100),
        }))
        .sort((a, b) => b.amount - a.amount);
    }
    function sourceName(tag) {
      if (tag === 'hero') return heroDefinitions[run.selected].weapon;
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
      const owned = Object.keys(heroDefinitions).filter((id) => shop.owned(id));
      if (!owned.length) throw new Error('Нет доступных героев для нового забега');
      run.pendingHero = owned.includes(run.selected) ? run.selected : owned[0];
      if (!baClientIds.includes(run.baClient)) run.baClient = baClientIds[0];
      show('heroSelect');
    }
    function chooseHero(id) {
      if (!shop.owned(id)) return;
      run.pendingHero = id;
      run.selectedLoad = clampLoad(id, run.selectedLoad);
      ui.emit();
    }
    function chooseBaClient(id) {
      run.baClient = id;
      ui.emit();
    }
    function chooseMap(id) {
      if (!mapOpen(id)) return;
      run.selectedMap = id;
      world.select(id);
      ui.emit();
    }
    function startSelected() {
      run.selected = run.pendingHero;
      run.nextSeed = parseSeed(run.seedInput);
      start();
    }
    function chooseSeed(text) {
      run.seedInput = String(text).slice(0, 7);
      ui.emit();
    }
    // Same layout and events again: restart with the finished run's seed.
    function restartSameSeed() {
      if (!run.state) return;
      run.nextSeed = run.state.seed;
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
      if (!shop.owned(id) && shop.buyHero(id)) ui.emit();
    }
    function buyUpgrade(id) {
      if (shop.buyUpgrade(id)) ui.emit();
    }
    function respec() {
      if (run.mode !== 'menu') return 0;
      const refund = shop.respec();
      if (refund) {
        audio.effect('pickup');
        ui.emit();
      }
      return refund;
    }
    function claimAchievement(id) {
      if (achievements.claimAchievement(id, run.best)) {
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
      continueProduction,
      chooseLoad,
      openBundle,
      openHeroSelect,
      closeHeroSelect: () => show('menu'),
      chooseHero,
      chooseBaClient,
      chooseMap,
      chooseSeed,
      restartSameSeed,
      startSelected,
      openShop: () => openMenuScreen('shop'),
      openAchievements: () => openMenuScreen('achievements'),
      openEncyclopedia: () => openMenuScreen('encyclopedia'),
      backToMenu: () => show('menu'),
      openSettings,
      closeSettings,
      closeScreen,
      buyHero,
      buyUpgrade,
      respec,
      claimAchievement,
      toggleSetting,
    };
  },
};
