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
    g.fillStyle = 'rgba(232, 119, 66, 0.28)';
    g.strokeStyle = u.color;
    g.lineWidth = 2;
    if (e.unit === 'mars') {
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
    g.fillStyle = '#ff5252';
    g.beginPath();
    g.arc(0, 0, 5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
  }

  function draw(g, e, sprite) {
    const u = units[e.unit];
    if (!u) return;

    g.save();
    g.translate(Math.round(e.x), Math.round(e.y));

    // Shadow
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.ellipse(0, 4, u.r, u.r * 0.4, 0, 0, Math.PI * 2);
    g.fill();

    const hitFlash = e.hit > 0;
    const angle = e.heading || 0;
    const flip = Math.cos(angle) < 0;
    if (flip) g.scale(-1, 1);

    if (e.unit === 'crpt') {
      // ЦРПТ — Large Regulatory Emblem / Fortress Boss
      const size = 34;
      g.fillStyle = hitFlash ? '#ffffff' : '#ffd600';
      g.beginPath();
      // Hexagonal regulatory seal
      for (let i = 0; i < 6; i++) {
        const rad = (i * Math.PI) / 3;
        const hx = Math.cos(rad) * size;
        const hy = Math.sin(rad) * size - 15;
        if (i === 0) g.moveTo(hx, hy);
        else g.lineTo(hx, hy);
      }
      g.closePath();
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = '#212121';
      g.stroke();

      // Inner seal
      g.fillStyle = '#212121';
      g.beginPath();
      g.arc(0, -15, size * 0.65, 0, Math.PI * 2);
      g.fill();

      // Yellow checkmark / CRPT mark
      g.fillStyle = '#ffd600';
      g.font = 'bold 15px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('ЦРПТ', 0, -15);
    } else if (e.unit === 'pepsi') {
      // Пепси — Iconic Blue / White / Red Client Sphere
      const r = 20;
      g.save();
      g.translate(0, -16);
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
      g.ellipse(0, 0, r - 2, 5, 0.2, 0, Math.PI * 2);
      g.fill();

      g.restore();
    } else if (e.unit === 'inbev') {
      // Инбев — Heavy Industrial Brewery Tanker
      const w = 36, h = 28;
      g.fillStyle = hitFlash ? '#ffffff' : '#2b1b17';
      g.fillRect(-w / 2 - 2, -h - 4, w + 4, h + 8);
      g.fillStyle = hitFlash ? '#ffffff' : '#d4af37';
      g.fillRect(-w / 2, -h - 2, w, h + 4);
      g.lineWidth = 2;
      g.strokeStyle = '#8b0000';
      g.strokeRect(-w / 2, -h - 2, w, h + 4);

      // Gold badge & label
      g.fillStyle = '#8b0000';
      g.fillRect(-w / 2 + 4, -h + 2, w - 8, h - 4);
      g.fillStyle = '#ffd700';
      g.font = 'bold 9px sans-serif';
      g.textAlign = 'center';
      g.fillText('INBEV', 0, -h / 2);
    } else if (e.unit === 'mars') {
      // Марс — Red Bold Confectionery / FMCG Box
      const size = 22;
      g.fillStyle = hitFlash ? '#ffffff' : '#d32f2f';
      g.fillRect(-size, -size * 1.5, size * 2, size * 1.5);
      g.lineWidth = 2;
      g.strokeStyle = '#ffeb3b';
      g.strokeRect(-size, -size * 1.5, size * 2, size * 1.5);

      // Mars Gold Text
      g.fillStyle = '#ffeb3b';
      g.font = 'italic 900 12px sans-serif';
      g.textAlign = 'center';
      g.fillText('MARS', 0, -size * 0.7);
    } else {
      // L3 — Green High-Tech Gateway Server Node
      const w = 22, h = 26;
      g.fillStyle = hitFlash ? '#ffffff' : '#0a2318';
      g.fillRect(-w / 2, -h, w, h);
      g.lineWidth = 2;
      g.strokeStyle = '#00e676';
      g.strokeRect(-w / 2, -h, w, h);

      // Server LEDs
      g.fillStyle = '#00e676';
      g.fillRect(-w / 2 + 4, -h + 4, 3, 3);
      g.fillRect(-w / 2 + 9, -h + 4, 3, 3);
      g.fillRect(-w / 2 + 14, -h + 4, 3, 3);

      g.fillStyle = '#69f0ae';
      g.font = 'bold 11px monospace';
      g.textAlign = 'center';
      g.fillText('L3', 0, -h + 17);
    }

    g.restore();

    // Draw unit name label above
    drawLabel(g, u, e.x, e.y - (u.r + 28));
  }

  return {units, mitigation, telegraph, draw, projectile};
})();
