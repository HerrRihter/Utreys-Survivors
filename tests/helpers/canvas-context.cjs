'use strict';
// Shared Canvas contract for offscreen raster caches and game rendering tests.
function canvasContext(overrides={}) {
 return {
  measureText(text) {return {width:String(text).length*6};},
  scale() {}, fillText() {}, fillRect() {}, drawImage() {},
  ...overrides,
 };
}
module.exports={canvasContext};
