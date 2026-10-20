import { heroDefinitions } from '../../../data/characters/heroes.js';
import { heroPassives } from '../../../data/characters/hero-passives.js';
import { codes } from './format.js';

/** @typedef {{ id: string, label: string, disabled: boolean }} ShopItem */

export function shopView({ progression }) {
  const wallet = progression.wallet.codes;
  const heroCards = Object.entries(heroDefinitions).map(([id, hero]) => {
    const owned = progression.shop.owned(id);
    return {
      id,
      name: hero.name,
      desc: hero.desc,
      info:
        (heroPassives[id] ? heroPassives[id].role + ' · ' : '') +
        hero.hp +
        ' HP · скорость ' +
        hero.speed +
        (heroPassives[id] ? ' · Пассивка: ' + heroPassives[id].name : ''),
      owned,
      label: owned ? 'Доступен для забега' : 'Купить · ' + codes(progression.shop.prices[id]),
      disabled: owned || wallet < progression.shop.prices[id],
    };
  });
  /** @type {{ title: string, items: ShopItem[] }[]} */
  const groups = [];
  for (const [id, u] of Object.entries(progression.shop.upgrades)) {
    const title = u.hero ? 'Личные усиления' : 'Общие усиления';
    if (groups.at(-1)?.title !== title) groups.push({ title, items: [] });
    const level = progression.data.levels[id],
      lock = progression.shop.upgradeLock(id),
      locked = !!lock;
    groups.at(-1).items.push({
      id,
      label:
        (u.hero ? heroDefinitions[u.hero].name + ' · ' : '') +
        `${u.name} ${level}/${u.max} · ${u.desc} · ` +
        (level >= u.max ? 'Максимум' : codes(progression.shop.cost(id))) +
        (lock === 'hero' ? ' · Сначала открой героя' : '') +
        (lock === 'win' ? ' · Откроется после первой победы' : ''),
      disabled: locked || level >= u.max || wallet < progression.shop.cost(id),
    });
  }
  const refund = progression.shop.upgradeSpent();
  return {
    heroes: heroCards,
    groups,
    refund,
    refundLabel: refund ? `СБРОСИТЬ УЛУЧШЕНИЯ · +${codes(refund)}` : 'Нечего сбрасывать',
    wallet:
      `У тебя ${codes(wallet)} · каждая 10-я победа в забеге — +1 код` +
      (progression.persistent ? '' : ' · Не удалось сохранить прогресс. Не закрывай игру.'),
  };
}
