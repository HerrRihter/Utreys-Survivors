// requestAnimationFrame scheduling only: `frame(now, dt)` does the work (dt capped at 50 ms,
// 0 on the first frame after a resume). Tests can call the simulation without this loop.
export const GameLoop = {
  create({ requestAnimationFrame, cancelAnimationFrame, frame, audio }) {
    let running = false,
      frameId = null,
      freshFrame = false,
      last = 0;
    function tick(now) {
      if (!running) return;
      const dt = freshFrame ? 0 : Math.min((now - last) / 1000 || 0, 0.05);
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
    function stop() {
      running = false;
      audio.stop();
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
