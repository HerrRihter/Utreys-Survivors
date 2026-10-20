import { unitDefinitions, enemyHpScale } from './units.js';
import { nodeDefinitions } from './nodes.js';
import { mapDefinitions } from '../maps/maps.js';

// Bestiary texts of every unit (the opponents screen, src/components/OpponentsView.tsx).
// Numbers come from the unit data, so the texts follow balance changes.

// Maps whose objective is a set of structures instead of the component nodes.
const deskMaps = Object.values(mapDefinitions).filter((map) => map.objective?.type === 'desks');

/**
 * @typedef {{ category: 'regulators' | 'clients', badge: string, badgeColor: string,
 *   role: string, protocol: string, frequency: string, aggregation: string,
 *   description: string, tactics: string }} OpponentMeta
 * @type {Record<keyof typeof unitDefinitions, OpponentMeta>}
 */
export const bestiary = {
  l3: {
    category: 'regulators',
    badge: 'ПРОМЕЖУТОЧНЫЙ КОНТУР L3 · РОЙ',
    badgeColor: '#00e676',
    role: 'Серверная интеграция уровня L3 (MES/ERP)',
    protocol: 'REST / gRPC · Потоковая агрегация',
    frequency: `Высокая (каждые ${unitDefinitions.l3.cooldown} с)`,
    aggregation: 'Короба и упаковки · первичный контур',
    description:
      'Промежуточный контур L3. Обеспечивает прямую связь производственных линий со складом готовой продукции, непрерывно передаёт пакеты агрегированных кодов и проводит первичную проверку соответствия формату DataMatrix.',
    tactics: `Основная масса волн: слабые серверы L3 бьют по кругу, но идут плотными группами. Собирай их в кучу на отходе и разбирай площадными атаками. Скорость — ${unitDefinitions.l3.speed} px/s.`,
  },
  crpt: {
    category: 'regulators',
    badge: 'ГЛАВНЫЙ ЭМИССИОННЫЙ РЕГУЛЯТОР (БОСС) · ТРИ ФАЗЫ',
    badgeColor: '#ffd600',
    role: 'Национальный каталог и шлюз Честный ЗНАК',
    protocol: 'Криптографический шлюз ГОСТ · HSM',
    frequency: `Круговая валидация (каждые ${unitDefinitions.crpt.cooldown} с)`,
    aggregation: 'Полный реестр эмиссии кодов маркировки',
    description: `Эмиссионный шлюз ЦРПТ (Честный ЗНАК). Ключевой регулятор системы: ${Math.round(unitDefinitions.crpt.hp * enemyHpScale)} HP, круговая валидация на ${unitDefinitions.crpt.range} px и три фазы проверки. На ${Math.round(unitDefinitions.crpt.phases[0].at * 100)}% здоровья подключает клиентов и добавляет к каждой проверке залп по кругу, на ${Math.round(unitDefinitions.crpt.phases[1].at * 100)}% вызывает подкрепление, накрывает площадь отметками и ускоряется.`,
    tactics: `Появляется, когда цель карты выполнена: обычно — когда устранены все ${nodeDefinitions.length} багов узлов${deskMaps.map((map) => `, на карте «${map.name}» — когда снесены все ${map.objective.count} сервисдеска`).join('')}. Выходи из золотой зоны во время подготовки, в фазе залпа ищи промежуток между снарядами, а в последней фазе не стой на месте: отметки на земле взрываются через секунду.`,
  },
  pepsi: {
    category: 'clients',
    badge: 'КЛЮЧЕВОЙ FMCG-КЛИЕНТ · РЫВОК',
    badgeColor: '#00b4d8',
    role: 'Транснациональный клиент напитков и снеков',
    protocol: 'MQ / Kafka · Высокоскоростной розлив',
    frequency: 'Ультравысокая (сотни запросов/сек)',
    aggregation: 'Бутылки, банки, групповые кейсы',
    description:
      'Клиент Пепси. Скоростные автоматизированные линии розлива напитков, генерация сотен запросов в секунду и постоянная динамическая верификация партий на лету.',
    tactics: `Догоняет рывком: останавливается, показывает полосу и проносится по ней на ${Math.round(unitDefinitions.pepsi.dash.speed * unitDefinitions.pepsi.dash.time)} px. Уходи с полосы вбок, а удар во время подготовки сбивает рывок. Перезарядка рывка — ${unitDefinitions.pepsi.dash.cooldown} с.`,
  },
  inbev: {
    category: 'clients',
    badge: 'ПРОМЫШЛЕННЫЙ КЛИЕНТ · ЩИТ',
    badgeColor: '#d4af37',
    role: 'Пивоваренный производственный гигант',
    protocol: 'OPC-UA / SAP · Паллетная логистика',
    frequency: 'Тяжёлые периодические пакеты',
    aggregation: 'Кеги, групповые паллеты, контейнеры',
    description:
      'Клиент Инбев. Крупнейший пивоваренный производитель с массивными производственными паллетами и высокой плотностью групповой агрегации кодов. Оснащён усиленной защитой от входящих запросов с фронтальной стороны.',
    tactics: `Фронтальная броня блокирует ${Math.round((1 - unitDefinitions.inbev.frontDamageMultiplier) * 100)}% урона, а после прерывания ${unitDefinitions.inbev.poise} с не сбивается. Заходи с фланга или тыла, используй мины и орбитальные атаки, которые бьют со всех сторон.`,
  },
  mars: {
    category: 'clients',
    badge: 'МЕЖДУНАРОДНЫЙ КЛИЕНТ · СТРЕЛОК',
    badgeColor: '#ff5252',
    role: 'Международный FMCG-холдинг кондитерских изделий',
    protocol: 'EDI / AS2 · Дистанционная выгрузка',
    frequency: `Дальнобойные залповые отчеты (${unitDefinitions.mars.range}px)`,
    aggregation: 'Индивидуальные штуки, шоу-боксы',
    description:
      'Клиент Марс. Международный производитель кондитерских изделий и кормов. Непрерывная выгрузка отчётов нанесения и высокочастотные дистанционные запросы, атакующие ядро с безопасного расстояния.',
    tactics: `Базовый стрелок: держится на ${unitDefinitions.mars.range} px и запускает одиночный пакет. Сместись поперёк полосы и сближайся в паузе между выстрелами.`,
  },
  mars_petfood: {
    category: 'clients',
    badge: 'ПРОИЗВОДСТВЕННЫЙ КЛИЕНТ · ВЕЕР',
    badgeColor: unitDefinitions.mars_petfood.color,
    role: 'Производственный контур кормов для домашних животных',
    protocol: 'Партии рецептур · Отчёты фасовки',
    frequency: `Интервал атак — ${unitDefinitions.mars_petfood.cooldown} с; подготовка — ${unitDefinitions.mars_petfood.wind} с`,
    aggregation: 'Паучи, пакеты сухого корма, транспортные короба',
    description:
      'Клиент Марс Петфуд. Производственные линии сухих и влажных кормов, множество рецептур и форматов упаковки. Поток отчётов фасовки превращается в направленные пакеты данных, атакующие ядро с безопасного расстояния.',
    tactics: `Выпускает веер из ${unitDefinitions.mars_petfood.shots.count} пакетов. Уклоняйся широким шагом, чтобы не попасть под соседний снаряд, или подходи вплотную: вблизи веер узкий. Дальность — ${unitDefinitions.mars_petfood.range} px.`,
  },
  baltika: {
    category: 'clients',
    badge: 'ПИВОВАРЕННЫЙ КЛИЕНТ · ПРИКРЫТИЕ',
    badgeColor: unitDefinitions.baltika.color,
    role: 'Контур розлива и отгрузки пивоваренной продукции',
    protocol: 'Серии розлива · Паллетная агрегация',
    frequency: `Интервал атак — ${unitDefinitions.baltika.cooldown} с; подготовка — ${unitDefinitions.baltika.wind} с`,
    aggregation: 'Бутылки, банки, кеги и паллеты',
    description:
      'Клиент Балтика. Высокопроизводительные линии розлива, крупные партии бутылок и кегов, плотная паллетная агрегация. Массивный узел отгрузки прикрывает соседние потоки: пока он рядом, клиенты вокруг получают меньше урона.',
    tactics: `Пунктирный круг — зона прикрытия: союзники внутри получают на ${Math.round(unitDefinitions.baltika.aura.reduction * 100)}% меньше урона. Сначала убери Балтику или вымани группу из круга. Радиус — ${unitDefinitions.baltika.aura.radius} px.`,
  },
  multon: {
    category: 'clients',
    badge: 'КЛИЕНТ НАПИТКОВ · СТАЯ',
    badgeColor: unitDefinitions.multon.color,
    role: 'Производственный контур соков и напитков',
    protocol: 'Поток розлива · Сверка упаковок',
    frequency: `Интервал атак — ${unitDefinitions.multon.cooldown} с; подготовка — ${unitDefinitions.multon.wind} с`,
    aggregation: 'Пакеты соков, бутылки, групповые упаковки',
    description:
      'Клиент Мултон. Непрерывный розлив соков и напитков, смена форматов упаковки и быстрая сборка групповых кейсов. Мобильные потоки запросов стремительно сокращают дистанцию и атакуют ядро в ближнем бою.',
    tactics: `Всегда приходит стаей по ${unitDefinitions.multon.pack}. Поодиночке слабы, но быстры (${unitDefinitions.multon.speed} px/s): не давай стае окружить себя и бей, пока она в одной точке.`,
  },
  loreal: {
    category: 'clients',
    badge: 'КОСМЕТИЧЕСКИЙ КЛИЕНТ · СНАЙПЕР',
    badgeColor: unitDefinitions.loreal.color,
    role: 'Контур косметики и средств ухода',
    protocol: 'Серии продукции · Поэкземплярная сверка',
    frequency: `Интервал атак — ${unitDefinitions.loreal.cooldown} с; подготовка — ${unitDefinitions.loreal.wind} с`,
    aggregation: 'Флаконы, тубы, индивидуальные коробки',
    description:
      'Клиент Лореаль. Множество косметических линеек, серий и форматов требуют точной поэкземплярной сверки. Адресные отчёты отправляются с дистанции в виде одиночных пакетов данных, заставляя ядро постоянно менять траекторию.',
    tactics: `Держится далеко (около ${unitDefinitions.loreal.keep} px) и долго целится: длинная полоса — это выстрел быстрым пакетом на ${unitDefinitions.loreal.range} px. Сойди с линии до выстрела; на сближении снайпер отступает, поэтому прижимай его к стенам.`,
  },
  procter_gamble: {
    category: 'clients',
    badge: 'КЛИЕНТ БЫТОВОЙ ХИМИИ · ВЗРЫВ',
    badgeColor: unitDefinitions.procter_gamble.color,
    role: 'Контур средств гигиены и ухода за домом',
    protocol: 'Смешанные партии · Групповая консолидация',
    frequency: `Интервал атак — ${unitDefinitions.procter_gamble.cooldown} с; подготовка — ${unitDefinitions.procter_gamble.wind} с`,
    aggregation: 'Флаконы, пачки, транспортные короба и паллеты',
    description:
      'Клиент Проктер энд Гэмбл. Разнородные линии бытовой химии и средств ухода объединяются в крупные смешанные партии. Тяжёлый контур консолидации медленно теснит ядро, а после ликвидации его партия разлетается по площади.',
    tactics: `После уничтожения корпус взрывается через ${unitDefinitions.procter_gamble.deathBlast.delay} с в радиусе ${unitDefinitions.procter_gamble.deathBlast.radius} px. Добив, сразу отходи из отмеченного круга; взрыв не задевает других клиентов.`,
  },
  progress: {
    category: 'clients',
    badge: 'ДЕТСКОЕ ПИТАНИЕ · ПОДДЕРЖКА',
    badgeColor: unitDefinitions.progress.color,
    role: 'Прогресс — производственный контур ФрутоНяни',
    protocol: 'Серии выпуска · Прослеживаемость партии',
    frequency: `Интервал атак — ${unitDefinitions.progress.cooldown} с; подготовка — ${unitDefinitions.progress.wind} с`,
    aggregation: 'Пюре в паучах и банках, соки, коробки каш',
    description:
      'Клиент Прогресс (ФрутоНяня). Производственные линии детского питания, контроль серий и прослеживаемость каждой упаковки. Держится позади потока и восстанавливает партии соседних клиентов, изредка отправляя одиночные пакеты.',
    tactics: `Каждые ${unitDefinitions.progress.heal.every} с восстанавливает ${Math.round(unitDefinitions.progress.heal.amount * 100)}% здоровья клиентам в радиусе ${unitDefinitions.progress.heal.radius} px. Приоритетная цель: прорвись к нему через группу, иначе танки и стрелки не закончатся.`,
  },
  royal_canin: {
    category: 'clients',
    badge: 'КЛИЕНТ PETFOOD · ОЧЕРЕДЬ',
    badgeColor: unitDefinitions.royal_canin.color,
    role: 'Контур специализированного питания кошек и собак',
    protocol: 'Рецептурные серии · Адресная отправка отчётов',
    frequency: `Интервал атак — ${unitDefinitions.royal_canin.cooldown} с; подготовка — ${unitDefinitions.royal_canin.wind} с`,
    aggregation: 'Пакеты сухого корма, паучи и транспортные короба',
    description:
      'Клиент Роял Канин. Специализированные рационы для кошек и собак, отдельные рецептурные серии и адресная отчётность по упаковкам. Направленные пакеты данных поступают из второй линии, поддерживая наступление ближних потоков.',
    tactics: `Стреляет очередью из ${unitDefinitions.royal_canin.shots.count} пакетов по одной линии. Одного шага в сторону мало, если идти вдоль очереди: уходи поперёк и сближайся после третьего пакета. Дальность — ${unitDefinitions.royal_canin.range} px.`,
  },
  cherkizovo: {
    category: 'clients',
    badge: 'ПИЩЕВОЙ КЛИЕНТ · ЯРОСТЬ',
    badgeColor: unitDefinitions.cherkizovo.color,
    role: 'Контур мясной продукции и готовых изделий',
    protocol: 'Производственные партии · Сверка отгрузки',
    frequency: `Интервал атак — ${unitDefinitions.cherkizovo.cooldown} с; подготовка — ${unitDefinitions.cherkizovo.wind} с`,
    aggregation: 'Лотки, вакуумные упаковки и транспортные короба',
    description:
      'Клиент Черкизово. Производственные партии мясной продукции проходят через фасовку, сборку коробов и распределение отгрузок. Плотный промышленный поток обладает большим запасом прочности и наносит тяжёлые направленные удары на близкой дистанции.',
    tactics: `Раненый (ниже ${Math.round(unitDefinitions.cherkizovo.enrage.below * 100)}% здоровья) приходит в ярость: скорость ×${unitDefinitions.cherkizovo.enrage.speed}, удары чаще. Добивай одной серией или держи дистанцию, когда он сменит темп.`,
  },
  ferrero: {
    category: 'clients',
    badge: 'КОНДИТЕРСКИЙ КЛИЕНТ · АРТИЛЛЕРИЯ',
    badgeColor: unitDefinitions.ferrero.color,
    role: 'Контур кондитерских изделий и подарочных форматов',
    protocol: 'Серии фасовки · Выгрузка групповых отчётов',
    frequency: `Интервал атак — ${unitDefinitions.ferrero.cooldown} с; подготовка — ${unitDefinitions.ferrero.wind} с`,
    aggregation: 'Индивидуальные обёртки, наборы и шоу-боксы',
    description:
      'Клиент Ферреро. Индивидуальные изделия объединяются в наборы, шоу-боксы и транспортные группы. Из второй линии отправляет групповые отчёты навесом: отметка появляется под ядром и срабатывает через мгновение.',
    tactics: `Отмечает землю под тобой; через ${unitDefinitions.ferrero.mortar.delay} с отметка взрывается в радиусе ${unitDefinitions.ferrero.mortar.radius} px. Не стой на месте и заходи к отправителю с фланга: он держит дистанцию около ${unitDefinitions.ferrero.keep} px.`,
  },
  mondelez: {
    category: 'clients',
    badge: 'КЛИЕНТ СНЕКОВ · ОБХОД',
    badgeColor: unitDefinitions.mondelez.color,
    role: 'Контур кондитерских изделий, печенья и снеков',
    protocol: 'Многоформатные серии · Поточная упаковка',
    frequency: `Интервал атак — ${unitDefinitions.mondelez.cooldown} с; подготовка — ${unitDefinitions.mondelez.wind} с`,
    aggregation: 'Плитки, пачки печенья, снеки и групповые короба',
    description:
      'Клиент Монделиз. Быстрая смена кондитерских изделий, печенья и снеков, непрерывная упаковка в пачки и групповые короба. Подвижные потоки запросов быстро подбираются к ядру и усиливают давление ближних групп.',
    tactics: `Не идёт в лоб: заходит сбоку и сзади, перекрывая путь отхода. Чаще оглядывайся на фланги и отходи в сторону, откуда группа не идёт. Скорость — ${unitDefinitions.mondelez.speed} px/s.`,
  },
  vetis: {
    category: 'regulators',
    badge: 'ВЕТЕРИНАРНЫЙ КОНТУР · ЗАМЕДЛЕНИЕ',
    badgeColor: unitDefinitions.vetis.color,
    role: 'Система ветеринарной прослеживаемости',
    protocol: 'Партии продукции · Сопоставление документов',
    frequency: `Интервал атак — ${unitDefinitions.vetis.cooldown} с; подготовка — ${unitDefinitions.vetis.wind} с`,
    aggregation: 'Подконтрольные партии и сопроводительные записи',
    description:
      'Система Ветис. Контур ветеринарной прослеживаемости сопоставляет производственные партии с сопроводительными записями. Устойчивый проверяющий узел медленно приближается к ядру и проводит круговую проверку с ударной волной вокруг себя.',
    tactics: `Круговая проверка на ${unitDefinitions.vetis.range} px замедляет на ${Math.round(unitDefinitions.vetis.slow.amount * 100)}% на ${unitDefinitions.vetis.slow.duration} с, а под замедлением трудно уйти от остальных. Полностью выходи из круга подготовки, затем возвращайся в паузе.`,
  },
  bug_aggregation: {
    category: 'regulators',
    badge: 'БАГ · МИНИБОСС · ПРИЗЫВ',
    badgeColor: unitDefinitions.bug_aggregation.color,
    role: 'Охрана компонента',
    protocol: 'Игровой сбой',
    frequency: `Проверка каждые ${unitDefinitions.bug_aggregation.cooldown} с`,
    aggregation: 'Узел компонента',
    description:
      'Баг охраняет узел и не двигается. У каждого бага своя защита. Уничтожение бага или найденный воркэраунд освобождает компонент.',
    tactics: `Каждые ${unitDefinitions.bug_aggregation.summon.every} с вызывает защитников L3 (не больше ${unitDefinitions.bug_aggregation.summon.max} одновременно) и бьёт по кругу на ${unitDefinitions.bug_aggregation.range} px. Уничтожь минибосса или оставайся в круге узла 6 секунд без урона; после прерывания баг ${unitDefinitions.bug_aggregation.poise} с не сбивается.`,
  },
  bug_usage: {
    category: 'regulators',
    badge: 'БАГ · МИНИБОСС · ЗАЛП',
    badgeColor: unitDefinitions.bug_usage.color,
    role: 'Охрана компонента',
    protocol: 'Игровой сбой',
    frequency: `Проверка каждые ${unitDefinitions.bug_usage.cooldown} с`,
    aggregation: 'Узел компонента',
    description:
      'Баг охраняет узел и не двигается. У каждого бага своя защита. Уничтожение бага или найденный воркэраунд освобождает компонент.',
    tactics: `Выпускает кольцо из ${unitDefinitions.bug_usage.shots.count} пакетов: встань в промежуток между лучами подготовки. Уничтожь минибосса или оставайся в круге узла 6 секунд без урона; после прерывания баг ${unitDefinitions.bug_usage.poise} с не сбивается.`,
  },
  bug_import: {
    category: 'regulators',
    badge: 'БАГ · МИНИБОСС · ОБСТРЕЛ',
    badgeColor: unitDefinitions.bug_import.color,
    role: 'Охрана компонента',
    protocol: 'Игровой сбой',
    frequency: `Проверка каждые ${unitDefinitions.bug_import.cooldown} с`,
    aggregation: 'Узел компонента',
    description:
      'Баг охраняет узел и не двигается. У каждого бага своя защита. Уничтожение бага или найденный воркэраунд освобождает компонент.',
    tactics: `Ставит ${unitDefinitions.bug_import.mortar.count} отметки вокруг тебя; через ${unitDefinitions.bug_import.mortar.delay} с они взрываются. Уничтожь минибосса или оставайся в круге узла 6 секунд без урона; после прерывания баг ${unitDefinitions.bug_import.poise} с не сбивается.`,
  },
  bug_logistic: {
    category: 'regulators',
    badge: 'БАГ · МИНИБОСС · ЗАМЕДЛЕНИЕ',
    badgeColor: unitDefinitions.bug_logistic.color,
    role: 'Охрана компонента',
    protocol: 'Игровой сбой',
    frequency: `Проверка каждые ${unitDefinitions.bug_logistic.cooldown} с`,
    aggregation: 'Узел компонента',
    description:
      'Баг охраняет узел и не двигается. У каждого бага своя защита. Уничтожение бага или найденный воркэраунд освобождает компонент.',
    tactics: `Широкая волна на ${unitDefinitions.bug_logistic.range} px замедляет на ${Math.round(unitDefinitions.bug_logistic.slow.amount * 100)}%. Уничтожь минибосса или оставайся в круге узла 6 секунд без урона; после прерывания баг ${unitDefinitions.bug_logistic.poise} с не сбивается.`,
  },
  bug_goods: {
    category: 'regulators',
    badge: 'БАГ · МИНИБОСС · ЛУЖИ',
    badgeColor: unitDefinitions.bug_goods.color,
    role: 'Охрана компонента',
    protocol: 'Игровой сбой',
    frequency: `Проверка каждые ${unitDefinitions.bug_goods.cooldown} с`,
    aggregation: 'Узел компонента',
    description:
      'Баг охраняет узел и не двигается. У каждого бага своя защита. Уничтожение бага или найденный воркэраунд освобождает компонент.',
    tactics: `Оставляет под тобой зоны отчётов, которые бьют, пока ты в них стоишь, и держатся ${unitDefinitions.bug_goods.pools.life} с. Уничтожь минибосса или оставайся в круге узла 6 секунд без урона; после прерывания баг ${unitDefinitions.bug_goods.poise} с не сбивается.`,
  },
  pepsi_desk: {
    category: 'clients',
    badge: 'СЕРВИСДЕСК · ЦЕЛЬ КАРТЫ · ТИКЕТЫ',
    badgeColor: unitDefinitions.pepsi_desk.color,
    role: 'Поддержка клиента Пепси',
    protocol: 'Тикеты · Бэклог без SLA',
    frequency: `Тикеты каждые ${unitDefinitions.pepsi_desk.summon.every} с`,
    aggregation: 'Карта «Сервисдеск Пепси»',
    description:
      'Стоит на месте, не атакует и не отбрасывается. Пока сервисдеск работает, он выпускает Пепси, где бы ты ни был. Три сервисдеска заменяют узлы на своей карте.',
    tactics: `Каждые ${unitDefinitions.pepsi_desk.summon.every} с выпускает Пепси: сначала по ${unitDefinitions.pepsi_desk.summon.count}, затем на одного больше после каждых ${unitDefinitions.pepsi_desk.summon.grow} выпусков, до ${unitDefinitions.pepsi_desk.summon.countMax} за раз и не больше ${unitDefinitions.pepsi_desk.summon.max} живых от одного стола. Не тяни: чем дольше открыт стол, тем гуще бэклог. Снеси все три, и придёт ЦРПТ.`,
  },
};
