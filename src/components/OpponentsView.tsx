import React, { useEffect, useRef, useState } from 'react';
import { unitDefinitions } from '../../data/enemies/units.js';
import { getWaveSchedule, waveRoster } from '../systems/wave-schedule.js';
import { waveTiming } from '../ui/wave-preview.js';
import { arenaDefinitions, createArenas } from '../world/arenas.js';
import { Village } from '../world/village/village.js';
import { Legion } from '../entities/legion.js';

const opponentDescriptions: Record<string, string> = {
  l3: 'Промежуточный контур L3. Обеспечивает связь производственных линий со складом, регулярно передаёт пакеты агрегированных кодов.',
  crpt: 'Эмиссионный шлюз ЦРПТ (Честный ЗНАК). Ключевой регулятор: колоссальный запас прочности, строгие проверки криптохвостов и массивная валидация.',
  pepsi: 'Клиент Пепси. Скоростные линии розлива напитков, генерация сотен запросов в секунду и постоянная верификация партий.',
  inbev: 'Клиент Инбев. Пивоваренный гигант с тяжёлыми паллетами и высокой плотностью групповой агрегации кодов. Обладает защитой с фронтальной стороны.',
  mars: 'Клиент Марс. Международный FMCG-производитель кондитерских изделий и кормов. Непрерывная выгрузка отчётов нанесения и дистанционные запросы.',
};

interface OpponentsViewProps {
  onBackToGame: () => void;
}

export const OpponentsView: React.FC<OpponentsViewProps> = ({ onBackToGame }) => {
  const [selectedMap, setSelectedMap] = useState<string>('empty');
  const [motion, setMotion] = useState<'walk' | 'attack' | 'hurt'>('walk');
  const [frozen, setFrozen] = useState<boolean>(false);
  const [reverse, setReverse] = useState<boolean>(false);

  const canvasMapRef = useRef<HTMLCanvasElement>(null);
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const schedule = getWaveSchedule(selectedMap);
  const displayUnits = Object.keys(unitDefinitions);

  useEffect(() => {
    let animId: number;
    let phase = 0;
    let lastTime = performance.now();

    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - lastTime) / 1000 || 0);
      lastTime = t;
      if (!frozen) phase += dt;

      for (const unit of displayUnits) {
        const canvas = canvasRefs.current.get(unit);
        if (!canvas) continue;
        const g = canvas.getContext('2d');
        if (!g) continue;

        const u = (unitDefinitions as Record<string, any>)[unit];
        if (!u) continue;

        g.clearRect(0, 0, canvas.width, canvas.height);
        g.imageSmoothingEnabled = false;

        // Draw ground grid inside preview
        g.fillStyle = '#0f2427';
        g.fillRect(0, 0, canvas.width, canvas.height);
        g.strokeStyle = '#1a3e44';
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
        const bob = motion === 'walk' ? Math.sin(phase * 8) * 3 : 0;

        const mockEnemy = {
          x: cx,
          y: cy + bob,
          unit,
          heading: reverse ? Math.PI : 0,
          hit: motion === 'hurt' ? 1 : 0,
          action:
            motion === 'attack'
              ? {
                  aim: { x: cx + (reverse ? -120 : 120), y: cy },
                  hit: false,
                }
              : null,
        };

        if (motion === 'attack') {
          Legion.telegraph(g, mockEnemy);
        }

        Legion.draw(g, mockEnemy, () => {});
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [displayUnits, motion, frozen, reverse]);

  // Mini-map render
  useEffect(() => {
    const canvas = canvasMapRef.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;

    const arenas = createArenas(Village);
    const world = arenas.get(selectedMap);
    g.setTransform(0.25, 0, 0, 0.25, 0, 0);
    world.draw(g);
    g.fillStyle = '#00e5ff';
    g.beginPath();
    g.arc(1100, 1100, 26, 0, Math.PI * 2);
    g.fill();
  }, [selectedMap]);

  const currentArena = (arenaDefinitions as Record<string, { name: string; description: string; notes?: string }>)[selectedMap] || {
    name: 'Дата-центр Utrace',
    description: 'Высоконагруженный контур валидации данных и стресс-тестирования сервисов Utrace.',
  };

  return (
    <div className="overlay" style={{ alignItems: 'flex-start', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflowY: 'auto', background: '#0a1619', color: '#eee9d4', padding: '24px' }}>
      <main style={{ maxWidth: '1180px', margin: '0 auto', width: '100%' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
          <div>
            <div className="eyebrow" style={{ color: '#00e5ff', letterSpacing: '3px', fontSize: '12px' }}>РЕЕСТР КОНТУРОВ И КЛИЕНТОВ</div>
            <h1 style={{ fontSize: '38px', lineHeight: 1.15, margin: '8px 0', color: '#00e5ff' }}>
              Противники Utrace
            </h1>
            <p style={{ maxWidth: '850px', color: '#bac5b6', margin: 0, fontSize: '14px' }}>
              Регулятор ЦРПТ, контуры агрегации L3 и ключевые клиенты (Пепси, Инбев, Марс), формирующие высоконагруженный поток данных.
            </p>
          </div>
          <button className="primary" onClick={onBackToGame} style={{ background: '#00e5ff', color: '#041724', whiteSpace: 'nowrap', boxShadow: '4px 4px 0 #008ba3' }}>
            В игру →
          </button>
        </header>

        <nav style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '16px 0', alignItems: 'center' }}>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <span>Режим:</span>
              <select
                value={motion}
                onChange={(e) => setMotion(e.target.value as 'walk' | 'attack' | 'hurt')}
                style={{ background: '#122c33', color: '#00e5ff', border: '1px solid #1a5763', padding: '4px 8px', borderRadius: '4px' }}
              >
                <option value="walk">Движение</option>
                <option value="attack">Запрос / Атака</option>
                <option value="hurt">Валидация / Урон</option>
              </select>
            </label>

            <button type="button" className="small" onClick={() => setFrozen(!frozen)}>
              {frozen ? 'Продолжить' : 'Пауза'}
            </button>

            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer' }}>
              <input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} />
              Отразить
            </label>
          </div>
        </nav>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '16px', margin: '20px 0' }}>
          {displayUnits.map((unit) => {
            const u = (unitDefinitions as Record<string, any>)[unit];
            const isBoss = u.boss;
            const timing = (isBoss ? 'ГЛАВНЫЙ БОСС · ' : '') + (schedule ? waveTiming(schedule, unit) : 'Активный поток');
            const description = opponentDescriptions[unit] || 'Клиент контура валидации кодов маркировки.';

            return (
              <article key={unit} style={{ background: '#0c2227', border: `1px solid ${isBoss ? '#ffd600' : '#1e4852'}`, padding: '16px', borderRadius: '6px' }}>
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current.set(unit, el);
                    else canvasRefs.current.delete(unit);
                  }}
                  width={280}
                  height={190}
                  aria-label={u.name}
                  style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '4/3', imageRendering: 'pixelated', borderRadius: '4px', marginBottom: '14px' }}
                />
                <h2 style={{ fontSize: '20px', margin: '0 0 6px', color: u.color }}>
                  {u.name} {isBoss && '★'}
                </h2>
                <div style={{ fontSize: '13px', color: '#7ce5d5', marginBottom: '6px', fontFamily: 'monospace' }}>
                  {u.hp} HP · {u.damage} урона · {u.xp} кодов
                </div>
                <p style={{ color: '#00e5ff', margin: '4px 0', fontSize: '12px' }}>{timing}</p>
                <p style={{ fontSize: '13px', color: '#c3c9ba', margin: '6px 0 0', lineHeight: 1.5 }}>{description}</p>
              </article>
            );
          })}
        </div>

        <div style={{ marginTop: '36px', background: '#0d252b', border: '1px solid #1c4b56', padding: '20px', borderRadius: '6px' }}>
          <h3 style={{ margin: '0 0 8px', color: '#00e5ff' }}>Схема дата-центра: {currentArena.name}</h3>
          <p style={{ fontSize: '13px', color: '#90b4bc', margin: '0 0 16px' }}>{currentArena.notes || currentArena.description}</p>
          <canvas
            ref={canvasMapRef}
            width={550}
            height={550}
            style={{ width: '100%', maxWidth: '380px', display: 'block', border: '1px solid #1a5763', borderRadius: '4px' }}
          />
        </div>
      </main>
    </div>
  );
};
