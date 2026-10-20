// The simulation advances in fixed steps of STEP seconds, whatever the display's frame rate:
// the same input gives the same run at 30, 60 or 144 Hz. Frame time is gathered in an
// accumulator; a frame runs at most MAX_STEPS steps, and the rest of a longer pause (a
// stalled tab, a slow device) is dropped rather than caught up.
export const STEP = 1 / 60;
export const MAX_STEPS = 5;
// A frame a hair shorter than a step (display jitter) still runs its step: the accumulator
// may go this far below zero and evens out on the next frames.
const SLACK = 0.001;

export function createFixedStep({ step = STEP, maxSteps = MAX_STEPS } = {}) {
  let pending = 0;
  return {
    // Steps due after `dt` seconds of frame time.
    advance(dt) {
      pending += dt;
      const due = Math.floor((pending + SLACK) / step);
      if (due >= maxSteps) {
        pending = 0;
        return maxSteps;
      }
      pending -= due * step;
      return due;
    },
    // The simulation stopped (pause, level-up, menu): time away is not caught up.
    reset() {
      pending = 0;
    },
  };
}

// requestAnimationFrame scheduling only: `frame(now, dt)` does the work once per displayed
// frame (dt in seconds, 0 on the first frame after a resume); the frame decides how many
// fixed steps to run with createFixedStep. Tests drive the simulation without this loop.
export const GameLoop = {
  create({ requestAnimationFrame, cancelAnimationFrame, frame, audio }) {
    let running = false,
      frameId = null,
      freshFrame = false,
      last = 0;
    function tick(now) {
      if (!running) return;
      const dt = freshFrame ? 0 : Math.max(0, (now - last) / 1000 || 0);
      freshFrame = false;
      last = now;
      frame(now, dt);
      if (running) frameId = requestAnimationFrame(tick);
    }
    function run() {
      if (running) return;
      running = true;
      audio.resume();
      freshFrame = true;
      frameId = requestAnimationFrame(tick);
    }
    // `keepAudio`: the game view is hidden behind another page, but the menu music goes on.
    function stop(keepAudio = false) {
      running = false;
      if (!keepAudio) audio.stop();
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
    }
    return {
      run,
      stop,
      get running() {
        return running;
      },
    };
  },
};
