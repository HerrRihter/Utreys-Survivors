import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createArenaFloor } from '../src/rendering/arena-floor.js';

// A canvas stub that records every colour the floor paints with.
function recorder() {
  const colors = new Set();
  const g = {
    set fillStyle(value) {
      colors.add(value);
    },
    set strokeStyle(value) {
      colors.add(value);
    },
    fillRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    rect() {},
    arc() {},
    save() {},
    restore() {},
  };
  return { g, colors };
}

test('the Penza mode repaints the arena floor in red, black and grey', () => {
  let penza = false;
  const floor = createArenaFloor({ createCanvas: () => null, penza: () => penza });
  const arena = { size: 800, racks: [[100, 100, 80, 20]] };
  const usual = recorder();
  floor.draw(usual.g, arena);
  assert(usual.colors.has('#00e5ff99'), 'The usual neon rack edge');
  penza = true;
  const red = recorder();
  floor.draw(red.g, arena);
  assert.equal(floor.palette().accent, '#ff3b3b');
  assert(![...red.colors].some((c) => /^#(00e5ff|64ffda)/.test(c)), 'No cyan left');
});
