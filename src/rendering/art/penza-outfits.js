// The hidden Penza mode's enemy outfits, put on over each unit's own art: a leather jacket
// with a melee weapon and maybe a flat cap, or a militia peaked cap with shoulder boards.
// Shooters (by attack style) carry a pistol instead. `box` is the art's drawn bounds around
// the feet (0, 0), facing right. The look is picked from the enemy's id, so one enemy keeps
// its outfit for its whole life.

const jackets = ['#2a1a12', '#141414', '#3b2417', '#1d1a24'];
const caps = ['#4a4036', '#2f2b27', '#5a4a3a'];
const meleeWeapons = ['bat', 'knife', 'flail', 'saw', 'rose'];
const rangedAttacks = ['projectile', 'mortar'];

// A small integer hash: neighbouring ids get unrelated looks.
function mix(n) {
  let h = (n | 0) * 0x45d9f3b;
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  return ((h >>> 16) ^ h) >>> 0;
}

export function penzaLook(e, u) {
  const h = mix((e.id ?? 0) + 1),
    ranged = rangedAttacks.includes(u.attack);
  if (h % 10 < 3) {
    const weapon = ranged ? 'pistol' : (h >>> 4) % 2 ? 'baton' : null;
    return { kind: 'militia', weapon, key: 'm' + weapon };
  }
  const jacket = (h >>> 4) % jackets.length,
    weapon = ranged ? 'pistol' : meleeWeapons[(h >>> 8) % meleeWeapons.length],
    cap = (h >>> 12) % 5 < 2 ? -1 : (h >>> 14) % caps.length;
  return { kind: 'thug', jacket, weapon, cap, key: 't' + jacket + weapon + cap };
}

function rect(g, color, x, y, w, h) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

// Weapons are drawn from the grip at (0, 0), pointing up and forward.
function bat(g) {
  g.rotate(-0.9);
  g.fillStyle = '#b07a42';
  g.beginPath();
  g.moveTo(-2, -1.5);
  g.lineTo(26, -4);
  g.lineTo(28, 0);
  g.lineTo(26, 4);
  g.lineTo(-2, 1.5);
  g.closePath();
  g.fill();
  rect(g, '#3a2414', -4, -2, 5, 4);
}

function knife(g) {
  rect(g, '#1a1a1a', -3, -2.5, 8, 5);
  rect(g, '#9aa4ab', 4, -4, 2, 8);
  g.fillStyle = '#e3eaee';
  g.beginPath();
  g.moveTo(6, -3);
  g.lineTo(22, -1.5);
  g.lineTo(6, 3);
  g.closePath();
  g.fill();
}

function flail(g) {
  // A short handle, a chain and a spiked ball.
  g.strokeStyle = '#6d4c2f';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 1);
  g.lineTo(5, -12);
  g.stroke();
  g.fillStyle = '#9aa4ab';
  for (let i = 1; i <= 4; i++) g.fillRect(5 + i * 2.2 - 1, -12 + i * 1.6 - 1, 2, 2);
  g.fillStyle = '#7d888e';
  g.beginPath();
  g.arc(16, -4, 5, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#9aa4ab';
  g.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    g.beginPath();
    g.moveTo(16 + Math.cos(a) * 4, -4 + Math.sin(a) * 4);
    g.lineTo(16 + Math.cos(a) * 7, -4 + Math.sin(a) * 7);
    g.stroke();
  }
}

function baton(g) {
  g.rotate(0.5);
  rect(g, '#111111', -1, -2, 18, 4);
}

// A handheld circular saw: the guard and handle over a toothed disc.
function saw(g) {
  g.fillStyle = '#b0bec5';
  g.beginPath();
  g.arc(14, -4, 9, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#78909c';
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    g.beginPath();
    g.moveTo(14 + Math.cos(a) * 8.5, -4 + Math.sin(a) * 8.5);
    g.lineTo(14 + Math.cos(a + 0.2) * 11.5, -4 + Math.sin(a + 0.2) * 11.5);
    g.lineTo(14 + Math.cos(a + 0.45) * 8.5, -4 + Math.sin(a + 0.45) * 8.5);
    g.closePath();
    g.fill();
  }
  rect(g, '#455a64', 12.5, -5.5, 3, 3);
  // Guard over the top half and the handle
  g.fillStyle = '#f9a825';
  g.beginPath();
  g.arc(14, -4, 10, Math.PI, Math.PI * 1.9);
  g.lineTo(14, -4);
  g.closePath();
  g.fill();
  rect(g, '#212121', -3, -3, 12, 6);
}

// A broken bottle held by the neck, the jagged edge forward.
function rose(g) {
  g.fillStyle = '#2e7d32cc';
  g.beginPath();
  g.moveTo(-3, -2);
  g.lineTo(6, -2);
  g.lineTo(9, -5);
  g.lineTo(19, -5);
  g.lineTo(22, -8);
  g.lineTo(21, -3);
  g.lineTo(25, -1);
  g.lineTo(20, 1);
  g.lineTo(23, 5);
  g.lineTo(18, 4);
  g.lineTo(9, 5);
  g.lineTo(6, 2);
  g.lineTo(-3, 2);
  g.closePath();
  g.fill();
  rect(g, '#c8e6c966', 9, -3.5, 9, 1.5);
}

// A pistol held level, the muzzle forward.
function pistol(g) {
  rect(g, '#2b2b2b', -2, -6, 17, 5);
  rect(g, '#555555', -1, -6, 15, 1.5);
  rect(g, '#1a1a1a', -2, -1, 5, 7);
  g.strokeStyle = '#1a1a1a';
  g.lineWidth = 1.2;
  g.strokeRect(3, -1, 4, 3);
}

const weaponArt = { bat, knife, flail, saw, rose, pistol, baton };

// The open leather jacket: two front panels with lapels down the body's sides, so the
// unit's own face or logo stays visible in the middle.
function jacket(g, box, color) {
  const w = box.right - box.left,
    h = box.bottom - box.top,
    top = box.top + h * 0.3,
    bottom = box.bottom - 1,
    panel = Math.max(5, w * 0.22),
    lapel = Math.min(10, h * 0.2);
  for (const side of [-1, 1]) {
    const edge = side < 0 ? box.left - 2 : box.right + 2,
      inner = edge - side * (panel + 2);
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(edge, top);
    g.lineTo(inner, top);
    g.lineTo(inner + side * 3, top + lapel);
    g.lineTo(inner, bottom);
    g.lineTo(edge, bottom);
    g.closePath();
    g.fill();
    // Lapel and leather shine
    g.fillStyle = '#00000066';
    g.beginPath();
    g.moveTo(inner, top);
    g.lineTo(inner + side * 3, top + lapel);
    g.lineTo(inner + side * 7, top);
    g.closePath();
    g.fill();
    rect(g, '#ffffff22', edge - side * 4 - 1, top + 3, 2, (bottom - top) * 0.6);
  }
}

// Headwear sits on the top edge of the art, as wide as the body allows.
function capSize(box) {
  return {
    cx: (box.left + box.right) / 2,
    half: Math.max(9, Math.min(16, (box.right - box.left) * 0.4)),
    y: box.top + 3,
  };
}

function flatCap(g, box, color) {
  const { cx, half, y } = capSize(box);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(cx - half, y);
  g.quadraticCurveTo(cx - half, y - 9, cx, y - 8.5);
  g.quadraticCurveTo(cx + half, y - 8, cx + half + 6, y - 1);
  g.lineTo(cx - half, y);
  g.closePath();
  g.fill();
  rect(g, '#00000055', cx - half, y - 1.5, half * 2 + 5, 1.5);
}

function peakedCap(g, box) {
  const { cx, half, y } = capSize(box);
  g.fillStyle = '#3d5068';
  g.beginPath();
  g.ellipse(cx, y - 8, half + 3, 4, 0, 0, Math.PI * 2);
  g.fill();
  rect(g, '#c62828', cx - half, y - 7, half * 2, 4);
  rect(g, '#0b0b0b', cx + half * 0.3, y - 3.5, half * 0.9, 2.5);
  rect(g, '#d4af37', cx - 1.5, y - 7, 3, 3.5);
}

function shoulderBoards(g, box) {
  const y = box.top + (box.bottom - box.top) * 0.3;
  for (const x of [box.left - 3, box.right - 9]) {
    rect(g, '#d4af37', x, y, 12, 4);
    rect(g, '#c62828', x, y + 1.5, 12, 1);
  }
}

export function drawPenzaOutfit(g, box, look, flash) {
  g.save();
  if (flash) g.globalAlpha = 0.5;
  if (look.kind === 'militia') {
    shoulderBoards(g, box);
    peakedCap(g, box);
  } else {
    jacket(g, box, jackets[look.jacket]);
    if (look.cap >= 0) flatCap(g, box, caps[look.cap]);
  }
  const weapon = weaponArt[look.weapon];
  if (weapon) {
    const x = box.right + 2,
      y = box.top + (box.bottom - box.top) * 0.6;
    g.save();
    g.translate(x, y);
    weapon(g);
    g.restore();
    // The fist on the grip
    rect(g, '#e0b58f', x - 2, y - 2, 5, 5);
  }
  g.restore();
}
