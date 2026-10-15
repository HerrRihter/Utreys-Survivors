import { AssetPaths } from '../asset-paths.js';
import { scaledScenery } from '../scaled-scenery.js';
// Ground outlines trace masonry, steps and planters, excluding roofs and foliage.
// Coordinates refer to the original square PNG, before horizontal reflection.
export const LutetiaShapes = {
  'house-balcony-v3': [
    [0.1, 0.78],
    [0.58, 0.76],
    [0.93, 0.85],
    [0.92, 0.94],
    [0.56, 0.97],
    [0.1, 0.92],
  ],
  'house-cottage-v3': [
    [0.1, 0.79],
    [0.65, 0.77],
    [0.95, 0.84],
    [0.96, 0.89],
    [0.64, 0.93],
    [0.19, 0.89],
    [0.19, 0.87],
    [0.1, 0.87],
  ],
  'house-terrace-v3': [
    [0.09, 0.79],
    [0.58, 0.77],
    [0.94, 0.86],
    [0.94, 0.94],
    [0.57, 0.98],
    [0.1, 0.94],
  ],
  'house-portico-v3': [
    [0.09, 0.71],
    [0.68, 0.7],
    [0.95, 0.77],
    [0.94, 0.83],
    [0.59, 0.86],
    [0.14, 0.83],
  ],
  'house-shop-v3': [
    [0.08, 0.8],
    [0.61, 0.79],
    [0.95, 0.86],
    [0.95, 0.96],
    [0.56, 0.98],
    [0.08, 0.94],
  ],
  'house-stairs-v3': [
    [0.07, 0.76],
    [0.53, 0.74],
    [0.94, 0.84],
    [0.94, 0.92],
    [0.7, 0.95],
    [0.44, 0.94],
    [0.39, 0.98],
    [0.04, 0.94],
  ],
  'tree-broadleaf-v3': [
    [0.35, 0.9],
    [0.64, 0.88],
    [0.69, 0.94],
    [0.62, 0.98],
    [0.36, 0.98],
    [0.31, 0.94],
  ],
  'tree-cypress-v3': [
    [0.37, 0.91],
    [0.61, 0.91],
    [0.67, 0.95],
    [0.6, 0.98],
    [0.38, 0.98],
    [0.33, 0.95],
  ],
  'fountain-v3': [
    [0.05, 0.66],
    [0.46, 0.55],
    [0.96, 0.65],
    [0.96, 0.82],
    [0.52, 0.97],
    [0.05, 0.83],
  ],
  'guardpost-v3': [
    [0.23, 0.78],
    [0.53, 0.76],
    [0.84, 0.8],
    [0.85, 0.91],
    [0.49, 0.96],
    [0.22, 0.91],
  ],
};
const sprites = {},
  status = {};
if (typeof Image !== 'undefined') {
  for (const name of [...Object.keys(LutetiaShapes), 'garden-v2']) {
    const sprite = new Image();
    status[name] = 'loading';
    sprite.onload = () => (status[name] = 'ready');
    sprite.onerror = () => (status[name] = 'error');
    sprite.src = AssetPaths.url('world/lutetia/' + name + '.png');
    sprites[name] = sprite;
  }
}
export const LutetiaArt = {
  status,
  draw(g, kind, x, y, width, flip = false) {
    const sprite = sprites[kind];
    if (!sprite || status[kind] !== 'ready') return false;
    const height = (width * sprite.naturalHeight) / sprite.naturalWidth;
    g.save();
    g.translate(x, y);
    if (flip) g.scale(-1, 1);
    g.drawImage(scaledScenery(sprite, width, false), -width / 2, -height, width, height);
    g.restore();
    return true;
  },
};
