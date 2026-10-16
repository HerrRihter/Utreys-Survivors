// Offscreen canvases for sprite caches. The factory is injected so engine modules never reach
// for a global document; previews fall back to the page's document at call time.
export function canvasFactory(document) {
  return (width, height) => {
    if (!document?.createElement) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  };
}

export const browserCanvas = (width, height) => canvasFactory(globalThis.document)(width, height);

// Remove only fully transparent margins, once when a sprite enters the cache.
// Large empty margins otherwise get resampled/blended for every enemy every frame.
export function trimCanvas(canvas, createCanvas) {
  const width = canvas.width,
    height = canvas.height;
  const original = { canvas, x: 0, y: 0, width, height };
  const context = canvas.getContext('2d');
  if (!context?.getImageData) return original;
  const pixels = context.getImageData(0, 0, width, height)?.data;
  if (!pixels) return original;
  let left = width,
    right = -1,
    top = height,
    bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (!pixels[(y * width + x) * 4 + 3]) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  if (right < left || (left === 0 && right === width - 1 && top === 0 && bottom === height - 1))
    return original;
  const cropped = createCanvas(right - left + 1, bottom - top + 1);
  const target = cropped?.getContext('2d');
  if (!target) return original;
  target.drawImage(
    canvas,
    left,
    top,
    cropped.width,
    cropped.height,
    0,
    0,
    cropped.width,
    cropped.height,
  );
  return { canvas: cropped, x: left, y: top, width, height };
}
