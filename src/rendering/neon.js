// Layered strokes keep neon edges crisp without per-actor blur filters.
export const neon = { cyan: '#00e5ff', teal: '#64ffda', coral: '#ff6559' };
export function neonStroke(g, color = neon.cyan, width = 1.5, halo = 5) {
  g.save();
  const alpha = typeof g.globalAlpha === 'number' ? g.globalAlpha : 1;
  g.strokeStyle = color;
  g.globalAlpha = alpha * 0.14;
  g.lineWidth = width + halo;
  g.stroke();
  g.globalAlpha = alpha;
  g.lineWidth = width;
  g.stroke();
  g.restore();
}
