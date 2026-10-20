import { heroDefinitions } from '../../data/characters/heroes.js';
import { baClientIds } from '../../data/characters/ba-specialization.js';
import { clampLoad, mapOpen } from './selection.js';

// Menu screens and what is chosen on them: hero select, shop, achievements, encyclopedia and
// settings. Each command changes `run` or the save and announces the change.
export function createNavigation({ run, settings, progression, world, audio, ui, changed }) {
  const { shop, achievements, loads } = progression;
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
    run.selectedLoad = clampLoad(loads, id, run.selectedLoad);
    ui.emit();
  }
  function chooseLoad(level) {
    run.selectedLoad = clampLoad(loads, run.pendingHero, level);
    ui.emit();
  }
  function chooseBaClient(id) {
    run.baClient = id;
    ui.emit();
  }
  function chooseMap(id) {
    if (!mapOpen(progression, id)) return;
    run.selectedMap = id;
    world.select(id);
    ui.emit();
  }
  function chooseSeed(text) {
    run.seedInput = String(text).slice(0, 7);
    ui.emit();
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
    if (achievements.claimAchievement(id)) {
      audio.effect('pickup');
      ui.emit();
    }
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
  function toggleSetting(key) {
    settings.toggle(key);
    audio.effect('ui');
    changed();
  }
  return {
    openHeroSelect,
    closeHeroSelect: () => show('menu'),
    chooseHero,
    chooseLoad,
    chooseBaClient,
    chooseMap,
    chooseSeed,
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
    startCapture,
    captureKey,
    resetBindings,
    setUiScale,
    toggleSetting,
  };
}
