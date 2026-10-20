// `summary` is the hero select and shop line; `details` the encyclopedia's exact account.
const degrees = (half) => Math.round((half * 2 * 180) / Math.PI) + '°';
const decimal = (n) => String(n).replace('.', ',');

export const heroDefinitions = {
  utrace: {
    name: 'Utrace',
    attack: 'sector',
    range: 70,
    push: 145,
    color: '#009dbb',
    hp: 120,
    speed: 150,
    interval: 0.65,
    wind: 0.35,
    damage: 28,
    half: Math.PI / 4,
    weapon: 'Трассировка кодов',
    // Played when the hero starts an attack.
    swingSound: 'punchSwing',
    summary: 'Бьёт сектором перед собой и отбрасывает врагов.',
    get details() {
      return `Удар сектором ${degrees(this.half)} на ${this.range} px перед героем, раз в ${decimal(this.interval)} с, отбрасывает врагов.`;
    },
  },
  traceability: {
    name: 'Полная прослеживаемость',
    hp: 110,
    speed: 145,
    interval: 0.9,
    wind: 0.4,
    damage: 24,
    range: 115,
    push: 60,
    attack: 'chain',
    // Targets per strike; null restores the uncapped whole-group chain.
    chainLimit: 6,
    color: '#6de2cd',
    weapon: 'Цепочка прослеживаемости',
    summary: 'Цепь перескакивает между стоящими рядом врагами.',
    get details() {
      return `Цепь поражает до ${this.chainLimit} целей; следующая цель — не дальше ${this.range} px от предыдущей. Каждая цель получает полный урон один раз.`;
    },
  },
  serialization: {
    name: 'Сериализация',
    hp: 100,
    speed: 160,
    interval: 0.75,
    wind: 0.28,
    damage: 23,
    range: 310,
    push: 60,
    attack: 'packet',
    color: '#fa5946',
    weapon: 'Серийный пакет',
    summary: 'Стреляет пробивающим пакетом издалека.',
    get details() {
      return `Пакет летит на ${this.range} px по направлению движения и задевает каждую цель на пути один раз.`;
    },
  },
  ba: {
    name: 'БА',
    hp: 135,
    speed: 140,
    interval: 0.85,
    wind: 0.4,
    damage: 26,
    half: (Math.PI * 2) / 5,
    range: 85,
    push: 230,
    // Picks a key client before the run (data/characters/ba-specialization.js).
    keyClient: true,
    attack: 'sector',
    color: '#f7ce70',
    weapon: 'Разбор требований',
    summary: 'Танк: выбирает клиента и крепнет, побеждая его.',
    get details() {
      return `Перед забегом выбирает клиента: каждое его убийство даёт +1 к текущему и максимальному HP до конца забега. Бьёт сектором ${degrees(this.half)} на ${this.range} px.`;
    },
  },
  qa: {
    name: 'QA',
    hp: 115,
    speed: 150,
    interval: 1.05,
    wind: 0.42,
    damage: 19,
    half: Math.PI,
    range: 90,
    push: 70,
    attack: 'scan',
    color: '#79edbd',
    weapon: 'Регрессионная проверка',
    summary: 'Сканирует область вокруг и сбивает атаки обычных врагов.',
    get details() {
      return `Проверяет квадрат ${this.range * 2}×${this.range * 2} px вокруг себя, отмечает цели и прерывает обычных врагов на 0,6 с. Боссы устойчивы к прерыванию.`;
    },
  },
};
