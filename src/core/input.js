import { createEventScope } from './lifecycle.js';

// Keyboard and touch-stick input. Writes raw input into `run` (keys, stick) and calls
// `actions` for commands: { pause, pickUpgrade, activateAbility, closeScreen }.
// `closeScreen()` returns true when Escape closed a menu screen instead of pausing.
export const InputSystem = {
  create({ window, document, canvas, run, actions, onStick = () => {} }) {
    const events = createEventScope();
    function resetInput() {
      run.keys.clear();
      run.pointer = null;
      run.stick = { x: 0, y: 0 };
      if (run.stickView) {
        run.stickView = null;
        onStick();
      }
    }
    function onKeyDown(e) {
      // Other views (bestiary, arena preview) own the keyboard.
      if (document.body?.dataset.view && document.body.dataset.view !== 'game') return;
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
      if (run.mode === 'play' && (e.code === 'KeyQ' || e.code === 'KeyE')) {
        e.preventDefault();
        actions.activateAbility(e.code === 'KeyQ' ? 0 : 1);
        return;
      }
      if (e.code === 'Escape' && actions.closeScreen()) return;
      if (e.code === 'Escape' || e.code === 'KeyP') actions.pause();
      if (run.mode === 'level' && ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code))
        actions.pickUpgrade(+e.code.slice(-1) - 1);
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
      bind,
      dispose() {
        events.dispose();
        resetInput();
      },
    };
  },
};
