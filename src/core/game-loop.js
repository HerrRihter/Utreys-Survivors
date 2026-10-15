export let GameLoop;
GameLoop={create(sessionContext){
let running = false, frameId = null, freshFrame = false, last=0;
function frame(now) {
      if (!running) return;
      const dt = freshFrame ? 0 : sessionContext.Math.min((now-last)/1000 || 0, .05);
      freshFrame = false;
      last = now;
      if (sessionContext.mode === 'play') sessionContext.update(dt);
      if (sessionContext.mode === 'menu') sessionContext.animateMenu(now);
      if (sessionContext.toastLeft > 0) {
        sessionContext.toastLeft -= dt;
        if (sessionContext.toastLeft <= 0) sessionContext.$('toast').style.opacity = 0;
      }
      sessionContext.draw();
      if (running) frameId = sessionContext.requestAnimationFrame(frame);
    }
function run() {
      if (running) return;
      running = true;
      sessionContext.resumeAudio();
      freshFrame = true;
      frameId = sessionContext.requestAnimationFrame(frame);
    }
function stop() {
      running = false;
      sessionContext.stopAudio();
      if (frameId !== null) sessionContext.cancelAnimationFrame(frameId);
      frameId = null;
    }
return {run,stop,get running(){return running}};
}};
