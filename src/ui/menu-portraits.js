export let MenuPortraits;
'use strict';

MenuPortraits = {
  create({document, sprite, artStatus}) {
    const cache = new Map();

    function fit(canvas, name, phase = 0) {
      const key = name + ':' + artStatus(name);
      let set = cache.get(key);
      if (!set) {
        const frames = [];
        for (let i = 0; i < 8; i++) {
          const source = document.createElement('canvas');
          source.width = source.height = 256;
          sprite(source.getContext('2d'), name, 128, 230, 3, false, 0, false, 0, {
            moving: i < 4,
            walk: (i % 4) / 4,
            action: i >= 4 ? {elapsed: (i % 4) / 4, duration: 1, flip: false} : null,
          });
          frames.push(source);
        }
        // Shared bounds retain every pose without reading pixels from file:// art.
        set = {frames, left: 64, top: 120, w: 128, h: 128};
        cache.set(key, set);
      }
      const {frames, left, top, w, h} = set;
      const g = canvas.getContext('2d');
      const scale = Math.min((canvas.width - 12) / w, (canvas.height - 12) / h);
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.imageSmoothingEnabled = false;
      g.drawImage(frames[phase % 8], left, top, w, h,
        (canvas.width - w * scale) / 2, (canvas.height - h * scale) / 2, w * scale, h * scale);
    }

    return {fit, clear: () => cache.clear()};
  },
};
