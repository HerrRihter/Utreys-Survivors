import {
  abilityDefinitions,
  abilityUpgradeDescriptions,
  abilityUpgradeMax,
  abilityUpgradeId,
} from '../../data/characters/abilities.js';
import { permanentUpgradeDefinitions, heroTrainingDefinitions } from '../../data/upgrades.js';
export const UpgradeSystem = {
  create(Progression) {
    const add = (key, value) => (s) => (s.stats[key] = (s.stats[key] || 0) + value);
    const item = (id, name, desc, key, value, max = 3) => ({
      id,
      name,
      desc,
      icon: '✦',
      max,
      apply: add(key, value),
    });
    const common = [
      item('might', 'Сила атаки', '+15% к базовому урону всех атак.', 'damage', 0.15, 5),
      item(
        'tempo',
        'Второе дыхание',
        '+12% к темпу атак и периодического урона.',
        'haste',
        0.12,
        5,
      ),
      item('area', 'Широкий размах', '+12% к размеру оружия и областей урона.', 'range', 0.12, 5),
      item('boots', 'Лёгкий шаг', '+8% к скорости передвижения.', 'speed', 0.08, 5),
      {
        id: 'vitality',
        name: 'Запас здоровья',
        desc: '+20 к максимуму здоровья и восстановление 30 HP.',
        icon: '♥',
        max: 5,
        apply: (s) => {
          s.p.max += 20;
          s.p.hp = Math.min(s.p.max, s.p.hp + 30);
        },
      },
      item('recovery', 'Восстановление', 'Восстановление ещё 0,5 HP в секунду.', 'regen', 0.5, 5),
      item('armor', 'Защита', 'На 1 меньше урона от каждого попадания; минимум 1.', 'armor', 1, 5),
      item(
        'magnet',
        'Притяжение предметов',
        '+30 к радиусу притяжения кодов маркировки и опыта.',
        'magnet',
        30,
        5,
      ),
    ];
    const heroes = {
      utrace: [
        item(
          'punchTempo',
          'Быстрая трассировка',
          '+15% к темпу обработки кодов.',
          'punchTempo',
          0.15,
        ),
        item('punchReach', 'Широкий луч', '+12 к дальности сканирования.', 'punchReach', 12),
        item(
          'punchForce',
          'Импульс верификации',
          '+55 к силе отталкивания запросов.',
          'punchForce',
          55,
        ),
      ],
    };
    for (const [id, name] of Object.entries({
      traceability: 'Цепочка',
      serialization: 'Пакет',
      ba: 'Разбор',
      qa: 'Проверка',
    }))
      heroes[id] = [
        item('punchTempo', name + ': темп', '+15% к темпу основной атаки.', 'punchTempo', 0.15),
        item('punchReach', name + ': охват', '+12 к дальности основной атаки.', 'punchReach', 12),
        item(
          'punchForce',
          name + ': импульс',
          '+55 к отталкиванию основной атаки.',
          'punchForce',
          55,
        ),
      ];
    const abilities = Object.fromEntries(
      Object.entries(abilityDefinitions).map(([hero, defs]) => [
        hero,
        defs.map((a) => ({
          id: abilityUpgradeId(a.id),
          ability: a.id,
          name: a.name,
          desc: abilityUpgradeDescriptions[a.id],
          icon: '◆',
          max: abilityUpgradeMax,
          apply: () => {},
        })),
      ]),
    );
    const fallback = [
      {
        id: 'herbs',
        name: 'Восстановление',
        desc: '+0,1 HP регенерации в секунду.',
        icon: '♥',
        apply: add('regen', 0.1),
      },
      {
        id: 'food',
        name: 'Передышка',
        desc: 'Восстановить всё здоровье.',
        icon: '♥',
        apply: (s) => (s.p.hp = s.p.max),
      },
      {
        id: 'loot',
        name: 'Бонусные коды',
        desc: 'Получить 3 кода маркировки.',
        icon: '◈',
        apply: (s) => {
          Progression.earn(3);
          s.earned += 3;
        },
      },
      {
        id: 'reserve',
        name: 'Запас сил',
        desc: '+5 к максимуму и текущему здоровью.',
        icon: '♥',
        apply: (s) => {
          s.p.max += 5;
          s.p.hp += 5;
        },
      },
    ];
    function pool(hero, s) {
      return [
        ...common.map((u) => ({ ...u, group: 'Общее' })),
        ...(heroes[hero] || []).map((u) => ({ ...u, group: 'Оружие героя' })),
        ...(abilities[hero] || []).map((u) => ({ ...u, group: 'Активное умение' })),
      ].filter((u) => (s.upgradeRanks?.[u.id] || 0) < u.max && (!u.available || u.available(s)));
    }
    function offer(hero, s, random = Math.random) {
      const all = pool(hero, s),
        special = all.filter((u) => u.group === 'Оружие героя'),
        result = [];
      if (special.length) result.push(special[Math.floor(random() * special.length)]);
      const active = all.filter((u) => u.group === 'Активное умение');
      if (active.length) result.push(active[Math.floor(random() * active.length)]);
      const rest = all.filter((u) => !result.includes(u));
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      result.push(...rest.slice(0, 4 - result.length));
      for (const u of fallback) {
        if (result.length === 4) break;
        result.push({ ...u, group: 'Припасы' });
      }
      return result;
    }
    function apply(u, s) {
      if (u.available && !u.available(s)) return false;
      s.upgradeRanks ??= {};
      if (u.max && (s.upgradeRanks[u.id] || 0) >= u.max) return false;
      u.apply(s);
      if (u.max) s.upgradeRanks[u.id] = (s.upgradeRanks[u.id] || 0) + 1;
      return true;
    }
    function permanent(s, hero, levels) {
      for (const key of ['haste', 'range', 'magnet', 'armor', 'regen']) {
        const factor = permanentUpgradeDefinitions[key]?.factor;
        if (factor !== undefined) s.stats[key] += (levels[key] || 0) * factor;
      }
      const training = heroTrainingDefinitions[hero];
      if (training) add(training.stat, training.factor * (levels['training_' + hero] || 0))(s);
    }
    return { common, heroes, abilities, pool, offer, apply, permanent };
  },
};
