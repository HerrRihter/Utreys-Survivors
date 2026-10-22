import { AssetPaths } from './assets.js';
import { createEventScope } from './lifecycle.js';
import { persisted } from './storage.js';
import { LEGACY_AUDIO_KEYS } from './migrations.js';

// The Penza mode's battle playlist, played in turn from the first track.
const penzaTracks = ['penza-strela', 'penza-chelovechek'];

// The saved mix: sound on or off and the two volumes in 0..1.
function normalizeAudio(saved) {
  const settings = { enabled: true, music: 0.3, effects: 0.65 };
  if (saved && typeof saved === 'object') {
    if (typeof saved.enabled === 'boolean') settings.enabled = saved.enabled;
    for (const key of ['music', 'effects'])
      if (Number.isFinite(saved[key])) settings[key] = Math.max(0, Math.min(1, saved[key]));
  }
  return settings;
}
// Music by mode, pooled sound effects and the persisted mix. No DOM controls: the UI calls
// toggle()/setVolume() and re-reads `settings` when `onChange` fires. `penza()` swaps the
// battle music for the Penza mode's playlist.
export const AudioSystem = {
  create({
    window,
    document,
    storage,
    performance,
    random,
    getMode,
    penza = () => false,
    onChange = () => {},
  }) {
    const events = createEventScope();
    const root = new URL(AssetPaths.url('audio/'));
    const file = persisted(storage, 'utreys-audio', {
      normalize: normalizeAudio,
      legacyKeys: LEGACY_AUDIO_KEYS,
    });
    const settings = file.load();
    const clips = {
      hit: ['hit-1.mp3', 'hit-2.mp3'],
      hurt: ['hurt.mp3'],
      throw: ['throw.ogg'],
      pickup: ['pickup.ogg'],
      heal: ['heal.ogg'],
      level: ['level.ogg'],
      ui: ['ui.ogg'],
      boss: ['boss.ogg'],
      magic: ['magic.ogg'],
      death: ['death-1.mp3', 'death-2.mp3', 'death-3.mp3'],
      punchSwing: ['punch.mp3'],
      punch: ['punch.mp3'],
    };
    const pools = new Map(),
      cooldowns = new Map(),
      tracks = new Map();
    let unlocked = false,
      stopped = false,
      result = 'defeat',
      current = null,
      penzaIndex = 0;
    function make(file) {
      if (!window.Audio) return null;
      const audio = new window.Audio(new URL(file, root).href);
      audio.preload = 'auto';
      // Short impacts vary in pitch with their speed. Pitch-preserving time
      // stretching adds metallic artifacts and unnecessary audio processing.
      audio.preservesPitch = false;
      return audio;
    }
    function play(audio) {
      try {
        audio.play()?.catch(() => {});
      } catch {}
    }
    function quiet() {
      return !unlocked || stopped || !settings.enabled || document.hidden;
    }
    function silenceEffects() {
      for (const pool of pools.values()) for (const audio of pool) audio.pause();
    }
    function sync() {
      const mode = getMode();
      // Out of battle the Penza playlist starts over from its first track.
      if (mode === 'menu' || mode === 'end') penzaIndex = 0;
      const battle = penza() ? penzaTracks[penzaIndex] : 'battle';
      const wanted = mode === 'menu' ? 'tavern' : mode === 'end' ? result : battle;
      if (current?.name !== wanted) {
        current?.audio.pause();
        let audio = tracks.get(wanted);
        if (!audio && unlocked) {
          audio = make('music/' + wanted + '.mp3');
          if (audio) {
            audio.loop = wanted === 'tavern' || wanted === 'battle';
            if (penzaTracks.includes(wanted))
              events.listen(audio, 'ended', () => {
                penzaIndex = (penzaIndex + 1) % penzaTracks.length;
                sync();
              });
            tracks.set(wanted, audio);
          }
        }
        current = audio ? { name: wanted, audio } : null;
        if (audio) audio.currentTime = 0;
      }
      if (quiet() || mode === 'pause' || mode === 'quiz' || mode === 'console') silenceEffects();
      if (!current) return;
      current.audio.volume =
        settings.music * (mode === 'level' || mode === 'quiz' || mode === 'console' ? 0.45 : 1);
      if (quiet() || mode === 'pause' || settings.music === 0) current.audio.pause();
      else if (current.audio.paused && !(current.audio.ended && !current.audio.loop))
        play(current.audio);
    }
    function effect(name) {
      if (quiet() || !settings.effects || getMode() === 'pause') return;
      const files = clips[name] || clips.ui;
      if (!files) return;
      const now = performance.now();
      if (
        now - (cooldowns.get(name) ?? -Infinity) <
        (name === 'death' ? 180 : name === 'pickup' ? 100 : 65)
      )
        return;
      cooldowns.set(name, now);
      const file = files[Math.floor(random() * files.length)];
      let pool = pools.get(file);
      if (!pool) {
        pool = [];
        pools.set(file, pool);
      }
      let audio = pool.find((item) => item.paused || item.ended);
      if (!audio && pool.length < 3) {
        audio = make('sfx/' + file);
        if (audio) pool.push(audio);
      }
      if (!audio) return;
      audio.currentTime = 0;
      audio.volume = settings.effects * (name === 'pickup' ? 0.35 : name === 'death' ? 0.55 : 0.65);
      audio.playbackRate = ['hit', 'throw', 'punchSwing'].includes(name)
        ? 0.94 + random() * 0.12
        : 1;
      play(audio);
    }
    function save() {
      file.save(settings);
    }
    function unlock() {
      unlocked = true;
      sync();
    }
    events.listen(document, 'pointerdown', unlock);
    events.listen(document, 'keydown', unlock);
    events.listen(document, 'visibilitychange', sync);
    function toggleEnabled() {
      settings.enabled = !settings.enabled;
      unlock();
      save();
      onChange();
      effect('ui');
    }
    // percent: 0–100 from a slider; `commit` marks the end of a drag (plays a short cue).
    function setVolume(key, percent, commit = false) {
      settings[key] = Math.max(0, Math.min(1, Number(percent) / 100));
      if (key === 'effects') silenceEffects();
      unlock();
      save();
      onChange();
      if (commit) effect('ui');
    }
    return {
      effect,
      sync,
      // The battle playlist changed (the Penza mode): start it over from its first track.
      restartBattle() {
        penzaIndex = 0;
        sync();
      },
      finish(win) {
        result = win ? 'victory' : 'defeat';
        silenceEffects();
        sync();
      },
      stop() {
        stopped = true;
        current?.audio.pause();
        silenceEffects();
      },
      dispose() {
        stopped = true;
        current?.audio.pause();
        silenceEffects();
        events.dispose();
        pools.clear();
        tracks.clear();
      },
      resume() {
        stopped = false;
        sync();
      },
      toggle: toggleEnabled,
      setVolume,
      get settings() {
        return { ...settings };
      },
    };
  },
};
