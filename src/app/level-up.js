import { logOffer, logReoffer, logChoice } from '../systems/run-log.js';

// A short lock stops a held key or a stray tap from picking a card the player never saw.
const LEVEL_LOCK = 0.4;

// The level-up screen: offered cards, picks, rerolls, skips and bans.
export function createLevelUp({ run, upgrades, audio, input, ui, setMode, changed }) {
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
    run.levelLock = LEVEL_LOCK;
    offerCards();
    audio.effect('level');
    changed();
  }
  // A saved run reopens its level-up with the same cards. A save of an older build kept no
  // cards: new ones replace the logged offer, not counted twice.
  function reopen(savedChoice) {
    setMode('level');
    run.levelLock = LEVEL_LOCK;
    const saved = savedChoice && upgrades.cards(run.selected, run.state, savedChoice);
    if (saved) {
      run.choice = saved;
      run.banishArmed = false;
    } else offerCards({});
    audio.effect('level');
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
  return { levelUp, reopen, pickUpgrade, chooseCard, reroll, skip, armBanish };
}
