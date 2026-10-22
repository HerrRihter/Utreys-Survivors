import { createEventScope } from './lifecycle.js';

// Keyboard and touch-stick input. Writes raw input into `run` (keys, stick), combines it into
// the movement intent `run.move` (see updateMove) and calls
// `actions` for commands: { pause, pickUpgrade, activateAbility, closeScreen, captureKey,
// reroll, skip, banish }. `closeScreen()` returns true when Escape closed a menu screen instead
// of pausing; `captureKey(code)` returns true when the key was taken by the rebinding screen.
// `bindings` maps actions to key codes (see defaultBindings).
export const InputSystem = {
  create({
    window,
    document,
    canvas,
    run,
    actions,
    bindings = () => ({
      up: 'KeyW',
      down: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      abilityQ: 'KeyQ',
      abilityE: 'KeyE',
      pause: 'KeyP',
    }),
    onStick = () => {},
  }) {
    const events = createEventScope();
    function resetInput() {
      run.keys.clear();
      run.pointer = null;
      run.stick = { x: 0, y: 0 };
      run.move = { x: 0, y: 0 };
      if (run.stickView) {
        run.stickView = null;
        onStick();
      }
    }
    // Held movement keys (bound key or arrow) plus the stick; the simulation clamps the length.
    function updateMove() {
      const keys = bindings(),
        held = (action, arrow) => (run.keys.has(keys[action]) || run.keys.has(arrow) ? 1 : 0);
      run.move.x = held('right', 'ArrowRight') - held('left', 'ArrowLeft') + run.stick.x;
      run.move.y = held('down', 'ArrowDown') - held('up', 'ArrowUp') + run.stick.y;
    }
    // Off while another page (bestiary, arena preview) owns the keyboard; see disable().
    let enabled = true;
    function onKeyDown(e) {
      // A quiz or the escalation console stops the fight: its own buttons only.
      if (!enabled || run.mode === 'quiz' || run.mode === 'console') return;
      if (
        e.code !== 'Escape' &&
        e.target?.matches?.('input,select,textarea,[contenteditable="true"]')
      )
        return;
      if (
        run.mode === 'play' &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)
      )
        e.preventDefault();
      if (e.repeat) return;
      if (actions.captureKey?.(e.code)) {
        e.preventDefault();
        return;
      }
      const keys = bindings();
      if (run.mode === 'play' && (e.code === keys.abilityQ || e.code === keys.abilityE)) {
        e.preventDefault();
        actions.activateAbility(e.code === keys.abilityQ ? 0 : 1);
        return;
      }
      if (e.code === 'Escape' && actions.closeScreen()) return;
      if (e.code === 'Escape' || e.code === keys.pause) actions.pause();
      if (run.mode === 'level') {
        const digit = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
        if (digit >= 0) actions.pickUpgrade(digit);
        else if (e.code === keys.reroll) actions.reroll?.();
        else if (e.code === keys.skip) actions.skip?.();
        else if (e.code === keys.banish) actions.banish?.();
      }
      run.keys.add(e.code);
    }
    function bind() {
      events.listen(window, 'keydown', onKeyDown);
      events.listen(window, 'keyup', (e) => run.keys.delete(e.code));
      events.listen(window, 'blur', () => {
        resetInput();
        if (run.mode === 'play') actions.pause();
      });
      events.listen(document, 'visibilitychange', () => {
        if (document.hidden && run.mode === 'play') actions.pause();
      });
      if (canvas.style) canvas.style.touchAction = 'none';
      // Touch stick: appears where the finger lands, the knob follows within 24 px.
      events.listen(canvas, 'pointerdown', (e) => {
        if (run.mode !== 'play' || e.pointerType === 'mouse' || run.pointer) return;
        run.pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
        run.stickView = { x: e.clientX, y: e.clientY, knobX: 0, knobY: 0 };
        onStick();
        try {
          canvas.setPointerCapture?.(e.pointerId);
        } catch {
          // The pointer may already be gone (e.g. a cancelled touch); the stick still works.
        }
      });
      events.listen(canvas, 'pointermove', (e) => {
        if (!run.pointer || run.pointer.id !== e.pointerId) return;
        const dx = e.clientX - run.pointer.x,
          dy = e.clientY - run.pointer.y,
          l = Math.hypot(dx, dy);
        run.stick = { x: dx / Math.max(35, l), y: dy / Math.max(35, l) };
        if (run.stickView) {
          run.stickView = { ...run.stickView, knobX: run.stick.x * 24, knobY: run.stick.y * 24 };
          onStick();
        }
      });
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
        events.listen(canvas, name, (e) => {
          if (!e || run.pointer?.id === e.pointerId) resetInput();
        });
    }
    return {
      resetInput,
      updateMove,
      bind,
      // The session turns key commands off while it sleeps behind another page.
      disable() {
        enabled = false;
      },
      enable() {
        enabled = true;
      },
      dispose() {
        events.dispose();
        resetInput();
      },
    };
  },
};
