import {
  beginLearning,
  selectLearning,
  submitLearning,
  advanceLearning,
  closeLearning,
  moveLearningRoom,
} from '../systems/learning.js';

export function createLearningFlow({
  run,
  input,
  snapshots,
  toast,
  setMode,
  changed,
  finish,
  levelUp,
}) {
  function save() {
    if (!snapshots.save(run)) toast('Не удалось сохранить забег. Не закрывай вкладку.');
    changed();
  }
  function resumePlay() {
    input.resetInput();
    setMode('play');
    if (run.state.bossDead) finish(true);
    else if (run.state.xp >= run.state.need) levelUp();
    if (run.mode !== 'end') save();
  }
  function resolveOutcome(win) {
    if (!win && beginLearning(run.state, 'revive')) {
      setMode('quiz');
      input.resetInput();
      save();
    } else finish(win);
  }
  function startLearningTest(nodeId) {
    const s = run.state;
    if (run.mode !== 'play' || !s || s.xp >= s.need) return false;
    const node = s.nodes.find((n) => n.id === nodeId);
    if (!node || !beginLearning(s, node.required ? 'lesson' : 'bonus', nodeId)) return false;
    setMode('quiz');
    input.resetInput();
    save();
    return true;
  }
  const act =
    (fn) =>
    (...args) => {
      if (run.mode !== 'quiz' || !fn(run.state, ...args)) return false;
      save();
      return true;
    };
  return {
    resolveOutcome,
    startLearningTest,
    selectLearningAnswer: act(selectLearning),
    submitLearningAnswer: act(submitLearning),
    advanceLearning: act(advanceLearning),
    closeLearning(id) {
      if (run.mode !== 'quiz') return false;
      const outcome = closeLearning(run.state, id);
      if (!outcome) return false;
      if (outcome === 'defeat') finish(false);
      else resumePlay();
      return true;
    },
    moveLearningRoom() {
      if (run.mode !== 'play' || !moveLearningRoom(run.state)) return false;
      input.resetInput();
      save();
      return true;
    },
  };
}
