import React, { useEffect, useRef, useState, useMemo } from 'react';
import { unitDefinitions } from '../../data/enemies/units.js';
import { getWaveSchedule } from '../systems/wave-schedule.js';
import { waveTiming } from '../ui/wave-preview.js';
import { arenaDefinitions, createArenas } from '../world/arenas.js';
import { Village } from '../world/village/village.js';
import { Legion } from '../entities/legion.js';

interface OpponentMeta {
  category: 'regulators' | 'clients';
  badge: string;
  badgeColor: string;
  role: string;
  protocol: string;
  frequency: string;
  aggregation: string;
  description: string;
  tactics: string;
}

const ALL_UNIT_KEYS = ['l3', 'crpt', 'pepsi', 'inbev', 'mars'] as const;
type UnitKey = typeof ALL_UNIT_KEYS[number];

const OPPONENTS_META: Record<UnitKey, OpponentMeta> = {
  l3: {
    category: 'regulators',
    badge: 'ПРОМЕЖУТОЧНЫЙ КОНТУР L3',
    badgeColor: '#00e676',
    role: 'Серверная интеграция уровня L3 (MES/ERP)',
    protocol: 'REST / gRPC · Потоковая агрегация',
    frequency: 'Высокая (каждые 1.2с)',
    aggregation: 'Короба и упаковки · первичный контур',
    description: 'Промежуточный контур L3. Обеспечивает прямую связь производственных линий со складом готовой продукции, непрерывно передаёт пакеты агрегированных кодов и проводит первичную проверку соответствия формату DataMatrix.',
    tactics: 'Быстро сокращает дистанцию плотными группами. Рекомендуется использовать пакетный сброс (Q) для зачистки скоплений серверов L3.'
  },
  crpt: {
    category: 'regulators',
    badge: 'ГЛАВНЫЙ ЭМИССИОННЫЙ РЕГУЛЯТОР (БОСС)',
    badgeColor: '#ffd600',
    role: 'Национальный каталог и шлюз Честный ЗНАК',
    protocol: 'Криптографический шлюз ГОСТ · HSM',
    frequency: 'Круговая валидация (каждые 2.2с)',
    aggregation: 'Полный реестр эмиссии кодов маркировки',
    description: 'Эмиссионный шлюз ЦРПТ (Честный ЗНАК). Ключевой регулятор всей системы: колоссальный запас прочности (2500 HP), строгие криптографические проверки и круговая валидация с мощной ударной волной на 360 градусов.',
    tactics: 'Главный босс контура на 2:00 минуте! Во время каста круговой проверки отходите за пределы золотой зоны и активируйте Оверклокинг (E) для нанесения максимального урона.'
  },
  pepsi: {
    category: 'clients',
    badge: 'КЛЮЧЕВОЙ FMCG-КЛИЕНТ',
    badgeColor: '#00b4d8',
    role: 'Транснациональный клиент напитков и снеков',
    protocol: 'MQ / Kafka · Высокоскоростной розлив',
    frequency: 'Ультравысокая (сотни запросов/сек)',
    aggregation: 'Бутылки, банки, групповые кейсы',
    description: 'Клиент Пепси. Скоростные автоматизированные линии розлива напитков, генерация сотен запросов в секунду и постоянная динамическая верификация партий на лету.',
    tactics: 'Обладает повышенной скоростью перемещения (92 px/s). Старайтесь не попадать в окружение быстрых потоков Пепси, используйте постоянное маневрирование.'
  },
  inbev: {
    category: 'clients',
    badge: 'ПРОМЫШЛЕННЫЙ КЛИЕНТ (ЩИТ)',
    badgeColor: '#d4af37',
    role: 'Пивоваренный производственный гигант',
    protocol: 'OPC-UA / SAP · Паллетная логистика',
    frequency: 'Тяжёлые периодические пакеты',
    aggregation: 'Кеги, групповые паллеты, контейнеры',
    description: 'Клиент Инбев. Крупнейший пивоваренный производитель с массивными производственными паллетами и высокой плотностью групповой агрегации кодов. Оснащён усиленной защитой от входящих запросов с фронтальной стороны.',
    tactics: 'Фронтальная броня блокирует до 55% урона! Заходите с фланга или тыла, либо бейте круговыми атаками для обхода фронтального барьера.'
  },
  mars: {
    category: 'clients',
    badge: 'МЕЖДУНАРОДНЫЙ КЛИЕНТ (ДИСТАНЦИЯ)',
    badgeColor: '#ff5252',
    role: 'Международный FMCG-холдинг кондитерских изделий',
    protocol: 'EDI / AS2 · Дистанционная выгрузка',
    frequency: 'Дальнобойные залповые отчеты (240px)',
    aggregation: 'Индивидуальные штуки, шоу-боксы',
    description: 'Клиент Марс. Международный производитель кондитерских изделий и кормов. Непрерывная выгрузка отчётов нанесения и высокочастотные дистанционные запросы, атакующие ядро с безопасного расстояния.',
    tactics: 'Держится на безопасном расстоянии 240px и запускает ракетные пакеты данных. Приоритетная цель для сближения и быстрой нейтрализации.'
  }
};

interface OpponentsViewProps {
  onBackToGame: () => void;
}

export const OpponentsView: React.FC<OpponentsViewProps> = ({ onBackToGame }) => {
  const [filterCategory, setFilterCategory] = useState<'all' | 'regulators' | 'clients'>('all');
  const [motion, setMotion] = useState<'walk' | 'attack' | 'hurt'>('walk');
  const [frozen, setFrozen] = useState<boolean>(false);
  const [reverse, setReverse] = useState<boolean>(false);
  const [inspectedUnit, setInspectedUnit] = useState<UnitKey | null>(null);
  const [singleUnitAttacking, setSingleUnitAttacking] = useState<Record<string, number>>({});

  const canvasMapRef = useRef<HTMLCanvasElement>(null);
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  let schedule: any = null;
  try {
    schedule = getWaveSchedule('empty');
  } catch (err) {
    console.warn('Failed to load wave schedule:', err);
  }

  const filteredUnits = useMemo(() => {
    return ALL_UNIT_KEYS.filter((key) => {
      if (filterCategory === 'all') return true;
      return OPPONENTS_META[key].category === filterCategory;
    });
  }, [filterCategory]);

  const triggerUnitAttack = (unit: UnitKey) => {
    setSingleUnitAttacking((prev) => ({
      ...prev,
      [unit]: performance.now() + 1800
    }));
  };

  useEffect(() => {
    let animId: number;
    let phase = 0;
    let lastTime = performance.now();

    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - lastTime) / 1000 || 0);
      lastTime = t;
      if (!frozen) phase += dt;

      for (const unit of ALL_UNIT_KEYS) {
        const canvas = canvasRefs.current.get(unit);
        if (!canvas) continue;
        const g = canvas.getContext('2d');
        if (!g) continue;

        const u = (unitDefinitions as Record<string, any>)[unit];
        if (!u) continue;

        g.clearRect(0, 0, canvas.width, canvas.height);
        g.imageSmoothingEnabled = false;

        // Draw datacenter grid background inside preview
        g.fillStyle = '#08171a';
        g.fillRect(0, 0, canvas.width, canvas.height);
        g.strokeStyle = '#123038';
        g.lineWidth = 1;
        g.beginPath();
        for (let x = 0; x < canvas.width; x += 25) {
          g.moveTo(x, 0);
          g.lineTo(x, canvas.height);
        }
        for (let y = 0; y < canvas.height; y += 25) {
          g.moveTo(0, y);
          g.lineTo(canvas.width, y);
        }
        g.stroke();

        const cx = canvas.width / 2;
        const cy = canvas.height * 0.65;
        const isSingleAttacking = (singleUnitAttacking[unit] || 0) > t;
        const effectiveMotion = isSingleAttacking ? 'attack' : motion;

        const bob = effectiveMotion === 'walk' ? Math.sin(phase * 8) * 3 : 0;
        const lunge = effectiveMotion === 'attack' ? (reverse ? -1 : 1) * Math.max(0, Math.sin(phase * 6) * 14) : 0;
        const shudder = effectiveMotion === 'hurt' ? Math.sin(phase * 28) * 2.5 : 0;
        const isHit = effectiveMotion === 'hurt' && Math.sin(phase * 12) > 0.1 ? 1 : 0;

        const aimX = cx + (reverse ? -130 : 130);
        const mockEnemy = {
          x: cx + lunge + shudder,
          y: cy + bob,
          unit,
          heading: reverse ? Math.PI : 0,
          hit: isHit,
          action:
            effectiveMotion === 'attack'
              ? {
                  aim: { x: aimX, y: cy },
                  hit: false,
                }
              : null,
        };

        if (effectiveMotion === 'attack') {
          Legion.telegraph(g, mockEnemy);

          // Unique functioning attack actions and projectiles
          if (unit === 'l3') {
            const prog = (phase * 2.4) % 1;
            const px = cx + (reverse ? -1 : 1) * (prog * 80);
            Legion.projectile(g, { x: px, y: cy - 14, kind: 'l3' });
          } else if (unit === 'crpt') {
            const waveR = 24 + ((phase * 80) % 95);
            const waveAlpha = Math.max(0, 1 - waveR / 95) * 0.75;
            g.strokeStyle = `rgba(255, 214, 0, ${waveAlpha})`;
            g.lineWidth = 3;
            g.beginPath();
            g.arc(cx, cy - 16, waveR, 0, Math.PI * 2);
            g.stroke();
          } else if (unit === 'pepsi') {
            const prog = (phase * 2.6) % 1;
            const px = cx + (reverse ? -1 : 1) * (prog * 85);
            Legion.projectile(g, { x: px, y: cy - 16 + Math.sin(phase * 14) * 5, kind: 'pepsi' });
          } else if (unit === 'inbev') {
            g.strokeStyle = 'rgba(212, 175, 55, 0.85)';
            g.lineWidth = 3.5;
            g.beginPath();
            const arcAngle = reverse ? Math.PI : 0;
            g.arc(cx + (reverse ? -26 : 26), cy - 14, 22, arcAngle - 1.1, arcAngle + 1.1);
            g.stroke();
          } else if (unit === 'mars') {
            const prog = (phase * 1.8) % 1;
            const px = cx + (reverse ? -1 : 1) * (prog * 115);
            Legion.projectile(g, { x: px, y: cy - 10, kind: 'mars' });
          }
        }

        Legion.draw(g, mockEnemy, () => {});
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [motion, frozen, reverse, singleUnitAttacking]);

  // Mini-map radar animation render
  useEffect(() => {
    const canvas = canvasMapRef.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;

    let animId: number;
    let t = 0;
    const arenas = createArenas(Village);

    const renderMap = () => {
      t += 0.035;
      const world = arenas.get('empty');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.setTransform(0.25, 0, 0, 0.25, 0, 0);
      world.draw(g);

      // Radar pulses from core
      const pulse = 24 + ((t * 22) % 75);
      const pulseAlpha = Math.max(0, 1 - (pulse - 24) / 75) * 0.45;
      g.strokeStyle = `rgba(0, 229, 255, ${pulseAlpha})`;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(1100, 1100, pulse, 0, Math.PI * 2);
      g.stroke();

      // Center Core
      g.fillStyle = '#00e5ff';
      g.beginPath();
      g.arc(1100, 1100, 22, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 3;
      g.stroke();

      g.setTransform(1, 0, 0, 1, 0, 0);
      animId = requestAnimationFrame(renderMap);
    };

    renderMap();
    return () => cancelAnimationFrame(animId);
  }, []);

  const currentArena = arenaDefinitions.empty || {
    name: 'Дата-центр Utrace',
    description: 'Высоконагруженный контур валидации данных и стресс-тестирования сервисов Utrace.',
  };

  return (
    <div
      className="overlay"
      style={{
        alignItems: 'flex-start',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        background: '#081215',
        color: '#f0f8f8',
        padding: '24px',
      }}
    >
      <main style={{ maxWidth: '1180px', margin: '0 auto', width: '100%' }}>
        {/* Header */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '20px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div className="eyebrow" style={{ color: '#00e5ff', letterSpacing: '3px', fontSize: '12px' }}>
              РЕЕСТР КОНТУРОВ И КЛИЕНТОВ
            </div>
            <h1 style={{ fontSize: '38px', lineHeight: 1.15, margin: '8px 0', color: '#00e5ff' }}>
              Враги и клиенты Utrace
            </h1>
            <p style={{ maxWidth: '850px', color: '#9bb8bf', margin: 0, fontSize: '14px', lineHeight: 1.6 }}>
              Полная база сущностей: регулятор ЦРПТ, промежуточный контур L3 и ключевые клиенты (Пепси, Инбев, Марс), формирующие высоконагруженный поток данных маркировки.
            </p>
          </div>
          <button
            className="primary"
            onClick={onBackToGame}
            style={{
              background: '#00e5ff',
              color: '#041724',
              whiteSpace: 'nowrap',
              boxShadow: '4px 4px 0 #008ba3',
            }}
          >
            ← В игру
          </button>
        </header>

        {/* Navigation, Filter Tabs and Controls */}
        <nav
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            margin: '16px 0',
            alignItems: 'center',
            background: '#0a191d',
            padding: '12px 16px',
            borderRadius: '6px',
            border: '1px solid #1a5763',
          }}
        >
          {/* Category Filter Tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="small"
              onClick={() => setFilterCategory('all')}
              style={{
                borderColor: filterCategory === 'all' ? '#00e5ff' : '#1a5763',
                background: filterCategory === 'all' ? '#13353e' : '#0e252b',
                color: filterCategory === 'all' ? '#00e5ff' : '#d0e7eb',
                fontWeight: filterCategory === 'all' ? 'bold' : 'normal',
              }}
            >
              Все сущности (5)
            </button>
            <button
              type="button"
              className="small"
              onClick={() => setFilterCategory('regulators')}
              style={{
                borderColor: filterCategory === 'regulators' ? '#00e5ff' : '#1a5763',
                background: filterCategory === 'regulators' ? '#13353e' : '#0e252b',
                color: filterCategory === 'regulators' ? '#00e5ff' : '#d0e7eb',
                fontWeight: filterCategory === 'regulators' ? 'bold' : 'normal',
              }}
            >
              Регуляторы и контуры · Враги (2)
            </button>
            <button
              type="button"
              className="small"
              onClick={() => setFilterCategory('clients')}
              style={{
                borderColor: filterCategory === 'clients' ? '#00e5ff' : '#1a5763',
                background: filterCategory === 'clients' ? '#13353e' : '#0e252b',
                color: filterCategory === 'clients' ? '#00e5ff' : '#d0e7eb',
                fontWeight: filterCategory === 'clients' ? 'bold' : 'normal',
              }}
            >
              Клиенты FMCG (3)
            </button>
          </div>

          {/* Animation Global Controls */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <span style={{ color: '#9bb8bf' }}>Режим:</span>
              <select
                value={motion}
                onChange={(e) => setMotion(e.target.value as 'walk' | 'attack' | 'hurt')}
                style={{
                  background: '#0f272d',
                  color: '#00e5ff',
                  border: '1px solid #1a5763',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  font: 'inherit',
                }}
              >
                <option value="walk">Движение (Walk)</option>
                <option value="attack">Атака / Запрос (Attack)</option>
                <option value="hurt">Получение урона (Hurt)</option>
              </select>
            </label>

            <button
              type="button"
              className="small"
              onClick={() => setFrozen(!frozen)}
              style={{ padding: '5px 12px' }}
            >
              {frozen ? '▶ Продолжить' : '⏸ Пауза'}
            </button>

            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', cursor: 'pointer', color: '#9bb8bf' }}>
              <input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} />
              Отразить влево
            </label>
          </div>
        </nav>

        {/* Entities Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
            gap: '18px',
            margin: '22px 0',
          }}
        >
          {filteredUnits.map((unit) => {
            const u = (unitDefinitions as Record<string, any>)[unit];
            if (!u) return null;
            const meta = OPPONENTS_META[unit];
            const isBoss = !!u.boss;

            let timing = isBoss ? 'ГЛАВНЫЙ БОСС · ' : '';
            try {
              timing += schedule ? waveTiming(schedule, unit) : 'Активный поток';
            } catch {
              timing += 'Активный поток';
            }

            return (
              <article
                key={unit}
                style={{
                  background: '#0a191d',
                  border: `1px solid ${isBoss ? '#ffd600' : '#1a5763'}`,
                  boxShadow: isBoss ? '0 0 20px rgba(255, 214, 0, 0.2)' : '0 4px 16px rgba(0,0,0,0.4)',
                  padding: '20px',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'border-color 0.2s',
                }}
              >
                {/* Header Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: meta.badgeColor, letterSpacing: '1px' }}>
                    {meta.badge}
                  </span>
                  {isBoss && <span style={{ color: '#ffd600', fontSize: '18px' }}>★ БОСС</span>}
                </div>

                {/* Interactive Canvas Preview */}
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current.set(unit, el);
                    else canvasRefs.current.delete(unit);
                  }}
                  width={320}
                  height={195}
                  aria-label={u.name}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: 'auto',
                    aspectRatio: '16/10',
                    imageRendering: 'pixelated',
                    borderRadius: '6px',
                    border: '1px solid #163a43',
                    marginBottom: '14px',
                    background: '#08171a',
                  }}
                />

                {/* Unit Name and Role */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h2 style={{ fontSize: '24px', margin: '0 0 4px', color: u.color }}>
                    {u.name}
                  </h2>
                  <span style={{ fontSize: '12px', color: '#64ffda', fontFamily: 'monospace' }}>
                    +{u.xp} кодов
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: '#7e9fa8', marginBottom: '8px' }}>
                  {meta.role}
                </div>

                {/* Stats Bar */}
                <div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    fontSize: '12px',
                    color: '#64ffda',
                    background: '#0e252b',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #1a5763',
                    marginBottom: '10px',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                  }}
                >
                  <span>{u.hp} HP</span>
                  <span>·</span>
                  <span>{u.damage} УРОНА</span>
                  <span>·</span>
                  <span>{u.speed} СКОРОСТЬ</span>
                  <span>·</span>
                  <span>{u.range}px РАДИУС</span>
                </div>

                {/* Timing */}
                <div style={{ fontSize: '12px', color: '#00e5ff', margin: '4px 0 8px', fontWeight: 600 }}>
                  Тайминг: {timing}
                </div>

                {/* Description */}
                <p style={{ fontSize: '13px', color: '#a4c1c9', margin: '0 0 16px', lineHeight: 1.55, minHeight: '60px' }}>
                  {meta.description}
                </p>

                {/* Interactive Action Buttons */}
                <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="small"
                    onClick={() => triggerUnitAttack(unit)}
                    style={{
                      flex: 1,
                      borderColor: '#00e5ff',
                      color: '#00e5ff',
                      padding: '7px 10px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    ⚡ Тест атаки
                  </button>
                  <button
                    type="button"
                    className="small"
                    onClick={() => setInspectedUnit(unit)}
                    style={{
                      borderColor: '#1a5763',
                      color: '#64ffda',
                      padding: '7px 12px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Спецификация
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Datacenter Schema Map */}
        <div
          style={{
            marginTop: '36px',
            background: '#0a191d',
            border: '1px solid #1a5763',
            padding: '24px',
            borderRadius: '8px',
          }}
        >
          <div className="eyebrow" style={{ color: '#00e5ff', fontSize: '11px', marginBottom: '6px' }}>
            ТОПОЛОГИЯ КЛАСТЕРА
          </div>
          <h3 style={{ margin: '0 0 8px', color: '#00e5ff', fontSize: '22px' }}>
            {currentArena.name}
          </h3>
          <p style={{ fontSize: '13px', color: '#8fb1b9', margin: '0 0 16px', maxWidth: '850px' }}>
            Центральное серверное ядро Utrace окружено кольцевыми шинами передачи данных и шлюзами валидации. Клиенты подключаются по периметру и создают входящий поток маркировки.
          </p>
          <canvas
            ref={canvasMapRef}
            width={550}
            height={550}
            aria-label="Карта дата-центра"
            style={{
              width: '100%',
              maxWidth: '440px',
              display: 'block',
              border: '1px solid #1a5763',
              borderRadius: '6px',
              background: '#0a1619',
            }}
          />
        </div>
      </main>

      {/* Detail Technical Inspection Modal */}
      {inspectedUnit && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            background: 'rgba(5, 16, 20, 0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setInspectedUnit(null)}
        >
          <div
            style={{
              background: '#0a191d',
              border: `1px solid ${OPPONENTS_META[inspectedUnit].badgeColor}`,
              boxShadow: `0 12px 48px rgba(0,0,0,0.8), 0 0 24px ${OPPONENTS_META[inspectedUnit].badgeColor}33`,
              borderRadius: '10px',
              padding: '28px',
              maxWidth: '560px',
              width: '100%',
              color: '#f0f8f8',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: OPPONENTS_META[inspectedUnit].badgeColor, letterSpacing: '1px' }}>
                {OPPONENTS_META[inspectedUnit].badge}
              </span>
              <button
                type="button"
                className="small"
                onClick={() => setInspectedUnit(null)}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                ✕
              </button>
            </div>

            <h2 style={{ fontSize: '28px', margin: '0 0 6px', color: (unitDefinitions as Record<string, any>)[inspectedUnit]?.color }}>
              {(unitDefinitions as Record<string, any>)[inspectedUnit]?.name}
            </h2>
            <div style={{ fontSize: '13px', color: '#7e9fa8', marginBottom: '16px' }}>
              {OPPONENTS_META[inspectedUnit].role}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px', fontSize: '12px' }}>
              <div style={{ background: '#0e252b', padding: '10px', borderRadius: '4px', border: '1px solid #1a5763' }}>
                <span style={{ color: '#7e9fa8', display: 'block', marginBottom: '3px' }}>ПРОТОКОЛ ОБМЕНА:</span>
                <strong style={{ color: '#00e5ff' }}>{OPPONENTS_META[inspectedUnit].protocol}</strong>
              </div>
              <div style={{ background: '#0e252b', padding: '10px', borderRadius: '4px', border: '1px solid #1a5763' }}>
                <span style={{ color: '#7e9fa8', display: 'block', marginBottom: '3px' }}>ЧАСТОТА ЗАПРОСОВ:</span>
                <strong style={{ color: '#64ffda' }}>{OPPONENTS_META[inspectedUnit].frequency}</strong>
              </div>
              <div style={{ background: '#0e252b', padding: '10px', borderRadius: '4px', border: '1px solid #1a5763', gridColumn: 'span 2' }}>
                <span style={{ color: '#7e9fa8', display: 'block', marginBottom: '3px' }}>УРОВЕНЬ АГРЕГАЦИИ:</span>
                <strong style={{ color: '#f0f8f8' }}>{OPPONENTS_META[inspectedUnit].aggregation}</strong>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 6px', color: '#00e5ff', fontSize: '14px' }}>Описание контура</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#a4c1c9', lineHeight: 1.6 }}>
                {OPPONENTS_META[inspectedUnit].description}
              </p>
            </div>

            <div style={{ marginBottom: '22px' }}>
              <h4 style={{ margin: '0 0 6px', color: '#ffd600', fontSize: '14px' }}>Рекомендации по тактике</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#d0e7eb', lineHeight: 1.6, background: '#112930', padding: '10px 12px', borderRadius: '4px', border: '1px solid #1c4b56' }}>
                {OPPONENTS_META[inspectedUnit].tactics}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="small"
                onClick={() => {
                  triggerUnitAttack(inspectedUnit);
                  setInspectedUnit(null);
                }}
                style={{ borderColor: '#00e5ff', color: '#00e5ff' }}
              >
                ⚡ Запустить тест атаки
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => setInspectedUnit(null)}
                style={{ background: '#00e5ff', color: '#041724', padding: '8px 18px', fontSize: '13px' }}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
