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
