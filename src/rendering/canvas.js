// Backing-store size for the game canvas: CSS size × device ratio (max 2); portrait screens
// zoom out to 90% so more of the arena fits. W/H are in CSS pixels.
export const CanvasSystem = {
  create({ window, canvas, ctx }) {
    const view = { W: 960, H: 540, resize };
    function resize() {
      const zoom = window.innerWidth < window.innerHeight ? 0.9 : 1,
        ratio = Math.min(window.devicePixelRatio || 1, 2) * zoom;
      view.W = Math.max(1, (window.innerWidth || 960) / zoom);
      view.H = Math.max(1, (window.innerHeight || 540) / zoom);
      canvas.width = Math.round(view.W * ratio);
      canvas.height = Math.round(view.H * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.imageSmoothingEnabled = false;
    }
    return view;
  },
};
