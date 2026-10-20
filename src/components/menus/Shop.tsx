import { useState } from 'react';
import { Overlay } from '../Overlay';
import { Portrait } from '../Portrait';
import { useSession } from '../session';

export function Shop() {
  const session = useSession();
  const view = session.views.shop();
  const { commands } = session;
  return (
    <Overlay id="shop">
      <section className="shop-panel" role="dialog" aria-modal="true" aria-labelledby="shopTitle">
        <button
          id="shopClose"
          className="small"
          style={{ float: 'right' }}
          onClick={commands.backToMenu}
        >
          ← В МЕНЮ
        </button>
        <h2 id="shopTitle" style={{ color: 'var(--cyan)' }}>
          Улучшения Utrace
        </h2>
        <p>Постоянные апгрейды серверной инфраструктуры за валидированные коды.</p>
        <p id="shopWallet">{view.wallet}</p>
        <p style={{ fontSize: '12px', lineHeight: 1.7 }}>
          Накопленные коды и апгрейды сохраняются между сессиями.
        </p>
        <h3>Герои</h3>
        <div id="shopHeroes" className="shopgrid">
          {view.heroes.map((hero) => (
            <div key={hero.id} className="shopcard">
              <Portrait hero={hero.id} width={96} height={96} />
              <h3>{hero.name}</h3>
              <p>{hero.desc}</p>
              <small>{hero.info}</small>
              {hero.owned ? (
                <span className="owned-badge">✓ {hero.label}</span>
              ) : (
                <button
                  className="small"
                  disabled={hero.disabled}
                  onClick={() => commands.buyHero(hero.id)}
                >
                  {hero.label}
                </button>
              )}
            </div>
          ))}
        </div>
        <h3>Постоянная оптимизация</h3>
        <p style={{ fontSize: '12px' }}>Улучшения применяются со следующей сессии.</p>
        <RespecButton refund={view.refund} label={view.refundLabel} onConfirm={commands.respec} />
        <div id="shopUpgrades">
          {view.groups.map((group) => [
            <h4 key={group.title}>{group.title}</h4>,
            ...group.items.map((item) => (
              <button
                key={item.id}
                className="small"
                disabled={item.disabled}
                onClick={() => commands.buyUpgrade(item.id)}
              >
                {item.label}
              </button>
            )),
          ])}
        </div>
      </section>
    </Overlay>
  );
}

// Two clicks: the first arms the reset, the second returns the codes.
function RespecButton({
  refund,
  label,
  onConfirm,
}: {
  refund: number;
  label: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <p>
      <button
        id="respec"
        className="small"
        disabled={!refund}
        onClick={() => {
          if (!armed) return setArmed(true);
          setArmed(false);
          onConfirm();
        }}
        onBlur={() => setArmed(false)}
      >
        {armed ? `ТОЧНО СБРОСИТЬ? ВЕРНУТЬ ${refund} КОДОВ` : label}
      </button>
    </p>
  );
}
