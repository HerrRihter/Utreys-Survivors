'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

function createPNG(width, height, getPixel) {
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    rawData[y * rowSize] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y);
      const idx = y * rowSize + 1 + x * 4;
      rawData[idx] = Math.max(0, Math.min(255, Math.round(r)));
      rawData[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      rawData[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      rawData[idx + 3] = Math.max(0, Math.min(255, Math.round(a)));
    }
  }
  const compressed = zlib.deflateSync(rawData);
  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crcVal = crc32(Buffer.concat([t, data]));
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, t, data, crc]);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
  return Buffer.concat([sig, makeChunk('IHDR', ihdrData), makeChunk('IDAT', compressed), makeChunk('IEND', Buffer.alloc(0))]);
}

// Canvas-like rasterizer in pure Node
class IconRaster {
  constructor(w = 64, h = 64) {
    this.w = w;
    this.h = h;
    this.buf = new Float32Array(w * h * 4);
  }

  setPixel(x, y, r, g, b, a = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const bgA = this.buf[i + 3];
    const outA = a + bgA * (1 - a);
    if (outA <= 0) return;
    this.buf[i] = (r * a + this.buf[i] * bgA * (1 - a)) / outA;
    this.buf[i + 1] = (g * a + this.buf[i + 1] * bgA * (1 - a)) / outA;
    this.buf[i + 2] = (b * a + this.buf[i + 2] * bgA * (1 - a)) / outA;
    this.buf[i + 3] = outA;
  }

  fillCircle(cx, cy, radius, [r, g, b, a = 1]) {
    for (let y = Math.floor(cy - radius - 1); y <= Math.ceil(cy + radius + 1); y++) {
      for (let x = Math.floor(cx - radius - 1); x <= Math.ceil(cx + radius + 1); x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= radius - 0.5) this.setPixel(x, y, r, g, b, a);
        else if (d <= radius + 0.5) {
          const alpha = (radius + 0.5 - d) * a;
          this.setPixel(x, y, r, g, b, alpha);
        }
      }
    }
  }

  strokeCircle(cx, cy, radius, thickness, [r, g, b, a = 1]) {
    const half = thickness / 2;
    for (let y = Math.floor(cy - radius - thickness); y <= Math.ceil(cy + radius + thickness); y++) {
      for (let x = Math.floor(cx - radius - thickness); x <= Math.ceil(cx + radius + thickness); x++) {
        const d = Math.hypot(x - cx, y - cy);
        const dist = Math.abs(d - radius);
        if (dist <= half - 0.5) this.setPixel(x, y, r, g, b, a);
        else if (dist <= half + 0.5) {
          const alpha = (half + 0.5 - dist) * a;
          this.setPixel(x, y, r, g, b, alpha);
        }
      }
    }
  }

  fillRect(x0, y0, w, h, [r, g, b, a = 1]) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        this.setPixel(x, y, r, g, b, a);
      }
    }
  }

  strokeRect(x0, y0, w, h, [r, g, b, a = 1]) {
    for (let x = x0; x < x0 + w; x++) {
      this.setPixel(x, y0, r, g, b, a);
      this.setPixel(x, y0 + h - 1, r, g, b, a);
    }
    for (let y = y0; y < y0 + h; y++) {
      this.setPixel(x0, y, r, g, b, a);
      this.setPixel(x0 + w - 1, y, r, g, b, a);
    }
  }

  drawLine(x0, y0, x1, y1, [r, g, b, a = 1], thickness = 1) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(len * 2);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      if (thickness <= 1) {
        this.setPixel(Math.round(x), Math.round(y), r, g, b, a);
      } else {
        this.fillCircle(x, y, thickness / 2, [r, g, b, a]);
      }
    }
  }

  drawBaseBadge(frameCol = [216, 140, 82]) {
    // Outer shadow / glow
    this.fillCircle(32, 32, 30, [15, 25, 20, 0.95]);
    // Outer border
    this.strokeCircle(32, 32, 29, 2.5, [...frameCol, 1]);
    // Inner bevel
    this.strokeCircle(32, 32, 27, 1.2, [40, 55, 42, 0.9]);
    // Center fill gradient
    for (let y = 4; y < 60; y++) {
      for (let x = 4; x < 60; x++) {
        const d = Math.hypot(x - 32, y - 32);
        if (d < 26.5) {
          const ratio = (y - 6) / 52;
          const bgR = 24 + ratio * 15;
          const bgG = 38 + ratio * 18;
          const bgB = 30 + ratio * 15;
          this.setPixel(x, y, bgR, bgG, bgB, 0.95);
        }
      }
    }
  }

  toPNG() {
    return createPNG(this.w, this.h, (x, y) => {
      const i = (y * this.w + x) * 4;
      return [
        this.buf[i],
        this.buf[i + 1],
        this.buf[i + 2],
        Math.round(this.buf[i + 3] * 255)
      ];
    });
  }
}

// 1. kills-10: Первая стычка (crossed iron gladius shortswords)
function makeKills10() {
  const r = new IconRaster();
  r.drawBaseBadge([180, 140, 90]);
  // Sword 1 (top-left to bottom-right)
  r.drawLine(18, 18, 45, 45, [210, 220, 230], 2.8);
  r.drawLine(20, 20, 43, 43, [255, 255, 255], 1.2); // shine
  r.drawLine(41, 49, 49, 41, [190, 130, 40], 3); // guard
  r.drawLine(44, 44, 52, 52, [140, 40, 30], 2.5); // hilt
  r.fillCircle(53, 53, 2.5, [220, 180, 70]); // pommel
  // Sword 2 (top-right to bottom-left)
  r.drawLine(46, 18, 19, 45, [200, 210, 220], 2.8);
  r.drawLine(44, 20, 21, 43, [245, 250, 255], 1.2); // shine
  r.drawLine(23, 41, 15, 49, [190, 130, 40], 3); // guard
  r.drawLine(20, 44, 12, 52, [140, 40, 30], 2.5); // hilt
  r.fillCircle(11, 53, 2.5, [220, 180, 70]); // pommel
  // Spark at intersection
  r.fillCircle(32, 32, 2.5, [255, 230, 120]);
  r.drawLine(30, 32, 34, 32, [255, 255, 220], 1.5);
  r.drawLine(32, 30, 32, 34, [255, 255, 220], 1.5);
  return r.toPNG();
}

// 2. kills-100: Гроза патрулей (Roman scutum shield with golden wing boss)
function makeKills100() {
  const r = new IconRaster();
  r.drawBaseBadge([220, 160, 60]);
  // Curved shield body (red)
  for (let y = 16; y <= 48; y++) {
    for (let x = 20; x <= 44; x++) {
      const rx = (x - 32) / 12;
      const ry = (y - 32) / 16;
      if (rx * rx * 0.7 + ry * ry * 0.95 <= 1.0) {
        const shade = 140 + (x - 20) * 3;
        r.setPixel(x, y, shade + 30, 35, 30, 1);
      }
    }
  }
  // Shield bronze rim
  r.drawLine(21, 17, 43, 17, [230, 180, 70], 1.8);
  r.drawLine(21, 47, 43, 47, [210, 160, 50], 1.8);
  r.drawLine(20, 17, 20, 47, [200, 150, 40], 1.8);
  r.drawLine(44, 17, 44, 47, [230, 180, 70], 1.8);
  // Center golden umbo (boss)
  r.fillCircle(32, 32, 5, [240, 195, 60]);
  r.fillCircle(31, 31, 2, [255, 245, 180]); // highlight
  // Wings / thunderbolts
  r.drawLine(25, 32, 39, 32, [245, 210, 80], 2);
  r.drawLine(27, 27, 32, 32, [245, 210, 80], 1.5);
  r.drawLine(37, 27, 32, 32, [245, 210, 80], 1.5);
  r.drawLine(27, 37, 32, 32, [245, 210, 80], 1.5);
  r.drawLine(37, 37, 32, 32, [245, 210, 80], 1.5);
  return r.toPNG();
}

// 3. kills-500: Бич легиона (Crossed flaming spatha)
function makeKills500() {
  const r = new IconRaster();
  r.drawBaseBadge([230, 110, 40]);
  // Flaming sword
  r.drawLine(18, 46, 44, 20, [230, 240, 255], 3.2);
  r.drawLine(20, 44, 43, 21, [255, 255, 255], 1.5);
  // Flames around blade
  const flames = [
    [26, 34, 4, [255, 140, 20]],
    [32, 28, 5, [255, 190, 40]],
    [38, 22, 4, [255, 100, 20]],
    [35, 24, 3, [255, 230, 80]],
    [45, 17, 3, [255, 160, 30]]
  ];
  for (const [fx, fy, rad, col] of flames) {
    r.fillCircle(fx, fy, rad, [...col, 0.8]);
  }
  // Sword guard and hilt
  r.drawLine(14, 42, 22, 50, [200, 160, 60], 3);
  r.drawLine(17, 47, 11, 53, [110, 40, 30], 2.8);
  r.fillCircle(10, 54, 2.5, [220, 180, 60]);
  // Sparks
  r.fillCircle(47, 28, 1.5, [255, 220, 100]);
  r.fillCircle(30, 18, 1.5, [255, 200, 80]);
  r.fillCircle(42, 36, 1.5, [255, 170, 60]);
  return r.toPNG();
}

// 4. kills-1000: Легенда Галлии (Golden royal Gaulish laurel wreath & torc)
function makeKills1000() {
  const r = new IconRaster();
  r.drawBaseBadge([246, 203, 114]);
  // Golden laurel wreath leaves left side
  for (let a = -1.2; a <= 1.2; a += 0.35) {
    const lx = 32 - Math.cos(a) * 14;
    const ly = 32 + Math.sin(a) * 14;
    r.fillCircle(lx, ly, 3.2, [240, 190, 50]);
    r.fillCircle(lx - 1, ly - 1, 1.5, [255, 235, 140]);
  }
  // Golden laurel wreath leaves right side
  for (let a = -1.2; a <= 1.2; a += 0.35) {
    const rx = 32 + Math.cos(a) * 14;
    const ry = 32 + Math.sin(a) * 14;
    r.fillCircle(rx, ry, 3.2, [240, 190, 50]);
    r.fillCircle(rx + 1, ry - 1, 1.5, [255, 235, 140]);
  }
  // Central crown / gem
  r.strokeCircle(32, 32, 8, 2, [255, 220, 80]);
  r.fillCircle(32, 32, 6, [210, 50, 40]);
  r.fillCircle(31, 30, 2, [255, 160, 150]);
  // Bottom ribbon
  r.drawLine(27, 46, 37, 46, [220, 170, 50], 2.5);
  r.drawLine(27, 46, 23, 51, [200, 150, 40], 2);
  r.drawLine(37, 46, 41, 51, [200, 150, 40], 2);
  return r.toPNG();
}

// 5. kills-2500: Кошмар Цезаря (Shattered Roman Aquila standard struck by lightning)
function makeKills2500() {
  const r = new IconRaster();
  r.drawBaseBadge([235, 80, 70]);
  // Golden eagle wings
  r.drawLine(18, 26, 32, 30, [240, 190, 60], 3);
  r.drawLine(46, 24, 32, 30, [230, 175, 50], 3);
  r.fillCircle(32, 28, 4, [245, 200, 70]); // eagle body
  r.drawLine(32, 30, 32, 50, [190, 140, 40], 2.8); // standard pole
  // Lightning bolt striking through
  const bolt = [[33, 14], [28, 24], [34, 25], [29, 36], [36, 37], [30, 48]];
  for (let b = 0; b < bolt.length - 1; b++) {
    r.drawLine(bolt[b][0], bolt[b][1], bolt[b+1][0], bolt[b+1][1], [255, 255, 200], 2.2);
    r.drawLine(bolt[b][0], bolt[b][1], bolt[b+1][0], bolt[b+1][1], [180, 220, 255], 3.8);
  }
  // Crack sparks
  r.fillCircle(33, 27, 2, [255, 255, 255]);
  r.fillCircle(25, 22, 1.5, [255, 230, 100]);
  r.fillCircle(39, 32, 1.5, [255, 230, 100]);
  return r.toPNG();
}

// 6. survive-run-60: Первый натиск (1 min hourglass / sand timer)
function makeSurviveRun60() {
  const r = new IconRaster();
  r.drawBaseBadge([140, 180, 210]);
  // Hourglass top & bottom wood plates
  r.fillRect(20, 16, 24, 3, [160, 110, 50]);
  r.fillRect(20, 45, 24, 3, [160, 110, 50]);
  // Pillars
  r.drawLine(22, 18, 22, 46, [210, 165, 75], 1.8);
  r.drawLine(42, 18, 42, 46, [210, 165, 75], 1.8);
  // Glass bulb top
  r.drawLine(24, 20, 32, 31, [180, 220, 250], 1.8);
  r.drawLine(40, 20, 32, 31, [180, 220, 250], 1.8);
  // Glass bulb bottom
  r.drawLine(32, 32, 24, 43, [180, 220, 250], 1.8);
  r.drawLine(32, 32, 40, 43, [180, 220, 250], 1.8);
  // Sand top
  r.fillCircle(32, 24, 4.5, [240, 205, 80]);
  // Falling sand line
  r.drawLine(32, 29, 32, 38, [245, 215, 90], 1.2);
  // Sand bottom heap
  r.fillCircle(32, 40, 5.5, [235, 195, 75]);
  // Time numeral / badge
  r.fillRect(28, 49, 8, 2, [240, 200, 80]);
  return r.toPNG();
}

// 7. survive-run-180: Крепкий орешек (Menhir monolith with Celtic spiral)
function makeSurviveRun180() {
  const r = new IconRaster();
  r.drawBaseBadge([150, 170, 150]);
  // Menhir stone body
  for (let y = 17; y <= 47; y++) {
    const width = 8 + (y - 17) * 0.45;
    for (let x = Math.floor(32 - width); x <= Math.ceil(32 + width); x++) {
      const shade = 120 + Math.sin(x * 0.5) * 15 + Math.cos(y * 0.4) * 10;
      r.setPixel(x, y, shade, shade + 8, shade, 1);
    }
  }
  // Menhir highlight edge
  for (let y = 18; y <= 46; y++) {
    const leftX = Math.floor(32 - (8 + (y - 17) * 0.45));
    r.setPixel(leftX + 1, y, 175, 185, 175, 1);
  }
  // Celtic green spiral carving on stone
  r.strokeCircle(32, 33, 4.5, 1.4, [90, 190, 110]);
  r.strokeCircle(33, 33, 2, 1.2, [120, 220, 140]);
  // Grass at base
  r.drawLine(18, 48, 46, 48, [60, 120, 50], 2.5);
  r.drawLine(20, 47, 24, 45, [80, 150, 60], 1.5);
  r.drawLine(40, 47, 43, 45, [80, 150, 60], 1.5);
  return r.toPNG();
}

// 8. survive-run-300: Дожить до пира (Roast boar feast platter)
function makeSurviveRun300() {
  const r = new IconRaster();
  r.drawBaseBadge([220, 150, 60]);
  // Bronze feast platter
  r.fillRect(16, 42, 32, 3, [210, 160, 60]);
  r.drawLine(14, 43, 50, 43, [235, 185, 80], 1.8);
  // Roast boar main body
  for (let y = 23; y <= 40; y++) {
    for (let x = 20; x <= 44; x++) {
      const rx = (x - 32) / 11;
      const ry = (y - 32) / 8;
      if (rx * rx + ry * ry <= 1.0) {
        const roast = 160 - (y - 23) * 3 + Math.sin(x) * 10;
        r.setPixel(x, y, roast + 20, 75, 30, 1);
      }
    }
  }
  // Boar roast leg bone
  r.drawLine(41, 28, 48, 23, [240, 235, 215], 2.8);
  r.fillCircle(49, 22, 2.2, [245, 240, 225]);
  r.fillCircle(47, 21, 2.2, [245, 240, 225]);
  // Roast boar snout & tusks
  r.fillRect(17, 31, 5, 4, [140, 60, 25]);
  r.drawLine(18, 30, 16, 27, [250, 245, 220], 1.5); // tusk
  // Steam / feast aroma curls
  r.drawLine(26, 20, 28, 16, [240, 230, 180, 0.7], 1.2);
  r.drawLine(34, 19, 36, 15, [240, 230, 180, 0.7], 1.2);
  return r.toPNG();
}

// 9. survive-total-600: Выжить 10 минут (Golden Celtic Sundial)
function makeSurviveTotal600() {
  const r = new IconRaster();
  r.drawBaseBadge([240, 195, 75]);
  // Sundial golden outer face
  r.fillCircle(32, 32, 16, [215, 165, 55]);
  r.strokeCircle(32, 32, 16, 2, [250, 215, 95]);
  r.strokeCircle(32, 32, 12, 1, [170, 125, 40]);
  // Sunburst hour markers
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    const x0 = 32 + Math.cos(a) * 12;
    const y0 = 32 + Math.sin(a) * 12;
    const x1 = 32 + Math.cos(a) * 15;
    const y1 = 32 + Math.sin(a) * 15;
    r.drawLine(x0, y0, x1, y1, [255, 235, 130], 1.5);
  }
  // Gnomon shadow & needle
  r.drawLine(32, 32, 24, 25, [90, 60, 25], 2.2); // shadow
  r.drawLine(32, 32, 36, 22, [255, 245, 170], 2.5); // golden pin
  r.fillCircle(32, 32, 3, [245, 210, 80]); // center hub
  return r.toPNG();
}

// 10. boss-centurion: Падение Максимуса (Centurion helmet with red crest plume)
function makeBossCenturion() {
  const r = new IconRaster();
  r.drawBaseBadge([220, 70, 60]);
  // Scarlet crest plume (horizontal crest)
  for (let x = 18; x <= 46; x++) {
    const h = 5 + Math.sin((x - 18) / 28 * Math.PI) * 4;
    for (let y = 14; y <= 14 + h; y++) {
      r.setPixel(x, y, 220, 40, 40, 1);
    }
  }
  r.drawLine(18, 14, 46, 14, [255, 100, 90], 1.5); // crest highlight
  // Bronze helmet bowl
  r.fillCircle(32, 29, 10, [210, 165, 55]);
  r.fillCircle(30, 27, 4, [245, 210, 95]); // shine
  // Brow band
  r.fillRect(22, 28, 20, 3, [230, 185, 70]);
  // Cheek guards
  r.fillRect(23, 31, 4, 8, [190, 145, 45]);
  r.fillRect(37, 31, 4, 8, [190, 145, 45]);
  // Neck guard
  r.fillRect(20, 34, 24, 2, [170, 130, 40]);
  // Slain / skull mark or laurel
  r.strokeCircle(32, 35, 2, 1, [100, 30, 30]);
  return r.toPNG();
}

// 11. unlock-all-heroes: Деревня в сборе (Winged Asterix helmet + Gaul gathering)
function makeUnlockAllHeroes() {
  const r = new IconRaster();
  r.drawBaseBadge([100, 190, 140]);
  // Winged helmet (center)
  // Wings left
  r.drawLine(24, 28, 16, 18, [245, 245, 240], 2.8);
  r.drawLine(25, 29, 18, 23, [220, 220, 215], 2);
  // Wings right
  r.drawLine(40, 28, 48, 18, [245, 245, 240], 2.8);
  r.drawLine(39, 29, 46, 23, [220, 220, 215], 2);
  // Helmet bowl
  r.fillCircle(32, 31, 8, [180, 130, 40]);
  r.fillCircle(30, 29, 3, [225, 180, 70]);
  // Group circle of 5 hero colored gems around
  const gems = [
    [20, 42, [230, 60, 50]],   // Obelix red
    [26, 46, [50, 130, 230]],  // Panoramix blue
    [32, 48, [240, 200, 50]],  // Asterix gold
    [38, 46, [140, 80, 200]],  // Cacofonix purple
    [44, 42, [70, 180, 90]]    // Automatix green
  ];
  for (const [gx, gy, col] of gems) {
    r.fillCircle(gx, gy, 3, col);
    r.fillCircle(gx, gy, 1, [255, 255, 255]);
  }
  return r.toPNG();
}

// 12. helmets-100: Трофейная казна (Hoard chest overflowing with helmets)
function makeHelmets100() {
  const r = new IconRaster();
  r.drawBaseBadge([240, 180, 50]);
  // Wooden chest body
  r.fillRect(18, 33, 28, 14, [130, 75, 35]);
  r.strokeRect(18, 33, 28, 14, [80, 45, 20]);
  // Bronze chest bands
  r.fillRect(23, 33, 3, 14, [210, 160, 60]);
  r.fillRect(38, 33, 3, 14, [210, 160, 60]);
  r.fillRect(30, 37, 4, 5, [235, 190, 70]); // lock
  // Chest open lid
  r.drawLine(16, 33, 22, 23, [150, 90, 45], 3);
  r.drawLine(48, 33, 42, 23, [150, 90, 45], 3);
  // Helmets spilling over
  r.fillCircle(27, 28, 5, [215, 165, 55]);
  r.fillCircle(35, 27, 5, [225, 175, 60]);
  r.fillCircle(31, 23, 4.5, [240, 195, 75]);
  // Helmet red crests
  r.drawLine(25, 24, 29, 23, [220, 50, 40], 1.8);
  r.drawLine(33, 23, 37, 22, [220, 50, 40], 1.8);
  r.drawLine(29, 19, 33, 18, [220, 50, 40], 1.8);
  return r.toPNG();
}

// 13. upgrades-10: Кузница победы (Anvil, hammer, sparks)
function makeUpgrades10() {
  const r = new IconRaster();
  r.drawBaseBadge([210, 120, 50]);
  // Anvil base & waist
  r.fillRect(22, 42, 20, 5, [90, 95, 105]);
  r.fillRect(26, 37, 12, 6, [110, 115, 125]);
  // Anvil horn (left) & body
  r.fillRect(20, 32, 24, 6, [130, 135, 145]);
  r.drawLine(20, 32, 14, 34, [140, 145, 155], 2.5); // horn tip
  r.drawLine(20, 32, 44, 32, [180, 185, 195], 1.5); // top shine
  // Smith hammer striking
  r.drawLine(44, 18, 33, 29, [140, 85, 40], 2.5); // wooden handle
  r.fillRect(30, 27, 7, 5, [160, 165, 175]); // hammer head
  // Glowing hot steel on anvil
  r.fillRect(27, 30, 6, 3, [255, 120, 30]);
  r.fillRect(28, 31, 4, 2, [255, 230, 90]);
  // Flying orange sparks
  r.fillCircle(24, 27, 1.2, [255, 200, 60]);
  r.fillCircle(29, 24, 1.2, [255, 180, 40]);
  r.fillCircle(38, 25, 1.2, [255, 220, 80]);
  return r.toPNG();
}

// 14. abilities-25: Сила друидов (Magic potion cauldron, flask, green-gold vapor)
function makeAbilities25() {
  const r = new IconRaster();
  r.drawBaseBadge([70, 200, 160]);
  // Bronze cauldron legs
  r.drawLine(22, 43, 20, 48, [150, 110, 50], 2.5);
  r.drawLine(42, 43, 44, 48, [150, 110, 50], 2.5);
  // Bronze cauldron pot body
  r.fillCircle(32, 38, 12, [170, 125, 55]);
  r.fillCircle(32, 37, 10, [130, 90, 40]);
  // Cauldron rim
  r.fillRect(20, 29, 24, 3, [200, 150, 65]);
  // Bubbling magic potion (glowing emerald & golden)
  r.fillRect(22, 30, 20, 4, [40, 200, 130]);
  r.fillCircle(26, 30, 2.5, [70, 235, 160]);
  r.fillCircle(33, 29, 3, [120, 255, 190]);
  r.fillCircle(39, 30, 2.5, [70, 235, 160]);
  // Magic bubbles rising
  r.fillCircle(25, 24, 2, [130, 255, 200]);
  r.fillCircle(34, 21, 2.5, [180, 255, 220]);
  r.fillCircle(30, 16, 1.8, [150, 255, 210]);
  r.fillCircle(38, 18, 1.5, [255, 240, 130]); // golden sparkle
  // Magic mist wisps
  r.drawLine(24, 19, 28, 14, [100, 240, 180, 0.6], 1.2);
  r.drawLine(35, 15, 33, 11, [140, 255, 200, 0.6], 1.2);
  return r.toPNG();
}

const icons = {
  'kills-10.png': makeKills10,
  'kills-100.png': makeKills100,
  'kills-500.png': makeKills500,
  'kills-1000.png': makeKills1000,
  'kills-2500.png': makeKills2500,
  'survive-run-60.png': makeSurviveRun60,
  'survive-run-180.png': makeSurviveRun180,
  'survive-run-300.png': makeSurviveRun300,
  'survive-total-600.png': makeSurviveTotal600,
  'boss-centurion.png': makeBossCenturion,
  'unlock-all-heroes.png': makeUnlockAllHeroes,
  'helmets-100.png': makeHelmets100,
  'upgrades-10.png': makeUpgrades10,
  'abilities-25.png': makeAbilities25
};

const dirs = [
  path.resolve(__dirname, '../assets/runtime/ui/achievements')
];

for (const dir of dirs) {
  fs.mkdirSync(dir, { recursive: true });
}

for (const [name, generator] of Object.entries(icons)) {
  const buf = generator();
  for (const dir of dirs) {
    fs.writeFileSync(path.join(dir, name), buf);
  }
  console.log(`Generated: ${name} (${buf.length} bytes)`);
}

console.log('All 14 achievement icons successfully generated in assets/runtime/ui/achievements!');
