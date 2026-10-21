import { createLearningFlow } from './learning-flow.js';
import { createLevelUp } from './level-up.js';
import { createRunLifecycle } from './run-lifecycle.js';
import { createNavigation } from './navigation.js';

// The game flow: a run's lifecycle (run-lifecycle.js), its level-up screens (level-up.js) and
// menu navigation (navigation.js). Only changes state: React reads `run` through the session's
// stores, `ui.emit()` / `hud.emit()` announce changes.
export const GameFlow = {
  create({
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
  }) {
    function setMode(mode) {
      run.mode = mode;
      audio.sync();
    }
    function changed() {
      ui.emit();
      hud.emit();
    }
    const levels = createLevelUp({ run, upgrades, audio, input, ui, setMode, changed });
    const lifecycle = createRunLifecycle({
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
      hud,
      ui,
      levels,
      setMode,
      changed,
    });
    const learning = createLearningFlow({
      run,
      world,
      input,
      snapshots,
      toast,
      setMode,
      changed,
      finish: lifecycle.finish,
      levelUp: levels.levelUp,
    });
    const navigation = createNavigation({ run, settings, progression, world, audio, ui, changed });
    const { levelUp, pickUpgrade, chooseCard, reroll, skip, armBanish } = levels;
    return {
      ...lifecycle,
      ...learning,
      levelUp,
      pickUpgrade,
      chooseCard,
      reroll,
      skip,
      armBanish,
      ...navigation,
    };
  },
};
