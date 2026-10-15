'use strict';
// Shared Canvas contract for offscreen raster caches and game rendering tests.
// Geometry calls reject NaN/Infinity: a broken camera or size would otherwise draw nothing
// in the browser while every headless test still passed.
const finite = (name) =>
  function (...args) {
    for (const value of args)
      if (typeof value === 'number' && !Number.isFinite(value))
        throw new Error(`Canvas ${name} received ${value}: ${JSON.stringify(args)}`);
  };
function canvasContext(overrides = {}) {
  return {
    measureText(text) {
      return { width: String(text).length * 6 };
    },
    scale: finite('scale'),
    translate: finite('translate'),
    fillText: finite('fillText'),
    fillRect: finite('fillRect'),
    drawImage() {},
    ...overrides,
  };
}
module.exports = { canvasContext };
