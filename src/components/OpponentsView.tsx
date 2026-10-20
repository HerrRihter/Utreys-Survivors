import { useOpponentPreview } from '../ui/useOpponentPreview';
import { ALL_UNIT_KEYS, OPPONENTS_META, type UnitKey } from '../ui/opponent-details';
import { Dialog } from './Dialog';
import React, { useRef, useState, useMemo } from 'react';
import { unitDefinitions, enemyDamageScale, enemyHpScale } from '../../data/enemies/units.js';
import { getWaveSchedule } from '../systems/wave-schedule.js';
import { waveTiming } from '../ui/wave-preview.js';
import { arenaDefinitions } from '../world/arenas.js';

export const OpponentsView: React.FC = () => {
  const [filterCategory, setFilterCategory] = useState<'all' | 'regulators' | 'clients'>('all');
  const [motion, setMotion] = useState<'walk' | 'attack' | 'hurt'>('walk');
  const [frozen, setFrozen] = useState<boolean>(false);
  const [reverse, setReverse] = useState<boolean>(false);
  const [inspectedUnit, setInspectedUnit] = useState<UnitKey | null>(null);
  const [singleUnitAttacking, setSingleUnitAttacking] = useState<Record<string, number>>({});

  const phaseRef = useRef(0);
  const radarRef = useRef(0);
  const canvasMapRef = useRef<HTMLCanvasElement>(null);
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const schedule = getWaveSchedule('empty');

  const filteredUnits = useMemo(() => {
    return ALL_UNIT_KEYS.filter((key) => {
      if (filterCategory === 'all') return true;
      return OPPONENTS_META[key].category === filterCategory;
    });
  }, [filterCategory]);

  const triggerUnitAttack = (unit: UnitKey) => {
    setSingleUnitAttacking((prev) => ({
      ...prev,
      [unit]: phaseRef.current + 1.8,
    }));
  };

  useOpponentPreview({
    motion,
    frozen,
    reverse,
    singleUnitAttacking,
    canvasRefs,
    canvasMapRef,
    phaseRef,
    radarRef,
  });

  const currentArena = arenaDefinitions.empty || {
    name: 'Дата-центр Utrace',
    description: 'Высоконагруженный контур валидации данных и стресс-тестирования сервисов Utrace.',
  };

  return (
    <div
      className="overlay"
      style={{
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        background: '#081215',
        color: 'var(--ink)',
        padding: '80px 24px 24px',
      }}
    >
      <main style={{ maxWidth: '1180px', margin: '0 auto', width: '100%', flexShrink: 0 }}>
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
            <div
              className="eyebrow"
              style={{ color: 'var(--cyan)', letterSpacing: '3px', fontSize: '12px' }}
            >
              РЕЕСТР КОНТУРОВ И КЛИЕНТОВ
            </div>
            <h1
              style={{ fontSize: '38px', lineHeight: 1.15, margin: '8px 0', color: 'var(--cyan)' }}
            >
              Враги и клиенты Utrace
            </h1>
            <p
              style={{
                maxWidth: '850px',
                color: '#9bb8bf',
                margin: 0,
                fontSize: '14px',
                lineHeight: 1.6,
              }}
            >
              Полная база сущностей: регулятор ЦРПТ, промежуточный контур L3 и ключевые клиенты
              (Пепси, Инбев, Марс), формирующие высоконагруженный поток данных маркировки.
            </p>
          </div>
        </header>

        {/* Navigation, Filter Tabs and Controls */}
        <nav
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            margin: '16px 0',
            alignItems: 'center',
            background: 'var(--panel)',
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
                borderColor: filterCategory === 'all' ? 'var(--cyan)' : 'var(--panel-border)',
                background: filterCategory === 'all' ? '#13353e' : '#0e252b',
                color: filterCategory === 'all' ? 'var(--cyan)' : '#d0e7eb',
                fontWeight: filterCategory === 'all' ? 'bold' : 'normal',
              }}
            >
              Все сущности ({ALL_UNIT_KEYS.length})
            </button>
            <button
              type="button"
              className="small"
              onClick={() => setFilterCategory('regulators')}
              style={{
                borderColor:
                  filterCategory === 'regulators' ? 'var(--cyan)' : 'var(--panel-border)',
                background: filterCategory === 'regulators' ? '#13353e' : '#0e252b',
                color: filterCategory === 'regulators' ? 'var(--cyan)' : '#d0e7eb',
                fontWeight: filterCategory === 'regulators' ? 'bold' : 'normal',
              }}
            >
              Регуляторы и баги (
              {ALL_UNIT_KEYS.filter((key) => OPPONENTS_META[key].category === 'regulators').length})
            </button>
            <button
              type="button"
              className="small"
              onClick={() => setFilterCategory('clients')}
              style={{
                borderColor: filterCategory === 'clients' ? 'var(--cyan)' : 'var(--panel-border)',
                background: filterCategory === 'clients' ? '#13353e' : '#0e252b',
                color: filterCategory === 'clients' ? 'var(--cyan)' : '#d0e7eb',
                fontWeight: filterCategory === 'clients' ? 'bold' : 'normal',
              }}
            >
              Клиенты FMCG (
              {ALL_UNIT_KEYS.filter((key) => OPPONENTS_META[key].category === 'clients').length})
            </button>
          </div>

          {/* Animation Global Controls */}
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <span style={{ color: '#9bb8bf' }}>Режим:</span>
              <select
                value={motion}
                onChange={(e) => setMotion(e.target.value as 'walk' | 'attack' | 'hurt')}
                style={{
                  background: '#0f272d',
                  color: 'var(--cyan)',
                  border: '1px solid #1a5763',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  font: 'inherit',
                }}
              >
                <option value="walk">Движение</option>
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

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '13px',
                cursor: 'pointer',
                color: '#9bb8bf',
              }}
            >
              <input
                type="checkbox"
                checked={reverse}
                onChange={(e) => setReverse(e.target.checked)}
              />
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
                  background: 'var(--panel)',
                  border: `1px solid ${isBoss ? '#ffd600' : 'var(--panel-border)'}`,
                  boxShadow: isBoss
                    ? '0 0 20px rgba(255, 214, 0, 0.2)'
                    : '0 4px 16px rgba(0,0,0,0.4)',
                  padding: '20px',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'border-color 0.2s',
                }}
              >
                {/* Header Badge */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '10px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: meta.badgeColor,
                      letterSpacing: '1px',
                    }}
                  >
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
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <h2 style={{ fontSize: '24px', margin: '0 0 4px', color: u.color }}>{u.name}</h2>
                  <span style={{ fontSize: '12px', color: 'var(--teal)', fontFamily: 'monospace' }}>
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
                    color: 'var(--teal)',
                    background: '#0e252b',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #1a5763',
                    marginBottom: '10px',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                  }}
                >
                  <span>{Math.round(u.hp * enemyHpScale)} HP</span>
                  <span>·</span>
                  <span>{Math.max(1, Math.round(u.damage * enemyDamageScale))} УРОНА</span>
                  <span>·</span>
                  <span>{u.speed} СКОРОСТЬ</span>
                  <span>·</span>
                  <span>{u.range}px РАДИУС</span>
                </div>

                {/* Timing */}
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--cyan)',
                    margin: '4px 0 8px',
                    fontWeight: 600,
                  }}
                >
                  Тайминг: {timing}
                </div>

                {/* Description */}
                <p
                  style={{
                    fontSize: '13px',
                    color: '#a4c1c9',
                    margin: '0 0 16px',
                    lineHeight: 1.55,
                    minHeight: '60px',
                  }}
                >
                  {meta.description}
                </p>

                {/* Interactive Action Buttons */}
                <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="small"
                    aria-label={`Тест атаки: ${u.name}`}
                    onClick={() => triggerUnitAttack(unit)}
                    style={{
                      flex: 1,
                      borderColor: 'var(--cyan)',
                      color: 'var(--cyan)',
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
                    aria-label={`Спецификация: ${u.name}`}
                    onClick={() => setInspectedUnit(unit)}
                    style={{
                      borderColor: 'var(--panel-border)',
                      color: 'var(--teal)',
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
            background: 'var(--panel)',
            border: '1px solid #1a5763',
            padding: '24px',
            borderRadius: '8px',
          }}
        >
          <div
            className="eyebrow"
            style={{ color: 'var(--cyan)', fontSize: '11px', marginBottom: '6px' }}
          >
            ТОПОЛОГИЯ КЛАСТЕРА
          </div>
          <h3 style={{ margin: '0 0 8px', color: 'var(--cyan)', fontSize: '22px' }}>
            {currentArena.name}
          </h3>
          <p style={{ fontSize: '13px', color: '#8fb1b9', margin: '0 0 16px', maxWidth: '850px' }}>
            Центральное серверное ядро Utrace окружено кольцевыми шинами передачи данных и шлюзами
            валидации. Клиенты подключаются по периметру и создают входящий поток маркировки.
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
        <Dialog titleId="opponent-title" onClose={() => setInspectedUnit(null)}>
          <div
            style={{
              background: 'var(--panel)',
              border: `1px solid ${OPPONENTS_META[inspectedUnit].badgeColor}`,
              boxShadow: `0 12px 48px rgba(0,0,0,0.8), 0 0 24px ${OPPONENTS_META[inspectedUnit].badgeColor}33`,
              borderRadius: '10px',
              padding: '28px',
              maxWidth: '560px',
              width: '100%',
              color: 'var(--ink)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: OPPONENTS_META[inspectedUnit].badgeColor,
                  letterSpacing: '1px',
                }}
              >
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

            <h2
              id="opponent-title"
              style={{
                fontSize: '28px',
                margin: '0 0 6px',
                color: (unitDefinitions as Record<string, any>)[inspectedUnit]?.color,
              }}
            >
              {(unitDefinitions as Record<string, any>)[inspectedUnit]?.name}
            </h2>
            <div style={{ fontSize: '13px', color: '#7e9fa8', marginBottom: '16px' }}>
              {OPPONENTS_META[inspectedUnit].role}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                marginBottom: '18px',
                fontSize: '12px',
              }}
            >
              <div
                style={{
                  background: '#0e252b',
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid #1a5763',
                }}
              >
                <span style={{ color: '#7e9fa8', display: 'block', marginBottom: '3px' }}>
                  ПРОТОКОЛ ОБМЕНА:
                </span>
                <strong style={{ color: 'var(--cyan)' }}>
                  {OPPONENTS_META[inspectedUnit].protocol}
                </strong>
              </div>
              <div
                style={{
                  background: '#0e252b',
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid #1a5763',
                }}
              >
                <span style={{ color: '#7e9fa8', display: 'block', marginBottom: '3px' }}>
                  ЧАСТОТА ЗАПРОСОВ:
                </span>
                <strong style={{ color: 'var(--teal)' }}>
                  {OPPONENTS_META[inspectedUnit].frequency}
                </strong>
              </div>
              <div
                style={{
                  background: '#0e252b',
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid #1a5763',
                  gridColumn: 'span 2',
                }}
              >
                <span style={{ color: '#7e9fa8', display: 'block', marginBottom: '3px' }}>
                  УРОВЕНЬ АГРЕГАЦИИ:
                </span>
                <strong style={{ color: 'var(--ink)' }}>
                  {OPPONENTS_META[inspectedUnit].aggregation}
                </strong>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 6px', color: 'var(--cyan)', fontSize: '14px' }}>
                Описание контура
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#a4c1c9', lineHeight: 1.6 }}>
                {OPPONENTS_META[inspectedUnit].description}
              </p>
            </div>

            <div style={{ marginBottom: '22px' }}>
              <h4 style={{ margin: '0 0 6px', color: '#ffd600', fontSize: '14px' }}>
                Рекомендации по тактике
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  color: '#d0e7eb',
                  lineHeight: 1.6,
                  background: '#112930',
                  padding: '10px 12px',
                  borderRadius: '4px',
                  border: '1px solid #1c4b56',
                }}
              >
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
                style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)' }}
              >
                ⚡ Запустить тест атаки
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => setInspectedUnit(null)}
                style={{
                  background: 'var(--cyan)',
                  color: '#041724',
                  padding: '8px 18px',
                  fontSize: '13px',
                }}
              >
                Закрыть
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
