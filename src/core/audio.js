export const AudioSystem = {create(c) {
  const root = new URL('../../assets/runtime/audio/', import.meta.url);
  const settings = {enabled: true, music: .3, effects: .65};
  try {
    const saved = JSON.parse(c.localStorage.getItem('gaul-audio'));
    if (saved) {
      if (typeof saved.enabled === 'boolean') settings.enabled = saved.enabled;
      for (const key of ['music', 'effects']) if (Number.isFinite(saved[key])) settings[key] = Math.max(0, Math.min(1, saved[key]));
    }
  } catch {}
  const clips = {
    hit: ['hit-1.mp3', 'hit-2.mp3'], hurt: ['hurt.mp3'], throw: ['throw.ogg'],
    stone: ['stone.ogg'], pickup: ['pickup.ogg'], heal: ['heal.ogg'],
    level: ['level.ogg'], ui: ['ui.ogg'], boss: ['boss.ogg'], magic: ['magic.ogg'],
    death: ['death-1.ogg', 'death-2.ogg', 'death-3.ogg'], punchSwing: ['punch.mp3'],
    punch: ['punch.mp3'],
  };
  const pools = new Map(), cooldowns = new Map(), tracks = new Map();
  let unlocked = false, stopped = false, result = 'defeat', current = null;
  function make(file) {
    if (!c.window.Audio) return null;
    const audio = new c.window.Audio(new URL(file, root).href);
    audio.preload = 'auto';
    // Short impacts vary in pitch with their speed. Pitch-preserving time
    // stretching adds metallic artifacts and unnecessary audio processing.
    audio.preservesPitch = false;
    return audio;
  }
  function play(audio) { try { audio.play()?.catch(() => {}); } catch {} }
  function quiet() { return !unlocked || stopped || !settings.enabled || c.document.hidden; }
  function silenceEffects() { for (const pool of pools.values()) for (const audio of pool) audio.pause(); }
  function sync() {
    const mode = c.mode;
    const wanted = mode === 'menu' ? 'tavern' : mode === 'end' ? result : 'battle';
    if (current?.name !== wanted) {
      current?.audio.pause();
      let audio = tracks.get(wanted);
      if (!audio && unlocked) {
        audio = make('music/' + wanted + '.mp3');
        if (audio) { audio.loop = wanted === 'tavern' || wanted === 'battle'; tracks.set(wanted, audio); }
      }
      current = audio ? {name: wanted, audio} : null;
      if (audio) audio.currentTime = 0;
    }
    if (quiet() || mode === 'pause') silenceEffects();
    if (!current) return;
    current.audio.volume = settings.music * (mode === 'level' ? .45 : 1);
    if (quiet() || mode === 'pause' || settings.music === 0) current.audio.pause();
    else if (current.audio.paused && !(current.audio.ended && !current.audio.loop)) play(current.audio);
  }
  function effect(name) {
    if (quiet() || !settings.effects || c.mode === 'pause') return;
    const files = clips[name] || clips.ui;
    if (!files) return;
    const now = c.performance.now();
    if (now - (cooldowns.get(name) ?? -Infinity) < (name === 'death' ? 180 : name === 'pickup' ? 100 : 65)) return;
    cooldowns.set(name, now);
    const file = files[Math.floor(c.Math.random() * files.length)];
    let pool = pools.get(file);
    if (!pool) { pool = []; pools.set(file, pool); }
    let audio = pool.find(item => item.paused || item.ended);
    if (!audio && pool.length < 3) { audio = make('sfx/' + file); if (audio) pool.push(audio); }
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = settings.effects * (name === 'pickup' ? .35 : name === 'death' ? .55 : .65);
    audio.playbackRate = ['hit', 'throw', 'stone', 'punchSwing'].includes(name) ? .94 + c.Math.random() * .12 : 1;
    play(audio);
  }
  function save() { try { c.localStorage.setItem('gaul-audio', JSON.stringify(settings)); } catch {} }
  function refreshControls() {
    const text = `ЗВУК: ${settings.enabled ? 'ВКЛ' : 'ВЫКЛ'}`;
    const button = c.$('sound');
    if (button) {
      button.textContent = text;
      button.setAttribute?.('aria-pressed', String(settings.enabled));
    }
    const settingsBtn = c.$('settingsSound');
    if (settingsBtn) {
      settingsBtn.textContent = text;
      settingsBtn.setAttribute?.('aria-pressed', String(settings.enabled));
    }
    const pauseBtn = c.$('pauseSound');
    if (pauseBtn) {
      pauseBtn.textContent = text;
      pauseBtn.setAttribute?.('aria-pressed', String(settings.enabled));
    }
    const musicVal = c.$('musicVolumeVal');
    if (musicVal) musicVal.textContent = Math.round(settings.music * 100) + '%';
    const effectsVal = c.$('effectsVolumeVal');
    if (effectsVal) effectsVal.textContent = Math.round(settings.effects * 100) + '%';
  }
  function unlock(event) {
    const panel = c.document.querySelector?.('.audio-settings');
    if (event?.target && panel && !panel.contains(event.target)) panel.open = false;
    unlocked = true; sync();
  }
  c.document.addEventListener('pointerdown', unlock);
  c.document.addEventListener('keydown', unlock);
  c.document.addEventListener('visibilitychange', sync);
  function toggleEnabled() {
    settings.enabled = !settings.enabled;
    unlock(); save(); refreshControls(); effect('ui');
  }
  c.$('sound').onclick = toggleEnabled;
  const settingsSoundBtn = c.$('settingsSound');
  if (settingsSoundBtn) settingsSoundBtn.onclick = toggleEnabled;
  const pauseSoundBtn = c.$('pauseSound');
  if (pauseSoundBtn) pauseSoundBtn.onclick = toggleEnabled;
  for (const [id, key] of [['musicVolume', 'music'], ['effectsVolume', 'effects']]) {
    const control = c.$(id);
    if (!control) continue;
    control.value = Math.round(settings[key] * 100);
    control.oninput = () => {
      settings[key] = Math.max(0, Math.min(1, Number(control.value) / 100));
      if (key === 'effects') silenceEffects();
      const valLabel = c.$(key === 'music' ? 'musicVolumeVal' : 'effectsVolumeVal');
      if (valLabel) valLabel.textContent = Math.round(settings[key] * 100) + '%';
      unlock(); save();
    };
    control.onchange = () => effect('ui');
  }
  refreshControls();
  return {effect, sync, finish(win) {result = win ? 'victory' : 'defeat'; silenceEffects(); sync();},
    stop() {stopped = true; current?.audio.pause(); silenceEffects();},
    resume() {stopped = false; sync();}, toggle: toggleEnabled, settings};
}};
