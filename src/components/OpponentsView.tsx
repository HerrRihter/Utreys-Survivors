import { useOpponentPreview } from '../ui/useOpponentPreview';
import { ALL_UNIT_KEYS, OPPONENTS_META, type UnitKey } from '../ui/opponent-details';
import { Dialog } from './Dialog';
import React, { useRef, useState, useMemo } from 'react';
import { unitDefinitions, enemyDamageScale, enemyHpScale } from '../../data/enemies/units.js';
import { getWaveSchedule } from '../systems/wave-schedule.js';
import { waveTiming } from '../ui/wave-preview.js';
import { mapDefinitions } from '../../data/maps/maps.js';
import { MapSelect, type MapId } from './MapSelect';

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

  const [map, setMap] = useState<MapId>('empty');
  const schedule = getWaveSchedule(map);

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
    map,
  });

  const currentArena = mapDefinitions[map];

  const tab = (category: typeof filterCategory) =>
    filterCategory === category ? 'small is-current' : 'small';
  const inspected = inspectedUnit && {
    meta: OPPONENTS_META[inspectedUnit],
    unit: (unitDefinitions as Record<string, any>)[inspectedUnit],
  };

  return (
    <div id="opponentsView" className="overlay catalog">
      <main className="catalog-main">
        <header className="catalog-header">
          <div>
            <div className="eyebrow">РЕЕСТР КОНТУРОВ И КЛИЕНТОВ</div>
            <h1>Враги и клиенты Utrace</h1>
            <p>
              Полная база сущностей: регулятор ЦРПТ, промежуточный контур L3 и ключевые клиенты
              (Пепси, Инбев, Марс), формирующие высоконагруженный поток данных маркировки.
            </p>
          </div>
        </header>

        {/* Navigation, Filter Tabs and Controls */}
        <nav className="catalog-controls">
          {/* Category Filter Tabs */}
          <div className="opponents-tabs">
            <button type="button" className={tab('all')} onClick={() => setFilterCategory('all')}>
              Все сущности ({ALL_UNIT_KEYS.length})
            </button>
            <button
              type="button"
              className={tab('regulators')}
              onClick={() => setFilterCategory('regulators')}
            >
              Регуляторы и баги (
              {ALL_UNIT_KEYS.filter((key) => OPPONENTS_META[key].category === 'regulators').length})
            </button>
            <button
              type="button"
              className={tab('clients')}
              onClick={() => setFilterCategory('clients')}
            >
              Клиенты FMCG (
              {ALL_UNIT_KEYS.filter((key) => OPPONENTS_META[key].category === 'clients').length})
            </button>
          </div>

          {/* Animation Global Controls */}
          <div className="opponents-motion">
            <MapSelect value={map} onChange={setMap} />
            <label className="opponents-mode">
              <span>Режим:</span>
              <select
                value={motion}
                onChange={(e) => setMotion(e.target.value as 'walk' | 'attack' | 'hurt')}
              >
                <option value="walk">Движение</option>
                <option value="attack">Атака / Запрос (Attack)</option>
                <option value="hurt">Получение урона (Hurt)</option>
              </select>
            </label>

            <button
              type="button"
              className="small opponents-pause"
              onClick={() => setFrozen(!frozen)}
            >
              {frozen ? '▶ Продолжить' : '⏸ Пауза'}
            </button>

            <label className="catalog-check">
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
        <div className="opponents-grid">
          {filteredUnits.map((unit) => {
            const u = (unitDefinitions as Record<string, any>)[unit];
            if (!u) return null;
            const meta = OPPONENTS_META[unit];
            const isBoss = !!u.boss;

            const timing = (isBoss ? 'ГЛАВНЫЙ БОСС · ' : '') + waveTiming(schedule, unit);

            return (
              <article key={unit} className={isBoss ? 'opponent-card is-boss' : 'opponent-card'}>
                {/* Header Badge */}
                <div className="opponent-badges">
                  <span className="opponent-badge" style={{ color: meta.badgeColor }}>
                    {meta.badge}
                  </span>
                  {isBoss && <span className="opponent-boss">★ БОСС</span>}
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
                  className="opponent-preview"
                />

                {/* Unit Name and Role */}
                <div className="opponent-name">
                  <h2 style={{ color: u.color }}>{u.name}</h2>
                  <span>+{u.xp} кодов</span>
                </div>

                <div className="opponent-role">{meta.role}</div>

                {/* Stats Bar */}
                <div className="opponent-stats">
                  <span>{Math.round(u.hp * enemyHpScale)} HP</span>
                  <span>·</span>
                  <span>{Math.max(1, Math.round(u.damage * enemyDamageScale))} УРОНА</span>
                  <span>·</span>
                  <span>{u.speed} СКОРОСТЬ</span>
                  <span>·</span>
                  <span>{u.range}px РАДИУС</span>
                </div>

                {/* Timing */}
                <div className="opponent-timing">Тайминг: {timing}</div>

                {/* Description */}
                <p className="opponent-description">{meta.description}</p>

                {/* Interactive Action Buttons */}
                <div className="opponent-actions">
                  <button
                    type="button"
                    className="small opponent-attack"
                    aria-label={`Тест атаки: ${u.name}`}
                    onClick={() => triggerUnitAttack(unit)}
                  >
                    ⚡ Тест атаки
                  </button>
                  <button
                    type="button"
                    className="small opponent-spec"
                    aria-label={`Спецификация: ${u.name}`}
                    onClick={() => setInspectedUnit(unit)}
                  >
                    Спецификация
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Datacenter Schema Map */}
        <div className="opponents-schema">
          <div className="eyebrow">ТОПОЛОГИЯ КЛАСТЕРА</div>
          <h3>{currentArena.name}</h3>
          <p>
            Центральное серверное ядро Utrace окружено кольцевыми шинами передачи данных и шлюзами
            валидации. Клиенты подключаются по периметру и создают входящий поток маркировки.
          </p>
          <canvas ref={canvasMapRef} width={550} height={550} aria-label="Карта дата-центра" />
        </div>
      </main>

      {/* Detail Technical Inspection Modal */}
      {inspectedUnit && inspected && (
        <Dialog titleId="opponent-title" onClose={() => setInspectedUnit(null)}>
          <div
            className="opponent-sheet"
            style={
              {
                '--badge': inspected.meta.badgeColor,
                '--badge-glow': inspected.meta.badgeColor + '33',
              } as React.CSSProperties
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="opponent-sheet-head">
              <span className="opponent-badge" style={{ color: inspected.meta.badgeColor }}>
                {inspected.meta.badge}
              </span>
              <button
                type="button"
                className="small opponent-close"
                onClick={() => setInspectedUnit(null)}
              >
                ✕
              </button>
            </div>

            <h2 id="opponent-title" style={{ color: inspected.unit?.color }}>
              {inspected.unit?.name}
            </h2>
            <div className="opponent-sheet-role">{inspected.meta.role}</div>

            <div className="opponent-facts">
              <div>
                <span>ПРОТОКОЛ ОБМЕНА:</span>
                <strong className="fact-protocol">{inspected.meta.protocol}</strong>
              </div>
              <div>
                <span>ЧАСТОТА ЗАПРОСОВ:</span>
                <strong className="fact-frequency">{inspected.meta.frequency}</strong>
              </div>
              <div className="fact-wide">
                <span>УРОВЕНЬ АГРЕГАЦИИ:</span>
                <strong className="fact-aggregation">{inspected.meta.aggregation}</strong>
              </div>
            </div>

            <div className="opponent-sheet-section">
              <h4>Описание контура</h4>
              <p>{inspected.meta.description}</p>
            </div>

            <div className="opponent-sheet-section opponent-tactics">
              <h4>Рекомендации по тактике</h4>
              <p>{inspected.meta.tactics}</p>
            </div>

            <div className="opponent-sheet-actions">
              <button
                type="button"
                className="small opponent-attack-all"
                onClick={() => {
                  triggerUnitAttack(inspectedUnit);
                  setInspectedUnit(null);
                }}
              >
                ⚡ Запустить тест атаки
              </button>
              <button
                type="button"
                className="primary opponent-done"
                onClick={() => setInspectedUnit(null)}
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
