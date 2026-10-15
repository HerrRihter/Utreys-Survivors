import { neonStroke } from '../neon.js';
// Original Canvas interpretations of brand motifs; no external images or fonts.
// Coordinates are local to the actor. Wordmarks stay readable in both directions.
export const clientEmblems = {
  mars_petfood: (g) => {
    disc(g, 0, -21, 25, '#123ba5', '#73d9ed');
    word(g, 'MARS', 0, -26, 13, '#ffffff');
    ellipse(g, 0, -13, 6, 4, '#73d9ed');
    for (const [x, y] of [
      [-7, -18],
      [-2, -21],
      [3, -21],
      [8, -18],
    ])
      disc(g, x, y, 2.3, '#73d9ed');
  },
  baltika: (g) => {
    ellipse(g, 0, -22, 25, 29, '#072d72', '#e5c76f');
    word(g, 'Балтика', 0, -29, 11, '#ffffff', 'italic bold');
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = '#e5c76f';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-17, -18 + i * 6);
      g.bezierCurveTo(-6, -25 + i * 6, 6, -11 + i * 6, 17, -18 + i * 6);
      g.stroke();
    }
  },
  multon: (g) => {
    polygon(
      g,
      [
        [-24, -34],
        [-10, -47],
        [18, -42],
        [27, -17],
        [14, 0],
        [-18, -3],
      ],
      '#a9b6ad',
      '#ef833f',
    );
    ellipse(g, 12, -36, 9, 4, '#53ab55');
    word(g, 'multon', 0, -24, 12, '#154c72');
    word(g, 'partners', 0, -12, 7, '#154c72');
    disc(g, -17, -8, 3, '#f7ad31');
  },
  loreal: (g) => {
    polygon(
      g,
      [
        [-29, -36],
        [25, -36],
        [29, -5],
        [-25, -5],
      ],
      '#14131c',
      '#e8b9cb',
    );
    g.fillStyle = '#e8b9cb';
    g.fillRect(-21, -31, 42, 1);
    word(g, 'L’ORÉAL', 0, -21, 11, '#ffffff', 'normal');
    word(g, 'PARIS', 0, -11, 6, '#e8b9cb');
    sparkle(g, 25, -37, '#ffffff');
  },
  procter_gamble: (g) => {
    disc(g, 0, -22, 27, '#0753ba', '#83c7ff');
    g.strokeStyle = '#83c7ff';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, -22, 22, 0.7, 4.2);
    g.stroke();
    word(g, 'P&G', 0, -21, 20, '#ffffff', 'italic bold', 'Georgia, serif');
  },
  progress: (g) => {
    ellipse(g, 0, -22, 28, 25, '#b6c6b8', '#4e8b51');
    ellipse(g, 9, -46, 9, 4, '#70bb44');
    const colors = ['#ec4050', '#f2a52c', '#5baf45', '#2595c6', '#985bb7'];
    [...'Фруто'].forEach((letter, i) => word(g, letter, -19 + i * 9.5, -28, 14, colors[i]));
    word(g, 'Няня', 0, -13, 16, '#db365d');
    g.strokeStyle = '#79b859';
    g.beginPath();
    g.arc(0, -12, 15, 0.35, Math.PI - 0.35);
    g.stroke();
  },
  royal_canin: (g) => {
    ellipse(g, 0, -21, 29, 26, '#b9c4ba', '#ce2942');
    polygon(
      g,
      [
        [-15, -29],
        [-18, -40],
        [-8, -34],
        [0, -45],
        [8, -34],
        [18, -40],
        [15, -29],
      ],
      '#cf233c',
    );
    for (const [x, y] of [
      [-18, -41],
      [0, -46],
      [18, -41],
    ])
      disc(g, x, y, 2, '#cf233c');
    word(g, 'ROYAL', 0, -20, 10, '#cf233c');
    word(g, 'CANIN', 0, -9, 10, '#cf233c');
  },
  cherkizovo: (g) => {
    polygon(
      g,
      [
        [-28, -39],
        [28, -39],
        [24, -9],
        [0, 4],
        [-24, -9],
      ],
      '#ad153d',
      '#f5c2ac',
    );
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-8, -32);
    g.lineTo(-8, -24);
    g.lineTo(7, -24);
    g.moveTo(7, -32);
    g.lineTo(7, -15);
    g.stroke();
    word(g, 'ЧЕРКИЗОВО', 0, -7, 7, '#ffffff');
  },
  ferrero: (g) => {
    ellipse(g, 0, -22, 31, 22, '#b7b29b', '#c4a565');
    ellipse(g, 0, -22, 27, 18, '#b7b29b', '#684224');
    word(g, 'FERRERO', 0, -22, 11, '#57351e', 'bold', 'Georgia, serif');
    g.strokeStyle = '#c4a565';
    g.beginPath();
    g.moveTo(-16, -13);
    g.lineTo(16, -13);
    g.stroke();
  },
  mondelez: (g) => {
    ellipse(g, 0, -22, 32, 23, '#4e247a', '#bda0e3');
    word(g, 'mondelēz', 0, -26, 11, '#ffffff', 'italic bold');
    word(g, 'international', 0, -15, 6, '#f0dffc');
    g.strokeStyle = '#ee537b';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, -15, 14, 0.45, Math.PI - 0.45);
    g.stroke();
  },
  vetis: (g) => {
    polygon(
      g,
      [
        [0, -49],
        [25, -39],
        [22, -10],
        [0, 5],
        [-22, -10],
        [-25, -39],
      ],
      '#114f47',
      '#8edbb9',
    );
    g.strokeStyle = '#f1d882';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(0, -42);
    g.lineTo(0, -17);
    g.stroke();
    g.beginPath();
    g.moveTo(6, -39);
    g.bezierCurveTo(-16, -37, 15, -28, -5, -22);
    g.stroke();
    word(g, 'ВЕТИС', 0, -8, 9, '#ffffff');
  },
};

function word(g, text, x, y, size, color, weight = 'bold', family = 'Arial, sans-serif') {
  g.font = `${weight} ${size}px ${family}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(text, x, y);
}
function ellipse(g, x, y, rx, ry, fill, stroke) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    neonStroke(g, stroke, 1.5, 5);
  }
}
function disc(g, x, y, r, fill, stroke) {
  ellipse(g, x, y, r, r, fill, stroke);
}
function polygon(g, points, fill, stroke) {
  g.beginPath();
  points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    neonStroke(g, stroke, 1.5, 5);
  }
}
function sparkle(g, x, y, color) {
  polygon(
    g,
    [
      [x, y - 5],
      [x + 2, y - 1],
      [x + 5, y],
      [x + 2, y + 1],
      [x, y + 5],
      [x - 2, y + 1],
      [x - 5, y],
      [x - 2, y - 1],
    ],
    color,
  );
}

export function drawClientEmblem(g, e) {
  const draw = clientEmblems[e.unit];
  if (!draw) return false;
  g.save();
  // Cancel actor mirroring for lettering; direction remains visible in the attack telegraph.
  if (Math.cos(e.heading || 0) < 0) g.scale(-1, 1);
  draw(g);
  if (e.hit > 0) {
    g.globalAlpha = 0.65;
    ellipse(g, 0, -22, 29, 24, '#ffffff');
  }
  g.restore();
  return true;
}
