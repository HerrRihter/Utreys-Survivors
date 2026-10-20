import assert from 'node:assert/strict';
import { canvasContext } from './helpers/canvas-context.js';
import { test } from 'vitest';

test('sprite-cache', async () => {
  const { trimCanvas } = await import('../src/rendering/offscreen.js');
  const pixels = new Uint8ClampedArray(28 * 28 * 4);
  // The barely visible halo is part of the artwork and must survive cropping.
  pixels[(9 * 28 + 8) * 4 + 3] = 1;
  pixels[(17 * 28 + 18) * 4 + 3] = 255;
  const canvas = {
    width: 28,
    height: 28,
    getContext: () => ({ getImageData: () => ({ data: pixels }) }),
  };
  const copies = [];
  const createCanvas = (width, height) => ({
    width,
    height,
    getContext: () => ({ drawImage: (...args) => copies.push(args) }),
  });
  const cropped = trimCanvas(canvas, createCanvas);
  assert.equal(cropped.x, 8);
  assert.equal(cropped.y, 9);
  assert.equal(cropped.canvas.width, 11);
  assert.equal(cropped.canvas.height, 9);
  assert.equal(cropped.width, 28);
  assert.equal(cropped.height, 28);
  assert.deepEqual(copies[0], [canvas, 8, 9, 11, 9, 0, 0, 11, 9]);
  pixels[3] = 1;
  pixels[pixels.length - 1] = 1;
  assert.equal(trimCanvas(canvas, createCanvas).canvas, canvas);
  pixels.fill(0);
  assert.equal(trimCanvas(canvas, createCanvas).canvas, canvas);
  const unsupported = { width: 28, height: 28, getContext: () => ({}) };
  assert.equal(trimCanvas(unsupported, createCanvas).canvas, unsupported);
  const { createEnemyRenderer } = await import('../src/rendering/enemies.js');
  const context = (overrides = {}) =>
    new Proxy(canvasContext(overrides), {
      get: (target, key) => target[key] || (() => {}),
    });
  let allocated = 0;
  const enemies = createEnemyRenderer({
    createCanvas: (width, height) => {
      allocated++;
      return { width, height, getContext: () => context() };
    },
  });
  for (const ratio of [0.9, 1, 1.8, 2, 2.34]) {
    const draws = [];
    const g = context({
      getTransform: () => ({ a: ratio }),
      drawImage: (...args) => draws.push(args),
    });
    const enemy = { unit: 'l3', x: 100.3, y: 140.7, heading: 0, hit: 0, animationTime: 0 };
    enemies.draw(g, enemy);
    assert.equal(draws.length, 2, 'body and full label remain visible');
    for (const [source, , , width, height] of draws) {
      assert(Math.abs(width * ratio - source.width) < 1e-8, 'no horizontal resampling');
      assert(Math.abs(height * ratio - source.height) < 1e-8, 'no vertical resampling');
    }
    const previous = allocated;
    enemies.draw(g, enemy);
    assert.equal(allocated, previous, 'warm sprites and labels reuse the raster');
  }
  console.log(
    'PASS: faint halos retained, native-resolution sprites and labels at five scales, cache reuse and fallback renderers',
  );
});
