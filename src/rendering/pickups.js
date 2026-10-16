// Map pickups and the elite aura. `t` is the run clock for pulsing.
const TAU = Math.PI * 2;

export function drawPickup(g, a, t = 0) {
  const pulse = 1 + Math.sin(t * 6 + a.x) * 0.12;
  g.save();
  g.translate(a.x, a.y);
  if (a.type === 'bundle') {
    g.scale(pulse, pulse);
    g.fillStyle = '#3b2a05';
    g.fillRect(-11, -9, 22, 18);
    g.strokeStyle = '#ffd54f';
    g.lineWidth = 2;
    g.strokeRect(-11, -9, 22, 18);
    g.fillStyle = '#ffd54f';
    g.fillRect(-11, -2, 22, 4);
    g.fillRect(-2, -9, 4, 18);
  } else if (a.type === 'magnet') {
    g.strokeStyle = '#ff5252';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(0, -2, 8, Math.PI, 0);
    g.stroke();
    g.fillStyle = '#e0e0e0';
    g.fillRect(-10, -2, 5, 8);
    g.fillRect(5, -2, 5, 8);
  } else if (a.type === 'bomb') {
    g.fillStyle = '#1b1f24';
    g.beginPath();
    g.arc(0, 0, 9 * pulse, 0, TAU);
    g.fill();
    g.strokeStyle = '#ff8a65';
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = '#ffd54f';
    g.fillRect(-1, -14, 2, 5);
  } else if (a.type === 'freeze') {
    g.strokeStyle = '#80deea';
    g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < 3; i++) {
      const k = (i / 3) * Math.PI;
      g.moveTo(Math.cos(k) * -10 * pulse, Math.sin(k) * -10 * pulse);
      g.lineTo(Math.cos(k) * 10 * pulse, Math.sin(k) * 10 * pulse);
    }
    g.stroke();
  } else {
    // Food: a data/energy recovery capsule.
    g.fillStyle = '#00e5ff';
    g.fillRect(-7, -5, 14, 10);
    g.fillStyle = '#0a192f';
    g.fillRect(-5, -3, 10, 6);
    g.fillStyle = '#64ffda';
    g.fillRect(-3, -1, 6, 2);
  }
  g.restore();
}

export function drawEliteAura(g, e, t = 0) {
  g.save();
  g.strokeStyle = '#ffd54f';
  g.globalAlpha = 0.55 + Math.sin(t * 5 + e.phase) * 0.25;
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(e.x, e.y, e.r + 10, (e.r + 10) * 0.45, 0, 0, TAU);
  g.stroke();
  g.restore();
}
