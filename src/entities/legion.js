import {unitDefinitions} from '../../data/enemies/units.js';
import {ProjectileArt} from '../rendering/art/projectile-art.js';

export let Legion;
'use strict';
Legion = (() => {
  const units = unitDefinitions;
  const labels = new Map();

  function drawLabel(g, u, x, y) {
    let label = labels.get(u);
    if (!label && typeof document !== 'undefined') {
      const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
      ctx.font = 'bold 11px monospace';
      const width = Math.ceil(ctx.measureText(u.name).width) + 8, height = 20;
      canvas.width = width * 2;
      canvas.height = height * 2;
      ctx.scale(2, 2);
      ctx.fillStyle = '#0b1612e0';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = u.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, width, height);
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = u.color;
      ctx.fillText(u.name, width / 2, 14);
      label = {canvas, width, height};
      labels.set(u, label);
    }
    if (label) {
      g.drawImage(label.canvas, x - label.width / 2, y - 14, label.width, label.height);
    } else {
      g.fillStyle = u.color;
      g.font = 'bold 10px monospace';
      g.textAlign = 'center';
      g.fillText(u.name, x, y);
    }
  }

  function mitigation(e, p) {
    // InBev has frontal armor protection
    if (e.unit !== 'inbev') return 1;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    return Math.cos(a - (e.heading || 0)) > 0.15 ? 0.45 : 1;
  }

  function telegraph(g, e) {
    if (!e.action || e.action.hit) return;
    const u = units[e.unit];
    if (!u) return;
    const a = e.action, angle = Math.atan2(a.aim.y - e.y, a.aim.x - e.x);
    g.save();
    g.translate(e.x, e.y);
    g.rotate(angle);
    g.fillStyle = e.unit === 'crpt' ? 'rgba(255, 214, 0, 0.25)' : e.unit === 'l3' ? 'rgba(0, 230, 118, 0.22)' : e.unit === 'pepsi' ? 'rgba(0, 140, 255, 0.22)' : e.unit === 'mars' ? 'rgba(211, 47, 47, 0.25)' : 'rgba(212, 175, 55, 0.25)';
    g.strokeStyle = u.color;
    g.lineWidth = 2;
    if (e.unit === 'crpt') {
      // 360 degree regulatory shockwave zone
      g.beginPath();
      g.arc(0, 0, u.range, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    } else if (e.unit === 'mars') {
      g.fillRect(0, -12, u.range, 24);
      g.strokeRect(0, -12, u.range, 24);
    } else {
      g.beginPath();
      g.arc(0, 0, u.range, -0.9, 0.9);
      g.lineTo(0, 0);
      g.closePath();
      g.fill();
      g.stroke();
    }
    g.restore();
  }

  function projectile(g, b) {
    g.save();
    g.translate(b.x, b.y);
    if (b.kind === 'l3') {
      g.fillStyle = '#00e676';
      g.fillRect(-5, -5, 10, 10);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1.5;
      g.strokeRect(-5, -5, 10, 10);
      g.fillStyle = '#ffffff';
      g.fillRect(-2, -2, 4, 4);
    } else if (b.kind === 'pepsi') {
      g.fillStyle = '#00e5ff';
      g.beginPath();
      g.arc(0, 0, 6, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = '#ffffff';
      g.fillRect(-2, -2, 4, 4);
    } else if (b.kind === 'crpt') {
      g.fillStyle = '#ffd600';
      g.beginPath();
      g.arc(0, 0, 12, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      g.stroke();
    } else {
      g.fillStyle = '#ff5252';
      g.beginPath();
      g.arc(0, 0, 6, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#ffeb3b';
      g.lineWidth = 2;
      g.stroke();
    }
    g.restore();
  }

  function draw(g, e, sprite) {
    const u = units[e.unit];
    if (!u) return;

    g.save();
    g.translate(Math.round(e.x), Math.round(e.y));

    // Shadow
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath();
    g.ellipse(0, 4, u.r, u.r * 0.45, 0, 0, Math.PI * 2);
    g.fill();

    const hitFlash = e.hit > 0;
    const angle = e.heading || 0;
    const flip = Math.cos(angle) < 0;
    if (flip) g.scale(-1, 1);

    if (e.unit === 'crpt') {
      // ЦРПТ — Large Regulatory Emblem / Fortress Boss
      const size = 36;
      g.fillStyle = hitFlash ? '#ffffff' : '#ffd600';
      g.beginPath();
      // Hexagonal regulatory seal
      for (let i = 0; i < 6; i++) {
        const rad = (i * Math.PI) / 3;
        const hx = Math.cos(rad) * size;
        const hy = Math.sin(rad) * size - 16;
        if (i === 0) g.moveTo(hx, hy);
        else g.lineTo(hx, hy);
      }
      g.closePath();
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = '#102026';
      g.stroke();

      // Outer validation pulse ring if attacking
      if (e.action) {
        g.strokeStyle = '#ffd600bb';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(0, -16, size + 10, 0, Math.PI * 2);
        g.stroke();
      }

      // Inner seal
      g.fillStyle = '#102026';
      g.beginPath();
      g.arc(0, -16, size * 0.68, 0, Math.PI * 2);
      g.fill();

      // CRPT emblem mark
      g.fillStyle = '#ffd600';
      g.font = 'bold 16px Consolas, monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('ЦРПТ', 0, -16);
    } else if (e.unit === 'pepsi') {
      // Пепси — Iconic Blue / White / Red Client Sphere
      const r = 21;
      g.save();
      g.translate(0, -17);
      // Outer border
      g.fillStyle = hitFlash ? '#ffffff' : '#004b93';
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 2.5;
      g.strokeStyle = '#ffffff';
      g.stroke();

      // Top red half
      g.fillStyle = hitFlash ? '#ffffff' : '#e32934';
      g.beginPath();
      g.arc(0, 0, r - 2, Math.PI, 0);
      g.closePath();
      g.fill();

      // Bottom blue half
      g.fillStyle = hitFlash ? '#ffffff' : '#004b93';
      g.beginPath();
      g.arc(0, 0, r - 2, 0, Math.PI);
      g.closePath();
      g.fill();

      // White wave in middle
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(0, 0, r - 2, 5.5, 0.2, 0, Math.PI * 2);
      g.fill();

      // Bubbles & data sparkles
      g.fillStyle = '#ffffffaa';
      g.fillRect(-5, -9, 2.5, 2.5);
      g.fillRect(4, 5, 2.5, 2.5);

      g.restore();
    } else if (e.unit === 'inbev') {
      // Инбев — Heavy Industrial Brewery Tanker
      const w = 38, h = 30;
      g.fillStyle = hitFlash ? '#ffffff' : '#1c1512';
      g.fillRect(-w / 2 - 2, -h - 4, w + 4, h + 8);
      g.fillStyle = hitFlash ? '#ffffff' : '#d4af37';
      g.fillRect(-w / 2, -h - 2, w, h + 4);
      g.lineWidth = 2;
      g.strokeStyle = '#660000';
      g.strokeRect(-w / 2, -h - 2, w, h + 4);

      // Gold badge & label
      g.fillStyle = '#660000';
      g.fillRect(-w / 2 + 4, -h + 2, w - 8, h - 4);
      g.fillStyle = '#ffd700';
      g.font = 'bold 9px sans-serif';
      g.textAlign = 'center';
      g.fillText('INBEV', 0, -h / 2);
    } else if (e.unit === 'mars') {
      // Марс — Red Bold Confectionery / FMCG Box
      const size = 23;
      g.fillStyle = hitFlash ? '#ffffff' : '#d32f2f';
      g.fillRect(-size, -size * 1.5, size * 2, size * 1.5);
      g.lineWidth = 2;
      g.strokeStyle = '#ffeb3b';
      g.strokeRect(-size, -size * 1.5, size * 2, size * 1.5);

      // Mars Gold Text
      g.fillStyle = '#ffeb3b';
      g.font = 'italic 900 13px sans-serif';
      g.textAlign = 'center';
      g.fillText('MARS', 0, -size * 0.7);
    } else if (e.unit === 'l3') {
      // L3 — Green High-Tech Gateway Server Node
      const w = 24, h = 28;
      g.fillStyle = hitFlash ? '#ffffff' : '#081c13';
      g.fillRect(-w / 2, -h, w, h);
      g.lineWidth = 2;
      g.strokeStyle = '#00e676';
      g.strokeRect(-w / 2, -h, w, h);

      // Server LEDs (blinking activity indicators)
      const tick = Math.floor(Date.now() / 180);
      g.fillStyle = tick % 2 === 0 ? '#00e676' : '#69f0ae';
      g.fillRect(-w / 2 + 4, -h + 4, 3, 3);
      g.fillStyle = tick % 3 === 0 ? '#00e676' : '#69f0ae';
      g.fillRect(-w / 2 + 10, -h + 4, 3, 3);
      g.fillStyle = tick % 4 === 0 ? '#00e676' : '#69f0ae';
      g.fillRect(-w / 2 + 16, -h + 4, 3, 3);

      // Status bar line
      g.fillStyle = '#00e67688';
      g.fillRect(-w / 2 + 3, -h + 10, w - 6, 2);

      g.fillStyle = '#69f0ae';
      g.font = 'bold 12px monospace';
      g.textAlign = 'center';
      g.fillText('L3', 0, -h + 21);
    } else {
      // Generic fallback data node
      const w = 22, h = 24;
      g.fillStyle = hitFlash ? '#ffffff' : '#0f272d';
      g.fillRect(-w / 2, -h, w, h);
      g.strokeStyle = '#00e5ff';
      g.lineWidth = 1.5;
      g.strokeRect(-w / 2, -h, w, h);
      g.fillStyle = '#00e5ff';
      g.font = 'bold 10px monospace';
      g.textAlign = 'center';
      g.fillText(u.mark || 'NODE', 0, -h / 2);
    }

    g.restore();

    // Draw unit name label above
    drawLabel(g, u, e.x, e.y - (u.r + 28));
  }

  return {units, mitigation, telegraph, draw, projectile};
})();
