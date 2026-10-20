const SAVE_EVERY = 30;

// Timers the frame loop drives besides the simulation. Timers of play time (autosave every
// 30 s, tips four times a second and how long a tip shows) count the simulated time; the
// interface's own timers (the level-up lock, toasts, the HUD refreshed at most ten times a
// second) count real frame time, so they behave the same while the simulation is paused or
// drops time on a stalled frame.
export function createFrameTimers({ run, ui, hud, snapshots, tips }) {
  let hudClock = 0,
    saveClock = 0,
    tipClock = 0;
  // `seconds` of play simulated in this frame.
  function played(seconds) {
    saveClock += seconds;
    if (saveClock >= SAVE_EVERY) {
      saveClock = 0;
      snapshots.save(run);
    }
    tipClock += seconds;
    if (tipClock >= 0.25) {
      tipClock = 0;
      tips.check();
    }
    if (run.tip.left > 0) run.tip.left -= seconds;
  }
  // `dt` of real time since the previous frame.
  function frame(dt) {
    if (run.mode === 'level' && run.levelLock > 0) {
      run.levelLock -= dt;
      if (run.levelLock <= 0) ui.emit();
    }
    if (run.toast.left > 0) {
      run.toast.left -= dt;
      if (run.toast.left <= 0) ui.emit();
    }
    hudClock += dt;
    if (run.state && hudClock >= 0.1) {
      hudClock = 0;
      hud.emit();
    }
  }
  return { played, frame };
}
